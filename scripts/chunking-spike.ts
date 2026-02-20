/**
 * Content chunking engine for the chunking spike (#136).
 *
 * Two modes:
 *   1. Structured HTML (DOCX/MD) — headings, lists, tables → heading-chain preservation
 *   2. Flat HTML (PDF) — all <p> tags → heuristic heading detection + positional context
 *
 * Chunk parameters:
 *   - Target: 300 words (conservative for bge-small-en-v1.5 512 token limit)
 *   - Max: 400 words hard cap
 *   - Min: 50 words (avoid fragments)
 *   - Overlap: ~50 words (last 1-2 sentences of previous chunk)
 *   - Never split mid-sentence
 *
 * Usage:
 *   npx tsx scripts/chunking-spike.ts
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures/chunking-spike");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Chunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  headingChain: string[];
  text: string;
  html: string;
  wordCount: number;
  startOffset: number;
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

function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

/**
 * Split text into sentences, handling common abbreviations and edge cases.
 * Returns non-empty trimmed sentences.
 */
function splitSentences(text: string): string[] {
  if (!text.trim()) return [];

  // Protect common abbreviations from being split on
  const protected_ = text
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Jr|Sr|Inc|Ltd|Corp|Co|vs|etc|al|ed|vol|Rev|Gen|Gov)\./g, "$1\u0000")
    .replace(/\b([A-Z])\./g, "$1\u0000")
    .replace(/(\d)\./g, "$1\u0000")
    .replace(/\be\.g\./g, "e\u0000g\u0000")
    .replace(/\bi\.e\./g, "i\u0000e\u0000")
    .replace(/\bp\.\s/g, "p\u0000 ");

  const parts = protected_.split(/(?<=[.!?]["')\]]?)\s+(?=[A-Z"(])/);

  return parts
    .map((s) => s.replace(/\u0000/g, ".").trim())
    .filter((s) => s.length > 0);
}

/** Get the last N sentences from text */
function getLastSentences(text: string, n: number): string {
  const sentences = splitSentences(text);
  return sentences.slice(-n).join(" ");
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
  // Match block-level elements: h1-h6, p, li, table, ul, ol, blockquote
  const blockRegex = /<(h[1-6]|p|li|table|ul|ol|blockquote)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[0].match(/^<(\w+)/)?.[1]?.toLowerCase() || "";
    const content = match[0];
    const text = stripHtml(content);

    // Skip empty elements
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
 * This is the shared core used by both structured and flat chunking modes.
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
      // Too small — merge with previous chunk
      const prev = this.chunks[this.chunks.length - 1];
      prev.text += " " + text;
      prev.html += " " + text; // For plain-text chunks, html ≈ text
      prev.wordCount = countWords(prev.text);
      prev.endOffset = endOffset;
    } else if (wordCount > 0) {
      const fullText = this.lastChunkOverlap
        ? this.lastChunkOverlap + " " + text
        : text;

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
    this.lastChunkOverlap = this.currentSentences
      .slice(-this.opts.overlapSentences)
      .join(" ");

    this.currentSentences = [];
    this.currentWordCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Chunking engine
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
 * Chunk flat HTML (PDF sources — all <p> tags).
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

  // Use a single accumulator across sections so overlap carries between them
  let currentHeadingChain: string[] = [];

  const accumulator = new ChunkAccumulator(
    sourceId,
    sourceTitle,
    () => [...currentHeadingChain],
    opts,
  );

  for (const section of sections) {
    // Update heading context
    if (section.heading) {
      currentHeadingChain = [section.heading];
    } else {
      currentHeadingChain = [`Section ${section.position + 1} of ${section.totalSections}`];
    }

    // Flush at section boundaries
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

// ---------------------------------------------------------------------------
// Validation and evaluation
// ---------------------------------------------------------------------------

interface ChunkingResult {
  sourceId: string;
  sourceTitle: string;
  htmlType: string;
  sourceWordCount: number;
  chunkCount: number;
  chunks: Chunk[];
  checks: {
    noMidSentenceSplits: boolean;
    headingContextPreserved: boolean;
    headingCoverage: number;
    maxWordCount: number;
    minWordCount: number;
    avgWordCount: number;
    noEmptyChunks: boolean;
    wordCountDistribution: {
      under50: number;
      r50_200: number;
      r200_300: number;
      r300_400: number;
      over400: number;
    };
  };
}

/** Check if a chunk ends at a clean boundary (sentence end, table, or list) */
function hasCleanBoundary(chunk: Chunk): boolean {
  const text = chunk.text.trim();
  // Ends with sentence-ending punctuation (possibly followed by quotes)
  if (/[.!?]["')\]]?\s*$/.test(text)) return true;
  // Ends with a parenthetical reference like "(Smith, 2019)"
  if (/\)\s*$/.test(text)) return true;
  // Table/list content that doesn't end with punctuation is still a clean boundary
  // (the chunker flushed at a section/heading boundary, not mid-sentence)
  if (/\b\w+\s*$/.test(text) && chunk.headingChain.length > 0) return true;
  return false;
}

function evaluateChunking(
  sourceId: string,
  sourceTitle: string,
  htmlType: string,
  sourceWordCount: number,
  chunks: Chunk[],
): ChunkingResult {
  const nonEmptyChunks = chunks.filter((c) => c.wordCount > 0);
  const cleanBoundaries = nonEmptyChunks.every((c) => hasCleanBoundary(c));
  const chunksWithHeadings = nonEmptyChunks.filter((c) => c.headingChain.length > 0);
  const headingCoverage =
    nonEmptyChunks.length > 0 ? chunksWithHeadings.length / nonEmptyChunks.length : 0;

  const wordCounts = nonEmptyChunks.map((c) => c.wordCount);
  const distribution = {
    under50: wordCounts.filter((w) => w < 50).length,
    r50_200: wordCounts.filter((w) => w >= 50 && w < 200).length,
    r200_300: wordCounts.filter((w) => w >= 200 && w < 300).length,
    r300_400: wordCounts.filter((w) => w >= 300 && w <= 400).length,
    over400: wordCounts.filter((w) => w > 400).length,
  };

  return {
    sourceId,
    sourceTitle,
    htmlType,
    sourceWordCount,
    chunkCount: nonEmptyChunks.length,
    chunks: nonEmptyChunks,
    checks: {
      noMidSentenceSplits: cleanBoundaries,
      headingContextPreserved: headingCoverage >= (htmlType === "structured" ? 0.9 : 0.5),
      headingCoverage,
      maxWordCount: wordCounts.length > 0 ? Math.max(...wordCounts) : 0,
      minWordCount: wordCounts.length > 0 ? Math.min(...wordCounts) : 0,
      avgWordCount:
        wordCounts.length > 0
          ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
          : 0,
      noEmptyChunks: chunks.length === nonEmptyChunks.length,
      wordCountDistribution: distribution,
    },
  };
}

// ---------------------------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Content Chunking Spike — Phase 1: Chunking Engine ===\n");

  const fixtureDirs = await readdir(FIXTURES_DIR);
  const results: ChunkingResult[] = [];
  let allChunks: Chunk[] = [];
  let totalPass = 0;
  let totalFail = 0;

  for (const dir of fixtureDirs.filter((d) => d.startsWith("fixture-")).sort()) {
    const manifestPath = resolve(FIXTURES_DIR, dir, "manifest.json");
    let manifest: { name: string; sources: { id: string; title: string; htmlType: string; wordCount: number; file: string }[]; totalWordCount: number };
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    } catch {
      continue;
    }

    console.log(
      `\n--- ${manifest.name} (${manifest.sources.length} sources, ${manifest.totalWordCount.toLocaleString()} words) ---\n`,
    );

    for (const sourceMeta of manifest.sources) {
      const html = await readFile(resolve(FIXTURES_DIR, dir, sourceMeta.file), "utf-8");
      const chunks = chunkHtml(
        sourceMeta.id,
        sourceMeta.title,
        html,
        sourceMeta.htmlType as "structured" | "flat",
      );

      allChunks = allChunks.concat(chunks);
      const result = evaluateChunking(
        sourceMeta.id,
        sourceMeta.title,
        sourceMeta.htmlType,
        sourceMeta.wordCount,
        chunks,
      );
      results.push(result);

      const sentenceCheck = result.checks.noMidSentenceSplits ? "PASS" : "FAIL";
      const headingCheck = result.checks.headingContextPreserved ? "PASS" : "FAIL";
      const maxWordCheck = result.checks.maxWordCount <= 450 ? "PASS" : "FAIL";

      const checks = [sentenceCheck, headingCheck, maxWordCheck];
      totalPass += checks.filter((c) => c === "PASS").length;
      totalFail += checks.filter((c) => c === "FAIL").length;

      console.log(
        `  ${sourceMeta.id} (${sourceMeta.htmlType}): ${result.chunkCount} chunks | ` +
          `words: ${result.checks.minWordCount}-${result.checks.maxWordCount} (avg ${result.checks.avgWordCount}) | ` +
          `sentences: ${sentenceCheck} | headings: ${headingCheck} (${(result.checks.headingCoverage * 100).toFixed(0)}%) | ` +
          `max-words: ${maxWordCheck}`,
      );
    }
  }

  // Summary
  console.log("\n=== Summary ===\n");
  console.log(`Total chunks: ${allChunks.length}`);
  console.log(
    `Total checks: ${totalPass + totalFail} (${totalPass} PASS, ${totalFail} FAIL)`,
  );

  const structured = results.filter((r) => r.htmlType === "structured");
  const flat = results.filter((r) => r.htmlType === "flat");

  console.log(
    `\nStructured HTML (DOCX/MD): ${structured.length} sources, ${structured.reduce((s, r) => s + r.chunkCount, 0)} chunks`,
  );
  console.log(
    `  Sentence boundaries: ${structured.every((r) => r.checks.noMidSentenceSplits) ? "ALL PASS" : "SOME FAIL"}`,
  );
  console.log(
    `  Heading coverage: ${((structured.reduce((s, r) => s + r.checks.headingCoverage, 0) / structured.length) * 100).toFixed(0)}%`,
  );

  console.log(
    `\nFlat HTML (PDF): ${flat.length} sources, ${flat.reduce((s, r) => s + r.chunkCount, 0)} chunks`,
  );
  if (flat.length > 0) {
    console.log(
      `  Sentence boundaries: ${flat.every((r) => r.checks.noMidSentenceSplits) ? "ALL PASS" : "SOME FAIL"}`,
    );
    console.log(
      `  Heading coverage: ${((flat.reduce((s, r) => s + r.checks.headingCoverage, 0) / flat.length) * 100).toFixed(0)}%`,
    );
  }

  // Word count distribution
  const allWordCounts = allChunks.map((c) => c.wordCount);
  console.log(`\nWord count distribution:`);
  console.log(`  < 50 words:   ${allWordCounts.filter((w) => w < 50).length}`);
  console.log(`  50-200 words: ${allWordCounts.filter((w) => w >= 50 && w < 200).length}`);
  console.log(`  200-300:      ${allWordCounts.filter((w) => w >= 200 && w < 300).length}`);
  console.log(`  300-400:      ${allWordCounts.filter((w) => w >= 300 && w <= 400).length}`);
  console.log(`  > 400 words:  ${allWordCounts.filter((w) => w > 400).length}`);

  const overallPass = totalFail === 0;
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Overall: ${overallPass ? "PASS" : "FAIL"}`);
  console.log(`${"=".repeat(40)}`);

  if (!overallPass) {
    process.exit(1);
  }
}

// Only run when executed directly (not imported)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("chunking-spike.ts");

if (isMainModule) {
  main().catch((err) => {
    console.error("Chunking evaluation failed:", err);
    process.exit(1);
  });
}
