/**
 * Content chunking engine for DraftCrane source materials.
 *
 * Splits HTML source documents into overlapping chunks suitable for:
 * - FTS5 indexing (keyword search)
 * - Vector embeddings (semantic search via Vectorize)
 * - LLM prompt assembly (context within token budget)
 *
 * Two modes based on source document structure:
 *   1. Structured HTML (DOCX/MD) - headings, lists, tables -> heading-chain preservation
 *   2. Flat HTML (PDF) - all <p> tags -> heuristic heading detection + positional context
 *
 * Parameters per ADR-009:
 *   - Target: 300 words (conservative for bge-small-en-v1.5 512-token limit)
 *   - Max: 400 words hard cap
 *   - Min: 50 words (avoid fragments, merge into previous chunk)
 *   - Overlap: 2 sentences (~50 words continuity between adjacent chunks)
 *   - Never split mid-sentence
 *
 * Migrated from scripts/chunking-spike.ts (spike #136) per ADR-009 migration path.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Chunk {
  /** Composite key: sourceId:chunkIndex */
  id: string;
  /** Source material ID */
  sourceId: string;
  /** Human-readable source title */
  sourceTitle: string;
  /** Heading hierarchy, e.g. ["Chapter 3", "Methodology"] or ["Section 2 of 8"] */
  headingChain: string[];
  /** Plain text content (HTML stripped) */
  text: string;
  /** HTML fragment for display */
  html: string;
  /** Word count of text field */
  wordCount: number;
  /** Character offset in original HTML */
  startOffset: number;
  /** Character offset in original HTML */
  endOffset: number;
}

export interface ChunkingOptions {
  targetWords?: number;
  maxWords?: number;
  minWords?: number;
  overlapSentences?: number;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  targetWords: 300,
  maxWords: 400,
  minWords: 50,
  overlapSentences: 2,
};

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags and decode basic entities */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

/**
 * Split text into sentences, handling common abbreviations and edge cases.
 * Returns non-empty trimmed sentences.
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];

  // Protect common abbreviations from being split on
  const protected_ = text
    .replace(
      /\b(Dr|Mr|Mrs|Ms|Prof|Jr|Sr|Inc|Ltd|Corp|Co|vs|etc|al|ed|vol|Rev|Gen|Gov)\./g,
      "$1\u0000",
    )
    .replace(/\b([A-Z])\./g, "$1\u0000")
    .replace(/(\d)\./g, "$1\u0000")
    .replace(/\be\.g\./g, "e\u0000g\u0000")
    .replace(/\bi\.e\./g, "i\u0000e\u0000")
    .replace(/\bp\.\s/g, "p\u0000 ");

  const parts = protected_.split(/(?<=[.!?]["')\]]?)\s+(?=[A-Z"(])/);

  return parts.map((s) => s.replace(/\u0000/g, ".").trim()).filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// HTML element parsing (lightweight, no dependency)
// ---------------------------------------------------------------------------

interface HtmlElement {
  tag: string;
  content: string; // raw HTML content
  text: string; // plain text
  isHeading: boolean;
  headingLevel: number;
}

/** Parse HTML into a sequence of block-level elements */
function parseHtmlElements(html: string): HtmlElement[] {
  const elements: HtmlElement[] = [];
  const blockRegex = /<(h[1-6]|p|li|table|ul|ol|blockquote)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[0].match(/^<(\w+)/)?.[1]?.toLowerCase() || "";
    const content = match[0];
    const text = stripHtml(content);

    if (!text.trim()) continue;

    const isHeading = /^h[1-6]$/.test(tag);
    const headingLevel = isHeading ? parseInt(tag[1]) : 0;

    elements.push({ tag, content, text, isHeading, headingLevel });
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Heuristic heading detection for flat HTML (PDF sources)
// ---------------------------------------------------------------------------

interface DetectedSection {
  heading: string | null;
  elements: HtmlElement[];
  position: number;
  totalSections: number;
}

/**
 * Detect headings in flat <p>-only HTML using heuristics:
 * - ALL CAPS lines under 10 words
 * - Short lines (<10 words) not ending with a period, followed by longer content
 */
function detectFlatHtmlSections(elements: HtmlElement[]): DetectedSection[] {
  const sections: DetectedSection[] = [];
  let currentHeading: string | null = null;
  let currentElements: HtmlElement[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const words = el.text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const isShort = wordCount < 10;
    const isAllCaps = el.text === el.text.toUpperCase() && /[A-Z]/.test(el.text);
    const endsWithPeriod = /[.!?]$/.test(el.text.trim());
    const nextEl = i + 1 < elements.length ? elements[i + 1] : null;
    const nextIsLonger = nextEl
      ? nextEl.text.split(/\s+/).filter(Boolean).length > wordCount
      : false;

    const looksLikeHeading = isShort && (isAllCaps || (!endsWithPeriod && nextIsLonger));

    if (looksLikeHeading) {
      if (currentElements.length > 0) {
        sections.push({
          heading: currentHeading,
          elements: [...currentElements],
          position: sections.length,
          totalSections: 0,
        });
      }
      currentHeading = el.text;
      currentElements = [];
    } else {
      currentElements.push(el);
    }
  }

  if (currentElements.length > 0) {
    sections.push({
      heading: currentHeading,
      elements: [...currentElements],
      position: sections.length,
      totalSections: 0,
    });
  }

  for (const section of sections) {
    section.totalSections = sections.length;
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Sentence-level text accumulator (core chunking logic)
// ---------------------------------------------------------------------------

/**
 * Accumulates sentences into chunks respecting word limits.
 * Shared core used by both structured and flat chunking modes.
 */
class ChunkAccumulator {
  private chunks: Chunk[] = [];
  private currentSentences: string[] = [];
  private currentWordCount = 0;
  private lastChunkOverlap = "";
  private startOffset = 0;

  constructor(
    private sourceId: string,
    private sourceTitle: string,
    private headingChainFn: () => string[],
    private opts: Required<ChunkingOptions>,
  ) {}

  /** Add sentences from an element, splitting at sentence boundaries as needed */
  addElement(text: string, offset: number): void {
    const sentences = splitSentences(text);

    for (const sentence of sentences) {
      const sentenceWords = countWords(sentence);

      // If adding this sentence exceeds max and we have content, flush first
      if (
        this.currentWordCount + sentenceWords > this.opts.maxWords &&
        this.currentSentences.length > 0
      ) {
        this.flush(offset);
      }

      if (this.currentSentences.length === 0) {
        this.startOffset = offset;
      }

      this.currentSentences.push(sentence);
      this.currentWordCount += sentenceWords;

      // If we've hit the target, flush
      if (this.currentWordCount >= this.opts.targetWords) {
        this.flush(offset);
      }
    }
  }

  /** Force flush at a section/heading boundary */
  flushAtBoundary(offset: number): void {
    this.flush(offset);
  }

  /** Get all accumulated chunks */
  getChunks(): Chunk[] {
    return this.chunks;
  }

  private flush(endOffset: number): void {
    if (this.currentSentences.length === 0) return;

    const text = this.currentSentences.join(" ");
    const wordCount = countWords(text);

    if (wordCount < this.opts.minWords && this.chunks.length > 0) {
      // Too small -- merge with previous chunk
      const prev = this.chunks[this.chunks.length - 1];
      prev.text += " " + text;
      prev.html += " " + text;
      prev.wordCount = countWords(prev.text);
      prev.endOffset = endOffset;
    } else if (wordCount > 0) {
      const fullText = this.lastChunkOverlap ? this.lastChunkOverlap + " " + text : text;

      this.chunks.push({
        id: `${this.sourceId}:${this.chunks.length}`,
        sourceId: this.sourceId,
        sourceTitle: this.sourceTitle,
        headingChain: this.headingChainFn(),
        text: fullText,
        html: `<p>${text}</p>`,
        wordCount: countWords(fullText),
        startOffset: this.startOffset,
        endOffset,
      });
    }

    // Overlap: last N sentences for continuity
    this.lastChunkOverlap = this.currentSentences.slice(-this.opts.overlapSentences).join(" ");

    this.currentSentences = [];
    this.currentWordCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Chunking engine (public API)
// ---------------------------------------------------------------------------

/**
 * Chunk structured HTML (DOCX/MD sources with headings).
 * Splits within paragraphs at sentence boundaries when needed.
 */
export function chunkStructuredHtml(
  sourceId: string,
  sourceTitle: string,
  html: string,
  options?: ChunkingOptions,
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const elements = parseHtmlElements(html);

  const headingStack: { level: number; text: string }[] = [];

  const accumulator = new ChunkAccumulator(
    sourceId,
    sourceTitle,
    () => headingStack.map((h) => h.text),
    opts,
  );

  let offset = 0;
  for (const element of elements) {
    if (element.isHeading) {
      // Flush before heading change
      accumulator.flushAtBoundary(offset);

      // Update heading stack
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= element.headingLevel
      ) {
        headingStack.pop();
      }
      headingStack.push({ level: element.headingLevel, text: element.text });
    } else {
      accumulator.addElement(element.text, offset);
    }
    offset += element.content.length;
  }

  // Flush remaining
  accumulator.flushAtBoundary(offset);
  return accumulator.getChunks();
}

/**
 * Chunk flat HTML (PDF sources -- all <p> tags).
 * Uses heuristic heading detection + positional context.
 */
export function chunkFlatHtml(
  sourceId: string,
  sourceTitle: string,
  html: string,
  options?: ChunkingOptions,
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const elements = parseHtmlElements(html);
  const sections = detectFlatHtmlSections(elements);

  let currentHeadingChain: string[] = [];

  const accumulator = new ChunkAccumulator(
    sourceId,
    sourceTitle,
    () => [...currentHeadingChain],
    opts,
  );

  for (const section of sections) {
    if (section.heading) {
      currentHeadingChain = [section.heading];
    } else {
      currentHeadingChain = [`Section ${section.position + 1} of ${section.totalSections}`];
    }

    accumulator.flushAtBoundary(0);

    for (const element of section.elements) {
      accumulator.addElement(element.text, 0);
    }
  }

  accumulator.flushAtBoundary(0);
  return accumulator.getChunks();
}

/**
 * Auto-detect HTML type and chunk accordingly.
 *
 * @param sourceId - Source material ID
 * @param sourceTitle - Human-readable source title
 * @param html - HTML content from R2
 * @param htmlType - "structured" for DOCX/MD, "flat" for PDF
 * @param options - Override default chunking parameters
 */
export function chunkHtml(
  sourceId: string,
  sourceTitle: string,
  html: string,
  htmlType: "structured" | "flat",
  options?: ChunkingOptions,
): Chunk[] {
  if (htmlType === "structured") {
    return chunkStructuredHtml(sourceId, sourceTitle, html, options);
  }
  return chunkFlatHtml(sourceId, sourceTitle, html, options);
}

/**
 * Determine HTML type from MIME type.
 * PDF produces flat HTML; everything else produces structured HTML.
 */
export function htmlTypeFromMime(mimeType: string): "structured" | "flat" {
  if (mimeType === "application/pdf") {
    return "flat";
  }
  return "structured";
}
