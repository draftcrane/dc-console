import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:test";
import {
  ResearchQueryService,
  NoSourcesError,
  type ResearchQueryInput,
  _chunkSourceContent as chunkSourceContent,
  _parseSnippetResponse as parseSnippetResponse,
  type _SourceContent as SourceContent,
} from "../src/services/research-query.js";
import { seedUser, seedProject, seedSourceWithContent, cleanAll } from "./helpers/seed.js";

// ── Mock fetch for OpenAI API ──

function mockOpenAIResponse(result: {
  snippets: Array<{
    content: string;
    sourceId: string;
    sourceTitle: string;
    sourceLocation: string;
    relevance: string;
  }>;
  summary: string;
  noResults: boolean;
}): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify(result),
          },
        },
      ],
      usage: { prompt_tokens: 500, completion_tokens: 100 },
    }),
    text: async () => JSON.stringify(result),
  } as unknown as Response;
}

function mockOpenAIError(status: number): Response {
  return {
    ok: false,
    status,
    text: async () => "API Error",
    json: async () => ({ error: "API Error" }),
  } as unknown as Response;
}

// ── Unit tests: chunking ──

describe("chunkSourceContent", () => {
  it("splits content into chunks", () => {
    const source: SourceContent = {
      sourceId: "src-1",
      sourceTitle: "Test Source",
      content: "First paragraph of content.\n\nSecond paragraph of content.",
    };
    const chunks = chunkSourceContent(source);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].sourceId).toBe("src-1");
    expect(chunks[0].sourceTitle).toBe("Test Source");
  });

  it("returns empty for empty content", () => {
    const source: SourceContent = {
      sourceId: "src-1",
      sourceTitle: "Empty",
      content: "",
    };
    const chunks = chunkSourceContent(source);
    expect(chunks).toHaveLength(0);
  });

  it("strips HTML tags before chunking", () => {
    const source: SourceContent = {
      sourceId: "src-1",
      sourceTitle: "HTML Source",
      content: "<p>Hello <strong>world</strong></p><p>Second paragraph</p>",
    };
    const chunks = chunkSourceContent(source);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].text).not.toContain("<p>");
    expect(chunks[0].text).not.toContain("<strong>");
  });

  it("creates multiple chunks for large content", () => {
    // Create content with multiple paragraphs that together exceed MAX_CHUNK_SIZE (3000 chars)
    // Each paragraph is ~500 chars, so 10 paragraphs = ~5000 chars across multiple chunks
    const paragraph = "This is a test sentence with some content for chunking. ".repeat(10);
    const paragraphs = Array.from({ length: 10 }, () => paragraph).join("\n\n");
    const source: SourceContent = {
      sourceId: "src-1",
      sourceTitle: "Long Source",
      content: paragraphs,
    };
    const chunks = chunkSourceContent(source);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("includes heading chain with section numbers", () => {
    const source: SourceContent = {
      sourceId: "src-1",
      sourceTitle: "Doc",
      content: "Some content here.",
    };
    const chunks = chunkSourceContent(source);
    expect(chunks[0].headingChain).toContain("Section 1");
  });
});

// ── Unit tests: snippet parsing ──

describe("parseSnippetResponse", () => {
  it("parses valid JSON response", () => {
    const raw = JSON.stringify({
      snippets: [
        {
          content: "Test content",
          sourceId: "src-1",
          sourceTitle: "Source One",
          sourceLocation: "Chapter 1",
          relevance: "Relevant because...",
        },
      ],
      summary: "A summary",
      noResults: false,
    });
    const result = parseSnippetResponse(raw);
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0].content).toBe("Test content");
    expect(result.snippets[0].sourceId).toBe("src-1");
    expect(result.summary).toBe("A summary");
    expect(result.noResults).toBe(false);
  });

  it("handles markdown fences", () => {
    const raw = '```json\n{"snippets":[],"summary":"None","noResults":true}\n```';
    const result = parseSnippetResponse(raw);
    expect(result.noResults).toBe(true);
    expect(result.snippets).toHaveLength(0);
  });

  it("handles snake_case fields", () => {
    const raw = JSON.stringify({
      snippets: [
        {
          content: "Content",
          source_id: "src-1",
          source_title: "Title",
          source_location: "Location",
          relevance: "Why",
        },
      ],
      summary: "Sum",
      no_results: false,
    });
    const result = parseSnippetResponse(raw);
    expect(result.snippets[0].sourceId).toBe("src-1");
    expect(result.snippets[0].sourceTitle).toBe("Title");
    expect(result.snippets[0].sourceLocation).toBe("Location");
  });

  it("returns noResults true for empty snippets array", () => {
    const raw = JSON.stringify({
      snippets: [],
      summary: "Nothing found",
      noResults: true,
    });
    const result = parseSnippetResponse(raw);
    expect(result.noResults).toBe(true);
    expect(result.snippets).toHaveLength(0);
  });

  it("skips snippets missing content or sourceId", () => {
    const raw = JSON.stringify({
      snippets: [
        { content: "", sourceId: "src-1", sourceTitle: "T", relevance: "R" },
        { content: "Valid", sourceId: "", sourceTitle: "T", relevance: "R" },
        { content: "Good", sourceId: "src-2", sourceTitle: "T2", relevance: "R" },
      ],
      summary: "Sum",
      noResults: false,
    });
    const result = parseSnippetResponse(raw);
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0].sourceId).toBe("src-2");
  });

  it("limits to MAX_SNIPPETS (8)", () => {
    const snippets = Array.from({ length: 12 }, (_, i) => ({
      content: `Content ${i}`,
      sourceId: `src-${i}`,
      sourceTitle: `Title ${i}`,
      sourceLocation: "Location",
      relevance: "Why",
    }));
    const raw = JSON.stringify({ snippets, summary: "Sum", noResults: false });
    const result = parseSnippetResponse(raw);
    expect(result.snippets).toHaveLength(8);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseSnippetResponse("not json")).toThrow();
  });

  it("returns empty snippets for missing snippets array", () => {
    const raw = JSON.stringify({ summary: "Sum", noResults: true });
    const result = parseSnippetResponse(raw);
    expect(result.snippets).toHaveLength(0);
    expect(result.noResults).toBe(true);
  });
});

// ── Service-level tests ──

describe("ResearchQueryService", () => {
  let service: ResearchQueryService;
  let userId: string;
  let projectId: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;

    service = new ResearchQueryService(env.DB, env.EXPORTS_BUCKET, "test-api-key", "test-model");
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /** Replace global fetch with a mock that returns the given response */
  function mockFetch(response: Response | Promise<Response>) {
    globalThis.fetch = (async () => response) as typeof globalThis.fetch;
  }

  describe("validateInput", () => {
    it("returns null for valid input", () => {
      const result = service.validateInput({ query: "What is photosynthesis?" });
      expect(result).toBeNull();
    });

    it("returns error for empty query", () => {
      const result = service.validateInput({ query: "" });
      expect(result).toBe("Query is required");
    });

    it("returns error for whitespace-only query", () => {
      const result = service.validateInput({ query: "   " });
      expect(result).toBe("Query is required");
    });

    it("returns error for query over 1000 chars", () => {
      const result = service.validateInput({ query: "x".repeat(1001) });
      expect(result).toBe("Query must be at most 1000 characters");
    });

    it("returns null for query exactly at 1000 chars", () => {
      const result = service.validateInput({ query: "x".repeat(1000) });
      expect(result).toBeNull();
    });

    it("returns error for non-array sourceIds", () => {
      const result = service.validateInput({
        query: "test",
        sourceIds: "not-an-array" as unknown as string[],
      });
      expect(result).toBe("sourceIds must be an array");
    });

    it("returns null for valid sourceIds array", () => {
      const result = service.validateInput({
        query: "test",
        sourceIds: ["src-1", "src-2"],
      });
      expect(result).toBeNull();
    });
  });

  describe("collectSourceContent", () => {
    it("returns content for sources with cached content in R2", async () => {
      await seedSourceWithContent(projectId, "Hello world content");
      const contents = await service.collectSourceContent(userId, projectId);
      expect(contents).toHaveLength(1);
      expect(contents[0].content).toBe("Hello world content");
    });

    it("returns empty for project with no sources", async () => {
      const contents = await service.collectSourceContent(userId, projectId);
      expect(contents).toHaveLength(0);
    });

    it("filters by sourceIds when provided", async () => {
      const src1 = await seedSourceWithContent(projectId, "Content one", { title: "Src 1" });
      await seedSourceWithContent(projectId, "Content two", {
        title: "Src 2",
        sortOrder: 2,
      });

      const contents = await service.collectSourceContent(userId, projectId, [src1.id]);
      expect(contents).toHaveLength(1);
      expect(contents[0].sourceTitle).toBe("Src 1");
    });

    it("ignores sources from other users projects", async () => {
      const otherUser = await seedUser();
      const otherProject = await seedProject(otherUser.id);
      await seedSourceWithContent(otherProject.id, "Other user content");

      const contents = await service.collectSourceContent(userId, projectId);
      expect(contents).toHaveLength(0);
    });
  });

  describe("executeQuery", () => {
    it("executes a query and returns structured results", async () => {
      await seedSourceWithContent(
        projectId,
        "Photosynthesis is the process by which plants convert sunlight into energy.",
        {
          id: "src-photo",
          title: "Biology Notes",
        },
      );

      mockFetch(
        mockOpenAIResponse({
          snippets: [
            {
              content:
                "Photosynthesis is the process by which plants convert sunlight into energy.",
              sourceId: "src-photo",
              sourceTitle: "Biology Notes",
              sourceLocation: "Section 1",
              relevance: "Directly answers the query",
            },
          ],
          summary: "The source explains photosynthesis as energy conversion by plants.",
          noResults: false,
        }),
      );

      const { result, queryId, latencyMs } = await service.executeQuery(userId, projectId, {
        query: "What is photosynthesis?",
      });

      expect(result.snippets).toHaveLength(1);
      expect(result.snippets[0].sourceId).toBe("src-photo");
      expect(result.summary).toContain("photosynthesis");
      expect(queryId).toBeDefined();
      expect(latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("throws NoSourcesError when no sources have content", async () => {
      await expect(service.executeQuery(userId, projectId, { query: "test" })).rejects.toThrow(
        NoSourcesError,
      );
    });

    it("records query metadata in D1", async () => {
      await seedSourceWithContent(projectId, "Some content");

      mockFetch(
        mockOpenAIResponse({
          snippets: [],
          summary: "No results",
          noResults: true,
        }),
      );

      const { queryId } = await service.executeQuery(userId, projectId, {
        query: "Find something",
      });

      const row = await env.DB.prepare(
        `SELECT id, user_id, project_id, query, model, status FROM research_queries WHERE id = ?`,
      )
        .bind(queryId)
        .first<{
          id: string;
          user_id: string;
          project_id: string;
          query: string;
          model: string;
          status: string;
        }>();

      expect(row).not.toBeNull();
      expect(row!.user_id).toBe(userId);
      expect(row!.project_id).toBe(projectId);
      expect(row!.query).toBe("Find something");
      expect(row!.model).toBe("test-model");
      expect(row!.status).toBe("completed");
    });

    it("records error status on AI provider failure", async () => {
      await seedSourceWithContent(projectId, "Some content");
      mockFetch(mockOpenAIError(500));

      await expect(service.executeQuery(userId, projectId, { query: "test" })).rejects.toThrow();

      const row = await env.DB.prepare(
        `SELECT status, error_message FROM research_queries WHERE project_id = ?`,
      )
        .bind(projectId)
        .first<{ status: string; error_message: string }>();

      expect(row!.status).toBe("error");
      expect(row!.error_message).toContain("AI provider error");
    });
  });

  describe("buildSSEStream", () => {
    it("produces correctly formatted SSE events", async () => {
      const result = {
        snippets: [
          {
            content: "Test content",
            sourceId: "src-1",
            sourceTitle: "Source One",
            sourceLocation: "Section 1" as string | null,
          },
        ],
        summary: "A summary",
        noResults: false,
      };

      const stream = service.buildSSEStream(result, "qry-123", 1500);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      // Parse SSE events
      const events = fullText.split("\n\n").filter((e) => e.trim().length > 0);

      // First event: result
      expect(events[0]).toContain("event: result");
      expect(events[0]).toContain('"sourceId":"src-1"');

      // Second event: done
      expect(events[1]).toContain("event: done");
      expect(events[1]).toContain('"resultCount":1');
      expect(events[1]).toContain('"processingTimeMs":1500');
      expect(events[1]).toContain('"queryId":"qry-123"');
    });

    it("emits done event with zero results for noResults response", async () => {
      const result = {
        snippets: [],
        summary: "Nothing found",
        noResults: true,
      };

      const stream = service.buildSSEStream(result, "qry-456", 500);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      expect(fullText).toContain("event: done");
      expect(fullText).toContain('"resultCount":0');
    });
  });

  describe("buildJsonResponse", () => {
    it("returns structured JSON response", () => {
      const result = {
        snippets: [
          {
            content: "Test",
            sourceId: "s1",
            sourceTitle: "Title",
            sourceLocation: null,
          },
        ],
        summary: "Sum",
        noResults: false,
      };

      const json = service.buildJsonResponse(result, 2000);
      expect(json.results).toHaveLength(1);
      expect(json.summary).toBe("Sum");
      expect(json.processingTimeMs).toBe(2000);
    });
  });
});
