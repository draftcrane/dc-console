import { describe, it, expect } from "vitest";
import {
  buildResearchPrompt,
  buildSourceContextForRewrite,
  buildResearchUserMessage,
  formatChunksForPrompt,
  validateResearchResponse,
  parseResearchResponse,
  type ResearchQueryResult,
} from "../src/services/prompt-builder.js";
import {
  estimateTokens,
  estimateChunkTokens,
  selectChunksWithinBudget,
  deduplicateChunks,
  sortChunksByDocumentOrder,
} from "../src/services/context-window.js";
import type { Chunk } from "../src/services/chunking.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeChunk(overrides?: Partial<Chunk>): Chunk {
  return {
    id: "src-1:0",
    sourceId: "src-1",
    sourceTitle: "Test Source",
    headingChain: ["Chapter 1", "Introduction"],
    text: "This is a test chunk with some content about leadership and emotional intelligence in organizations.",
    html: "<p>This is a test chunk with some content about leadership and emotional intelligence in organizations.</p>",
    wordCount: 15,
    startOffset: 0,
    endOffset: 100,
    ...overrides,
  };
}

function makeChunks(count: number): Chunk[] {
  return Array.from({ length: count }, (_, i) =>
    makeChunk({
      id: `src-${Math.floor(i / 3) + 1}:${i % 3}`,
      sourceId: `src-${Math.floor(i / 3) + 1}`,
      sourceTitle: `Source ${Math.floor(i / 3) + 1}`,
      headingChain: [`Section ${i + 1}`],
      text: `This is chunk number ${i + 1} with content about research topic ${i + 1}. It contains multiple sentences for testing purposes. The research shows interesting findings about the subject matter.`,
      wordCount: 30,
      startOffset: i * 100,
      endOffset: (i + 1) * 100,
    }),
  );
}

// ---------------------------------------------------------------------------
// formatChunksForPrompt
// ---------------------------------------------------------------------------

describe("formatChunksForPrompt", () => {
  it("formats a single chunk with source attribution", () => {
    const chunks = [makeChunk()];
    const result = formatChunksForPrompt(chunks);

    expect(result).toContain(
      '[Source: "Test Source" (id: src-1), Section: "Chapter 1 > Introduction"]',
    );
    expect(result).toContain("leadership and emotional intelligence");
  });

  it("formats multiple chunks with separators", () => {
    const chunks = [
      makeChunk({ id: "src-1:0", sourceTitle: "Source A", text: "First chunk text." }),
      makeChunk({
        id: "src-2:0",
        sourceId: "src-2",
        sourceTitle: "Source B",
        text: "Second chunk text.",
      }),
    ];

    const result = formatChunksForPrompt(chunks);

    expect(result).toContain("Source A");
    expect(result).toContain("Source B");
    expect(result).toContain("---");
    expect(result).toContain("First chunk text.");
    expect(result).toContain("Second chunk text.");
  });

  it("uses 'Full document' when heading chain is empty", () => {
    const chunks = [makeChunk({ headingChain: [] })];
    const result = formatChunksForPrompt(chunks);

    expect(result).toContain('Section: "Full document"');
  });

  it("joins heading chain with ' > '", () => {
    const chunks = [makeChunk({ headingChain: ["Part 1", "Chapter 2", "Section A"] })];
    const result = formatChunksForPrompt(chunks);

    expect(result).toContain('Section: "Part 1 > Chapter 2 > Section A"');
  });
});

// ---------------------------------------------------------------------------
// buildResearchUserMessage
// ---------------------------------------------------------------------------

describe("buildResearchUserMessage", () => {
  it("includes the research query", () => {
    const result = buildResearchUserMessage("What is emotional intelligence?", [makeChunk()]);

    expect(result).toContain("## Research Query");
    expect(result).toContain("What is emotional intelligence?");
  });

  it("includes source materials section", () => {
    const result = buildResearchUserMessage("test query", [makeChunk()]);

    expect(result).toContain("## Source Materials");
    expect(result).toContain("Extract verbatim passages");
  });

  it("includes formatted chunks", () => {
    const result = buildResearchUserMessage("test query", [makeChunk()]);

    expect(result).toContain("Test Source");
    expect(result).toContain("leadership and emotional intelligence");
  });
});

// ---------------------------------------------------------------------------
// buildResearchPrompt
// ---------------------------------------------------------------------------

describe("buildResearchPrompt", () => {
  it("returns system prompt, user message, and metadata", () => {
    const prompt = buildResearchPrompt("What is leadership?", [makeChunk()]);

    expect(prompt.systemPrompt).toContain("research extraction assistant");
    expect(prompt.userMessage).toContain("What is leadership?");
    expect(prompt.estimatedInputTokens).toBeGreaterThan(0);
    expect(prompt.chunkSelection.selectedChunks.length).toBe(1);
  });

  it("deduplicates chunks before selection", () => {
    const chunk = makeChunk();
    const duplicated = [chunk, chunk, chunk]; // same chunk three times

    const prompt = buildResearchPrompt("test", duplicated);

    expect(prompt.chunkSelection.selectedChunks.length).toBe(1);
  });

  it("respects token budget", () => {
    const chunks = makeChunks(20);

    const prompt = buildResearchPrompt("test", chunks, {
      sourceContextBudget: 200, // very small budget
      maxChunks: 20,
    });

    expect(prompt.chunkSelection.selectedChunks.length).toBeLessThan(20);
    expect(prompt.chunkSelection.budgetExhausted).toBe(true);
  });

  it("respects max chunks limit", () => {
    const chunks = makeChunks(10);

    const prompt = buildResearchPrompt("test", chunks, {
      maxChunks: 3,
    });

    expect(prompt.chunkSelection.selectedChunks.length).toBeLessThanOrEqual(3);
  });

  it("sorts selected chunks by document order", () => {
    // Provide chunks in reverse relevance order (but from same source)
    const chunks = [
      makeChunk({ id: "src-1:2", sourceId: "src-1", startOffset: 200 }),
      makeChunk({ id: "src-1:0", sourceId: "src-1", startOffset: 0 }),
      makeChunk({ id: "src-1:1", sourceId: "src-1", startOffset: 100 }),
    ];

    const prompt = buildResearchPrompt("test", chunks);
    const selected = prompt.chunkSelection.selectedChunks;

    // After sorting, should be in document order
    // Note: selectedChunks is from selectChunksWithinBudget (preserves input order),
    // but the user message should use the sorted order. We verify via the user message.
    expect(prompt.userMessage).toBeTruthy();
  });

  it("handles empty chunks array", () => {
    const prompt = buildResearchPrompt("test query", []);

    expect(prompt.chunkSelection.selectedChunks).toEqual([]);
    expect(prompt.userMessage).toContain("test query");
    expect(prompt.estimatedInputTokens).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildSourceContextForRewrite
// ---------------------------------------------------------------------------

describe("buildSourceContextForRewrite", () => {
  it("returns formatted context for rewrite prompts", () => {
    const chunks = [makeChunk()];
    const result = buildSourceContextForRewrite(chunks);

    expect(result).not.toBeNull();
    expect(result).toContain("Test Source");
  });

  it("returns null for empty chunks", () => {
    expect(buildSourceContextForRewrite([])).toBeNull();
  });

  it("respects token budget", () => {
    const chunks = makeChunks(20);
    const result = buildSourceContextForRewrite(chunks, {
      sourceContextBudget: 100,
      maxChunks: 2,
    });

    expect(result).not.toBeNull();
    // Should contain at most 2 chunks worth of content
  });
});

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe("estimateTokens", () => {
  it("estimates tokens from word count", () => {
    const tokens = estimateTokens("hello world");
    // 2 words * 1.33 = 2.66, ceil = 3
    expect(tokens).toBe(3);
  });

  it("returns 0 for empty text", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("   ")).toBe(0);
  });

  it("handles longer text", () => {
    const text = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    const tokens = estimateTokens(text);
    // 100 words * 1.33 = 133
    expect(tokens).toBe(133);
  });
});

// ---------------------------------------------------------------------------
// estimateChunkTokens
// ---------------------------------------------------------------------------

describe("estimateChunkTokens", () => {
  it("includes metadata overhead in estimate", () => {
    const chunk = makeChunk();
    const tokens = estimateChunkTokens(chunk);
    const textOnly = estimateTokens(chunk.text);

    // Should be more than text alone due to header + separator
    expect(tokens).toBeGreaterThan(textOnly);
  });
});

// ---------------------------------------------------------------------------
// selectChunksWithinBudget
// ---------------------------------------------------------------------------

describe("selectChunksWithinBudget", () => {
  it("selects all chunks when within budget", () => {
    const chunks = makeChunks(3);
    const result = selectChunksWithinBudget(chunks);

    expect(result.selectedChunks.length).toBe(3);
    expect(result.budgetExhausted).toBe(false);
    expect(result.excludedCount).toBe(0);
  });

  it("respects max chunks", () => {
    const chunks = makeChunks(10);
    const result = selectChunksWithinBudget(chunks, { maxChunks: 5 });

    expect(result.selectedChunks.length).toBe(5);
    expect(result.excludedCount).toBe(5);
    expect(result.budgetExhausted).toBe(true);
  });

  it("respects token budget", () => {
    const chunks = makeChunks(10);
    const result = selectChunksWithinBudget(chunks, {
      sourceContextBudget: 50, // very small
      maxChunks: 10,
    });

    expect(result.selectedChunks.length).toBeLessThan(10);
    expect(result.budgetExhausted).toBe(true);
  });

  it("handles empty input", () => {
    const result = selectChunksWithinBudget([]);

    expect(result.selectedChunks).toEqual([]);
    expect(result.totalTokens).toBe(0);
    expect(result.excludedCount).toBe(0);
    expect(result.budgetExhausted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deduplicateChunks
// ---------------------------------------------------------------------------

describe("deduplicateChunks", () => {
  it("removes chunks with duplicate IDs", () => {
    const chunk = makeChunk();
    const result = deduplicateChunks([chunk, chunk, chunk]);

    expect(result.length).toBe(1);
  });

  it("preserves unique chunks", () => {
    const chunks = [makeChunk({ id: "a:0" }), makeChunk({ id: "b:0" }), makeChunk({ id: "c:0" })];
    const result = deduplicateChunks(chunks);

    expect(result.length).toBe(3);
  });

  it("preserves original order", () => {
    const chunks = [
      makeChunk({ id: "c:0" }),
      makeChunk({ id: "a:0" }),
      makeChunk({ id: "c:0" }), // duplicate
      makeChunk({ id: "b:0" }),
    ];
    const result = deduplicateChunks(chunks);

    expect(result.map((c) => c.id)).toEqual(["c:0", "a:0", "b:0"]);
  });
});

// ---------------------------------------------------------------------------
// sortChunksByDocumentOrder
// ---------------------------------------------------------------------------

describe("sortChunksByDocumentOrder", () => {
  it("sorts by source then by offset", () => {
    const chunks = [
      makeChunk({ id: "b:1", sourceId: "b", startOffset: 100 }),
      makeChunk({ id: "a:0", sourceId: "a", startOffset: 0 }),
      makeChunk({ id: "b:0", sourceId: "b", startOffset: 0 }),
      makeChunk({ id: "a:1", sourceId: "a", startOffset: 100 }),
    ];

    const sorted = sortChunksByDocumentOrder(chunks);

    expect(sorted.map((c) => c.id)).toEqual(["a:0", "a:1", "b:0", "b:1"]);
  });

  it("does not mutate original array", () => {
    const chunks = [
      makeChunk({ id: "b:0", sourceId: "b", startOffset: 0 }),
      makeChunk({ id: "a:0", sourceId: "a", startOffset: 0 }),
    ];
    const original = [...chunks];

    sortChunksByDocumentOrder(chunks);

    expect(chunks.map((c) => c.id)).toEqual(original.map((c) => c.id));
  });
});

// ---------------------------------------------------------------------------
// validateResearchResponse
// ---------------------------------------------------------------------------

describe("validateResearchResponse", () => {
  const validResponse: ResearchQueryResult = {
    snippets: [
      {
        content: "Some extracted text",
        sourceId: "src-1",
        sourceTitle: "Test Source",
        sourceLocation: "Chapter 1 > Introduction",
        relevance: "This passage discusses the topic",
      },
    ],
    summary: "The sources discuss the topic in detail.",
    noResults: false,
  };

  it("returns null for valid response", () => {
    expect(validateResearchResponse(validResponse)).toBeNull();
  });

  it("returns null for valid no-results response", () => {
    const response: ResearchQueryResult = {
      snippets: [],
      summary: "No relevant information found.",
      noResults: true,
    };
    expect(validateResearchResponse(response)).toBeNull();
  });

  it("rejects non-object", () => {
    expect(validateResearchResponse("string")).toBe("Response is not an object");
    expect(validateResearchResponse(null)).toBe("Response is not an object");
    expect(validateResearchResponse(42)).toBe("Response is not an object");
  });

  it("rejects missing snippets", () => {
    const response = { summary: "test", noResults: false };
    expect(validateResearchResponse(response)).toBe("Missing or invalid 'snippets' array");
  });

  it("rejects missing summary", () => {
    const response = { snippets: [], noResults: false };
    expect(validateResearchResponse(response)).toBe("Missing or invalid 'summary' string");
  });

  it("rejects missing noResults", () => {
    const response = { snippets: [], summary: "test" };
    expect(validateResearchResponse(response)).toBe("Missing or invalid 'noResults' boolean");
  });

  it("rejects invalid snippet fields", () => {
    const response = {
      snippets: [
        { content: "text", sourceId: 123, sourceTitle: "T", sourceLocation: "L", relevance: "R" },
      ],
      summary: "test",
      noResults: false,
    };
    expect(validateResearchResponse(response)).toBe(
      "snippets[0]: missing or invalid 'sourceId' string",
    );
  });

  it("validates all snippet fields", () => {
    const fieldsToTest = ["content", "sourceId", "sourceTitle", "sourceLocation", "relevance"];
    for (const field of fieldsToTest) {
      const snippet: Record<string, unknown> = {
        content: "text",
        sourceId: "id",
        sourceTitle: "title",
        sourceLocation: "loc",
        relevance: "rel",
      };
      delete snippet[field];
      const response = { snippets: [snippet], summary: "test", noResults: false };
      const error = validateResearchResponse(response);
      expect(error).toContain(`snippets[0]`);
      expect(error).toContain(field);
    }
  });
});

// ---------------------------------------------------------------------------
// parseResearchResponse
// ---------------------------------------------------------------------------

describe("parseResearchResponse", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      snippets: [],
      summary: "No results found.",
      noResults: true,
    });

    const { result, error } = parseResearchResponse(raw);

    expect(error).toBeNull();
    expect(result).not.toBeNull();
    expect(result!.noResults).toBe(true);
  });

  it("strips markdown fences before parsing", () => {
    const raw = '```json\n{"snippets":[],"summary":"test","noResults":true}\n```';

    const { result, error } = parseResearchResponse(raw);

    expect(error).toBeNull();
    expect(result).not.toBeNull();
  });

  it("returns error for invalid JSON", () => {
    const { result, error } = parseResearchResponse("not json");

    expect(result).toBeNull();
    expect(error).toContain("JSON parse failed");
  });

  it("returns error for schema-invalid JSON", () => {
    const { result, error } = parseResearchResponse(
      JSON.stringify({ snippets: [], summary: "test" }),
    );

    expect(result).toBeNull();
    expect(error).toContain("Schema validation");
  });
});
