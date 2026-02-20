import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock useAuth from Clerk
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
}));

import { useAIResearch, snippetKey, type ResearchSnippet } from "@/hooks/use-ai-research";

// === Helpers ===

function createSSEResponse(events: Array<{ event: string; data: Record<string, unknown> }>) {
  const lines = events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function createErrorResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// === Tests ===

describe("useAIResearch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid-1234");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in idle state with empty conversation", () => {
    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    expect(result.current.state).toBe("idle");
    expect(result.current.conversation).toEqual([]);
    expect(result.current.queryInput).toBe("");
    expect(result.current.currentResult).toBeNull();
    expect(result.current.noSources).toBe(false);
  });

  it("does not submit empty query", async () => {
    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  it("does not submit whitespace-only query", async () => {
    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("   ");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits query and processes SSE result events", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([
        {
          event: "result",
          data: {
            content: "Test passage about leadership",
            sourceId: "src-1",
            sourceTitle: "Leadership Notes",
            sourceLocation: "Page 5",
            relevance: 0.95,
          },
        },
        {
          event: "result",
          data: {
            content: "Another passage about teams",
            sourceId: "src-2",
            sourceTitle: "Team Report",
            sourceLocation: null,
            relevance: 0.85,
          },
        },
        {
          event: "done",
          data: {
            resultCount: 2,
            summary: "Found passages about leadership",
            processingTimeMs: 1500,
            sourceCount: 5,
          },
        },
      ]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("What about leadership?");
    });

    expect(result.current.state).toBe("complete");
    expect(result.current.conversation).toHaveLength(1);
    expect(result.current.conversation[0].query).toBe("What about leadership?");

    const queryResult = result.current.conversation[0].result;
    expect(queryResult.snippets).toHaveLength(2);
    expect(queryResult.snippets[0].content).toBe("Test passage about leadership");
    expect(queryResult.snippets[0].sourceTitle).toBe("Leadership Notes");
    expect(queryResult.snippets[1].content).toBe("Another passage about teams");
    expect(queryResult.resultCount).toBe(2);
    expect(queryResult.isStreaming).toBe(false);
    expect(queryResult.noResults).toBe(false);
    expect(result.current.sourceCount).toBe(5);
  });

  it("handles no-results response", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([
        {
          event: "done",
          data: { resultCount: 0, processingTimeMs: 800 },
        },
      ]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Something obscure");
    });

    expect(result.current.state).toBe("complete");
    expect(result.current.conversation).toHaveLength(1);
    expect(result.current.conversation[0].result.noResults).toBe(true);
    expect(result.current.conversation[0].result.snippets).toHaveLength(0);
  });

  it("handles NO_SOURCES error from response status", async () => {
    fetchSpy.mockResolvedValueOnce(
      createErrorResponse(400, { error: "No sources", code: "NO_SOURCES" }),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test query");
    });

    expect(result.current.noSources).toBe(true);
    expect(result.current.state).toBe("error");
    expect(result.current.conversation).toHaveLength(0);
  });

  it("handles NO_SOURCES error from SSE event", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([
        {
          event: "error",
          data: { error: "No sources available", code: "NO_SOURCES" },
        },
      ]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test query");
    });

    expect(result.current.noSources).toBe(true);
    expect(result.current.state).toBe("error");
    expect(result.current.conversation).toHaveLength(0);
  });

  it("handles rate limit (429) error", async () => {
    fetchSpy.mockResolvedValueOnce(createErrorResponse(429, { error: "Too many requests" }));

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test query");
    });

    expect(result.current.state).toBe("error");
    expect(result.current.errorMessage).toBe("Too many requests");
    expect(result.current.conversation).toHaveLength(1);
    expect(result.current.conversation[0].result.error).toBe("Too many requests");
  });

  it("handles generic server error", async () => {
    fetchSpy.mockResolvedValueOnce(createErrorResponse(500, { error: "Internal error" }));

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test query");
    });

    expect(result.current.state).toBe("error");
    expect(result.current.errorMessage).toBe("Internal error");
  });

  it("handles network error", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test query");
    });

    expect(result.current.state).toBe("error");
    expect(result.current.errorMessage).toBe("Connection error. Please try again.");
  });

  it("manages query input state", () => {
    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    act(() => {
      result.current.setQueryInput("My question");
    });

    expect(result.current.queryInput).toBe("My question");
  });

  it("clears input after submission from queryInput", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([{ event: "done", data: { resultCount: 0 } }]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    act(() => {
      result.current.setQueryInput("My question");
    });

    await act(async () => {
      result.current.submitQuery();
    });

    expect(result.current.queryInput).toBe("");
  });

  it("does not clear input when explicit query is given", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([{ event: "done", data: { resultCount: 0 } }]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    act(() => {
      result.current.setQueryInput("Preserved input");
    });

    await act(async () => {
      result.current.submitQuery("Explicit query");
    });

    // When an explicit query is given, it is not cleared from the box
    // (since it wasn't set by the user typing)
    expect(result.current.queryInput).toBe("Preserved input");
  });

  it("retry re-submits the last query", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("Network error")).mockResolvedValueOnce(
      createSSEResponse([
        {
          event: "result",
          data: { content: "Result", sourceId: "s1", sourceTitle: "S1" },
        },
        { event: "done", data: { resultCount: 1 } },
      ]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test query");
    });

    expect(result.current.state).toBe("error");

    await act(async () => {
      result.current.retry();
    });

    expect(result.current.state).toBe("complete");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("maintains conversation history across queries", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        createSSEResponse([
          {
            event: "result",
            data: { content: "First result", sourceId: "s1", sourceTitle: "S1" },
          },
          { event: "done", data: { resultCount: 1 } },
        ]),
      )
      .mockResolvedValueOnce(
        createSSEResponse([
          {
            event: "result",
            data: { content: "Second result", sourceId: "s2", sourceTitle: "S2" },
          },
          { event: "done", data: { resultCount: 1 } },
        ]),
      );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("First question");
    });

    await act(async () => {
      result.current.submitQuery("Second question");
    });

    expect(result.current.conversation).toHaveLength(2);
    expect(result.current.conversation[0].query).toBe("First question");
    expect(result.current.conversation[1].query).toBe("Second question");
  });

  it("saves snippet to clips and tracks saved key", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "clip-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    const snippet: ResearchSnippet = {
      content: "Test content",
      sourceId: "src-1",
      sourceTitle: "Test Source",
      sourceLocation: "Page 1",
      relevance: 0.9,
    };

    let saveResult: { success: boolean; clipId?: string } | undefined;
    await act(async () => {
      saveResult = await result.current.saveToClips(snippet);
    });

    expect(saveResult!.success).toBe(true);
    expect(saveResult!.clipId).toBe("clip-1");
    expect(result.current.savedSnippetKeys.has(snippetKey(snippet))).toBe(true);
  });

  it("handles save-to-clips failure", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    const snippet: ResearchSnippet = {
      content: "Test content",
      sourceId: "src-1",
      sourceTitle: "Test Source",
      sourceLocation: null,
      relevance: 0.9,
    };

    let saveResult: { success: boolean } | undefined;
    await act(async () => {
      saveResult = await result.current.saveToClips(snippet);
    });

    expect(saveResult!.success).toBe(false);
  });

  it("sends correct request headers for SSE", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([{ event: "done", data: { resultCount: 0 } }]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test");
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/projects/proj-1/research/query"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("SSE error event sets error state", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([
        {
          event: "error",
          data: { error: "AI service unavailable", code: "AI_UNAVAILABLE" },
        },
      ]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test");
    });

    expect(result.current.state).toBe("error");
    expect(result.current.errorMessage).toBe("AI service unavailable");
  });

  it("currentResult reflects the latest conversation entry", async () => {
    fetchSpy.mockResolvedValueOnce(
      createSSEResponse([
        {
          event: "result",
          data: { content: "Result text", sourceId: "s1", sourceTitle: "S1" },
        },
        { event: "done", data: { resultCount: 1 } },
      ]),
    );

    const { result } = renderHook(() => useAIResearch({ projectId: "proj-1" }));

    await act(async () => {
      result.current.submitQuery("Test query");
    });

    expect(result.current.currentResult).not.toBeNull();
    expect(result.current.currentResult!.snippets).toHaveLength(1);
    expect(result.current.currentResult!.query).toBe("Test query");
  });
});

describe("snippetKey", () => {
  it("generates key from sourceId and content prefix", () => {
    const snippet: ResearchSnippet = {
      content: "A".repeat(200),
      sourceId: "src-1",
      sourceTitle: "Title",
      sourceLocation: null,
      relevance: 0.9,
    };
    const key = snippetKey(snippet);
    expect(key).toBe(`src-1:${"A".repeat(100)}`);
  });

  it("handles null sourceId", () => {
    const snippet: ResearchSnippet = {
      content: "Some content",
      sourceId: null,
      sourceTitle: "Title",
      sourceLocation: null,
      relevance: 0.9,
    };
    const key = snippetKey(snippet);
    expect(key).toBe(":Some content");
  });

  it("handles short content", () => {
    const snippet: ResearchSnippet = {
      content: "Short",
      sourceId: "s1",
      sourceTitle: "Title",
      sourceLocation: null,
      relevance: 0.9,
    };
    expect(snippetKey(snippet)).toBe("s1:Short");
  });
});
