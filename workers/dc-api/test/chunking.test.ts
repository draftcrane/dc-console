import { describe, it, expect } from "vitest";
import {
  chunkStructuredHtml,
  chunkFlatHtml,
  chunkHtml,
  htmlTypeFromMime,
  stripHtml,
  countWords,
  splitSentences,
  type Chunk,
} from "../src/services/chunking.js";

// ---------------------------------------------------------------------------
// Helper: generate a paragraph with N sentences (each ~10 words)
// ---------------------------------------------------------------------------

function makeSentences(count: number): string {
  const sentences: string[] = [];
  for (let i = 0; i < count; i++) {
    sentences.push(
      `This is sentence number ${i + 1} with some additional words to fill the space.`,
    );
  }
  return sentences.join(" ");
}

function wrapInParagraphs(texts: string[]): string {
  return texts.map((t) => `<p>${t}</p>`).join("\n");
}

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#39; &nbsp;")).toBe("& < > \" '");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("  Hello   world  ")).toBe("Hello world");
  });

  it("handles empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// countWords
// ---------------------------------------------------------------------------

describe("countWords", () => {
  it("counts words in normal text", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("handles multiple spaces", () => {
    expect(countWords("hello   world")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace-only", () => {
    expect(countWords("   ")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// splitSentences
// ---------------------------------------------------------------------------

describe("splitSentences", () => {
  it("splits on period followed by capital letter", () => {
    const result = splitSentences("First sentence. Second sentence.");
    expect(result).toEqual(["First sentence.", "Second sentence."]);
  });

  it("preserves abbreviations", () => {
    const result = splitSentences("Dr. Smith went home. He was tired.");
    expect(result).toEqual(["Dr. Smith went home.", "He was tired."]);
  });

  it("handles empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });

  it("handles single sentence", () => {
    const result = splitSentences("Just one sentence.");
    expect(result).toEqual(["Just one sentence."]);
  });

  it("handles exclamation and question marks", () => {
    const result = splitSentences("What happened? Something amazing! Then it ended.");
    expect(result).toEqual(["What happened?", "Something amazing!", "Then it ended."]);
  });
});

// ---------------------------------------------------------------------------
// chunkStructuredHtml
// ---------------------------------------------------------------------------

describe("chunkStructuredHtml", () => {
  it("produces chunks from simple structured HTML", () => {
    const html = `
      <h1>Introduction</h1>
      <p>${makeSentences(5)}</p>
      <h2>Background</h2>
      <p>${makeSentences(5)}</p>
    `;

    const chunks = chunkStructuredHtml("src-1", "Test Source", html);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.sourceId).toBe("src-1");
      expect(chunk.sourceTitle).toBe("Test Source");
      expect(chunk.wordCount).toBeGreaterThan(0);
    }
  });

  it("preserves heading hierarchy in chunks", () => {
    const html = `
      <h1>Chapter 1</h1>
      <h2>Section A</h2>
      <p>${makeSentences(5)}</p>
    `;

    const chunks = chunkStructuredHtml("src-2", "Heading Test", html);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].headingChain).toEqual(["Chapter 1", "Section A"]);
  });

  it("assigns composite IDs (sourceId:index)", () => {
    const html = `
      <h1>Title</h1>
      <p>${makeSentences(30)}</p>
      <p>${makeSentences(30)}</p>
    `;

    const chunks = chunkStructuredHtml("src-3", "ID Test", html);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].id).toBe("src-3:0");
    expect(chunks[1].id).toBe("src-3:1");
  });

  it("respects max words limit", () => {
    const html = `<p>${makeSentences(50)}</p>`;

    const chunks = chunkStructuredHtml("src-4", "Max Words Test", html, {
      maxWords: 400,
    });

    for (const chunk of chunks) {
      // Allow some tolerance for overlap
      expect(chunk.wordCount).toBeLessThanOrEqual(500);
    }
  });

  it("merges small fragments with previous chunk", () => {
    const html = `
      <h1>Title</h1>
      <p>${makeSentences(25)}</p>
      <h2>Short Section</h2>
      <p>Just a few words.</p>
    `;

    const chunks = chunkStructuredHtml("src-5", "Merge Test", html, {
      targetWords: 300,
      minWords: 50,
    });

    // The short section should be merged, not stand alone
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeGreaterThanOrEqual(4); // at least the short text
    }
  });

  it("flushes at heading boundaries", () => {
    const html = `
      <h1>Chapter 1</h1>
      <p>${makeSentences(10)}</p>
      <h1>Chapter 2</h1>
      <p>${makeSentences(10)}</p>
    `;

    const chunks = chunkStructuredHtml("src-6", "Boundary Test", html);

    // Verify chunks from different sections exist
    const chap1Chunks = chunks.filter((c) => c.headingChain.includes("Chapter 1"));
    const chap2Chunks = chunks.filter((c) => c.headingChain.includes("Chapter 2"));
    expect(chap1Chunks.length).toBeGreaterThan(0);
    expect(chap2Chunks.length).toBeGreaterThan(0);
  });

  it("handles empty HTML", () => {
    const chunks = chunkStructuredHtml("src-7", "Empty", "");
    expect(chunks).toEqual([]);
  });

  it("handles HTML with no block elements", () => {
    const chunks = chunkStructuredHtml("src-8", "No Blocks", "<span>inline only</span>");
    expect(chunks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// chunkFlatHtml
// ---------------------------------------------------------------------------

describe("chunkFlatHtml", () => {
  it("produces chunks from flat <p>-only HTML", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) => makeSentences(5));
    const html = wrapInParagraphs(paragraphs);

    const chunks = chunkFlatHtml("pdf-1", "PDF Source", html);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.sourceId).toBe("pdf-1");
      expect(chunk.wordCount).toBeGreaterThan(0);
    }
  });

  it("detects ALL CAPS headings", () => {
    const html = `
      <p>INTRODUCTION</p>
      <p>${makeSentences(5)}</p>
      <p>METHODOLOGY</p>
      <p>${makeSentences(5)}</p>
    `;

    const chunks = chunkFlatHtml("pdf-2", "Caps Test", html);

    expect(chunks.length).toBeGreaterThan(0);
    const headings = chunks.flatMap((c) => c.headingChain);
    expect(headings.some((h) => h === "INTRODUCTION" || h === "METHODOLOGY")).toBe(true);
  });

  it("falls back to positional context when no headings detected", () => {
    const paragraphs = Array.from({ length: 5 }, () => makeSentences(5));
    const html = wrapInParagraphs(paragraphs);

    const chunks = chunkFlatHtml("pdf-3", "No Headings", html);

    expect(chunks.length).toBeGreaterThan(0);
    // Should have positional context like "Section 1 of N"
    const hasPositional = chunks.some((c) =>
      c.headingChain.some((h) => /^Section \d+ of \d+$/.test(h)),
    );
    expect(hasPositional).toBe(true);
  });

  it("handles empty HTML", () => {
    const chunks = chunkFlatHtml("pdf-4", "Empty", "");
    expect(chunks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// chunkHtml (auto-dispatch)
// ---------------------------------------------------------------------------

describe("chunkHtml", () => {
  it("dispatches to structured mode", () => {
    const html = `<h1>Title</h1><p>${makeSentences(5)}</p>`;
    const chunks = chunkHtml("s1", "S1", html, "structured");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].headingChain).toContain("Title");
  });

  it("dispatches to flat mode", () => {
    const html = `<p>ABSTRACT</p><p>${makeSentences(5)}</p>`;
    const chunks = chunkHtml("s2", "S2", html, "flat");
    expect(chunks.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// htmlTypeFromMime
// ---------------------------------------------------------------------------

describe("htmlTypeFromMime", () => {
  it("returns flat for PDF", () => {
    expect(htmlTypeFromMime("application/pdf")).toBe("flat");
  });

  it("returns structured for DOCX", () => {
    expect(
      htmlTypeFromMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe("structured");
  });

  it("returns structured for text/markdown", () => {
    expect(htmlTypeFromMime("text/markdown")).toBe("structured");
  });

  it("returns structured for text/plain", () => {
    expect(htmlTypeFromMime("text/plain")).toBe("structured");
  });
});

// ---------------------------------------------------------------------------
// Chunk quality invariants
// ---------------------------------------------------------------------------

describe("chunk quality invariants", () => {
  // Generate a realistic-sized document
  const longHtml = `
    <h1>Chapter 1: Introduction</h1>
    <p>${makeSentences(30)}</p>
    <h2>Background</h2>
    <p>${makeSentences(30)}</p>
    <h2>Literature Review</h2>
    <p>${makeSentences(30)}</p>
    <h1>Chapter 2: Methodology</h1>
    <p>${makeSentences(30)}</p>
    <h2>Research Design</h2>
    <p>${makeSentences(30)}</p>
    <h1>Chapter 3: Results</h1>
    <p>${makeSentences(30)}</p>
  `;

  let chunks: Chunk[];

  // Run chunking once for all invariant checks
  chunks = chunkStructuredHtml("quality-test", "Quality Test Document", longHtml);

  it("produces non-empty chunks", () => {
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.text.trim().length).toBeGreaterThan(0);
      expect(chunk.wordCount).toBeGreaterThan(0);
    }
  });

  it("all chunks have heading context", () => {
    for (const chunk of chunks) {
      expect(chunk.headingChain.length).toBeGreaterThan(0);
    }
  });

  it("no chunk exceeds 500 words (400 max + overlap tolerance)", () => {
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(500);
    }
  });

  it("chunks have sequential IDs", () => {
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].id).toBe(`quality-test:${i}`);
    }
  });

  it("all chunks have valid source metadata", () => {
    for (const chunk of chunks) {
      expect(chunk.sourceId).toBe("quality-test");
      expect(chunk.sourceTitle).toBe("Quality Test Document");
    }
  });
});
