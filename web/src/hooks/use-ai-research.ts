"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// === Types ===

export interface ResearchSnippet {
  content: string;
  sourceId: string | null;
  sourceTitle: string;
  sourceLocation: string | null;
  relevance: number;
}

export interface ResearchQueryResult {
  id: string;
  query: string;
  snippets: ResearchSnippet[];
  summary: string | null;
  noResults: boolean;
  error: string | null;
  isStreaming: boolean;
  resultCount: number;
  processingTimeMs: number | null;
}

export type ResearchQueryState = "idle" | "streaming" | "complete" | "error";

export interface ConversationEntry {
  id: string;
  query: string;
  result: ResearchQueryResult;
}

interface UseAIResearchOptions {
  projectId: string;
}

export interface UseAIResearchReturn {
  /** Current query state */
  state: ResearchQueryState;
  /** Current query input value */
  queryInput: string;
  /** Update query input value */
  setQueryInput: (value: string) => void;
  /** Submit a query */
  submitQuery: (query?: string) => void;
  /** Retry the last failed query */
  retry: () => void;
  /** Conversation history (Q&A pairs) */
  conversation: ConversationEntry[];
  /** Current streaming result (latest entry) */
  currentResult: ResearchQueryResult | null;
  /** Error message for the latest query */
  errorMessage: string | null;
  /** Whether the project has no sources */
  noSources: boolean;
  /** Source count for loading message */
  sourceCount: number | null;
  /** Abort current streaming request */
  abort: () => void;
  /** Save a snippet to clips */
  saveToClips: (
    snippet: ResearchSnippet,
    chapterId?: string,
  ) => Promise<{ success: boolean; clipId?: string }>;
  /** Track which snippets have been saved */
  savedSnippetKeys: Set<string>;
}

/** Generate a unique key for a snippet (for dedup tracking) */
export function snippetKey(snippet: ResearchSnippet): string {
  return `${snippet.sourceId || ""}:${snippet.content.slice(0, 100)}`;
}

/**
 * Parse an SSE stream into event+data pairs.
 * SSE format: "event: <type>\ndata: <json>\n\n"
 *
 * Yields { eventType, data } for each complete event.
 */
async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<{ eventType: string; data: string }> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data && currentEventType) {
          yield { eventType: currentEventType, data };
          currentEventType = "";
        }
      } else if (line === "") {
        // Empty line marks end of an event block
        currentEventType = "";
      }
    }
  }

  // Flush any remaining buffer
  if (buffer.trim()) {
    const lines = buffer.split("\n");
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data && currentEventType) {
          yield { eventType: currentEventType, data };
        }
      }
    }
  }
}

/**
 * useAIResearch - Hook for managing natural language research queries
 * with SSE streaming, conversation history, and clip saving.
 *
 * Handles:
 * - SSE stream consumption from POST /projects/:projectId/research/query
 * - Progressive result card rendering as events arrive
 * - Conversation history within session
 * - Error states (no sources, AI failure, network error)
 * - Clip saving via POST /projects/:projectId/research/clips
 */
export function useAIResearch({ projectId }: UseAIResearchOptions): UseAIResearchReturn {
  const { getToken } = useAuth();
  const [state, setState] = useState<ResearchQueryState>("idle");
  const [queryInput, setQueryInput] = useState("");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noSources, setNoSources] = useState(false);
  const [sourceCount, setSourceCount] = useState<number | null>(null);
  const [savedSnippetKeys, setSavedSnippetKeys] = useState<Set<string>>(new Set());

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<string>("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState((prev) => (prev === "streaming" ? "error" : prev));
  }, []);

  /** Update a specific conversation entry's result */
  const updateResult = useCallback((entryId: string, updates: Partial<ResearchQueryResult>) => {
    setConversation((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, result: { ...entry.result, ...updates } } : entry,
      ),
    );
  }, []);

  const submitQuery = useCallback(
    async (explicitQuery?: string) => {
      const query = (explicitQuery ?? queryInput).trim();
      if (!query) return;

      // Abort previous request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      lastQueryRef.current = query;
      setErrorMessage(null);
      setNoSources(false);
      setState("streaming");

      // Create a new result entry
      const entryId = crypto.randomUUID();
      const newResult: ResearchQueryResult = {
        id: entryId,
        query,
        snippets: [],
        summary: null,
        noResults: false,
        error: null,
        isStreaming: true,
        resultCount: 0,
        processingTimeMs: null,
      };

      setConversation((prev) => [...prev, { id: entryId, query, result: newResult }]);

      // Clear input after submission
      if (!explicitQuery) {
        setQueryInput("");
      }

      try {
        const token = await getToken();
        if (!token) {
          updateResult(entryId, { error: "Authentication required", isStreaming: false });
          setState("error");
          setErrorMessage("Authentication required");
          return;
        }

        const response = await fetch(`${API_URL}/projects/${projectId}/research/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ query }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const serverError = (body as { error?: string; code?: string } | null) ?? {};

          if (serverError.code === "NO_SOURCES") {
            setNoSources(true);
            setConversation((prev) => prev.filter((e) => e.id !== entryId));
            setState("error");
            return;
          }

          if (response.status === 429) {
            const msg = serverError.error || "Too many requests. Please wait a moment.";
            updateResult(entryId, { error: msg, isStreaming: false });
            setState("error");
            setErrorMessage(msg);
            return;
          }

          const msg = serverError.error || "Something went wrong. Please try again.";
          updateResult(entryId, { error: msg, isStreaming: false });
          setState("error");
          setErrorMessage(msg);
          return;
        }

        // Parse SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          updateResult(entryId, { error: "No response received", isStreaming: false });
          setState("error");
          setErrorMessage("No response received");
          return;
        }

        const snippets: ResearchSnippet[] = [];

        for await (const { eventType, data } of parseSSEStream(reader)) {
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;

            switch (eventType) {
              case "result": {
                const snippet: ResearchSnippet = {
                  content: (parsed.content as string) || "",
                  sourceId: (parsed.sourceId as string) || null,
                  sourceTitle: (parsed.sourceTitle as string) || "",
                  sourceLocation: (parsed.sourceLocation as string) || null,
                  relevance: (parsed.relevance as number) || 0,
                };
                snippets.push(snippet);
                updateResult(entryId, {
                  snippets: [...snippets],
                  resultCount: snippets.length,
                });
                break;
              }
              case "done": {
                const doneData = parsed as {
                  resultCount?: number;
                  summary?: string;
                  processingTimeMs?: number;
                  sourceCount?: number;
                };
                if (doneData.sourceCount) {
                  setSourceCount(doneData.sourceCount);
                }
                updateResult(entryId, {
                  summary: (doneData.summary as string) || null,
                  processingTimeMs: (doneData.processingTimeMs as number) || null,
                  resultCount: (doneData.resultCount as number) ?? snippets.length,
                  isStreaming: false,
                  noResults: snippets.length === 0,
                });
                break;
              }
              case "error": {
                const errorData = parsed as { error?: string; code?: string };
                if (errorData.code === "NO_SOURCES") {
                  setNoSources(true);
                  setConversation((prev) => prev.filter((e) => e.id !== entryId));
                } else {
                  const msg = errorData.error || "Something went wrong. Please try again.";
                  updateResult(entryId, { error: msg, isStreaming: false });
                  setErrorMessage(msg);
                }
                setState("error");
                return;
              }
            }
          } catch {
            // Skip malformed JSON in SSE data
          }
        }

        // Finalize if no done event was received
        updateResult(entryId, {
          isStreaming: false,
          noResults: snippets.length === 0,
        });
        setState("complete");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setConversation((prev) => prev.filter((e) => e.id !== entryId));
          setState("idle");
          return;
        }

        console.error("Research query error:", err);
        updateResult(entryId, {
          error: "Connection error. Please try again.",
          isStreaming: false,
        });
        setState("error");
        setErrorMessage("Connection error. Please try again.");
      }
    },
    [queryInput, projectId, getToken, updateResult],
  );

  const retry = useCallback(() => {
    if (lastQueryRef.current) {
      submitQuery(lastQueryRef.current);
    }
  }, [submitQuery]);

  const saveToClips = useCallback(
    async (
      snippet: ResearchSnippet,
      chapterId?: string,
    ): Promise<{ success: boolean; clipId?: string }> => {
      try {
        const token = await getToken();
        if (!token) return { success: false };

        const response = await fetch(`${API_URL}/projects/${projectId}/research/clips`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: snippet.content,
            sourceId: snippet.sourceId,
            sourceTitle: snippet.sourceTitle,
            sourceLocation: snippet.sourceLocation,
            chapterId: chapterId || null,
          }),
        });

        if (!response.ok) {
          return { success: false };
        }

        const data = (await response.json()) as { id?: string };
        const key = snippetKey(snippet);
        setSavedSnippetKeys((prev) => new Set([...prev, key]));
        return { success: true, clipId: data.id };
      } catch {
        return { success: false };
      }
    },
    [getToken, projectId],
  );

  const currentResult =
    conversation.length > 0 ? conversation[conversation.length - 1].result : null;

  return {
    state,
    queryInput,
    setQueryInput,
    submitQuery,
    retry,
    conversation,
    currentResult,
    errorMessage,
    noSources,
    sourceCount,
    abort,
    saveToClips,
    savedSnippetKeys,
  };
}
