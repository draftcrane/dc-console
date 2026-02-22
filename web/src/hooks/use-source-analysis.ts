"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Timeout for analysis requests (30s) */
const ANALYSIS_TIMEOUT_MS = 30_000;

interface UseSourceAnalysisReturn {
  analyze: (projectId: string, sourceId: string, instruction: string) => void;
  streamingText: string;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  reset: () => void;
  abort: () => void;
}

/**
 * Hook for AI-powered source analysis with SSE streaming.
 *
 * Follows the same SSE pattern as use-editor-ai.ts:
 * - fetch() with AbortController (not EventSource)
 * - Read stream with getReader(), decode chunks
 * - Accumulate tokens in ref for performance
 * - Set state on animation frames for smooth rendering
 *
 * Error handling:
 * - 30s timeout via AbortController signal
 * - On connection drop mid-stream, preserves partial streamingText
 * - Sets error with retry affordance message
 */
export function useSourceAnalysis(): UseSourceAnalysisReturn {
  const { getToken } = useAuth();
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const textRef = useRef("");
  const rafRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      setStreamingText(textRef.current);
      rafRef.current = null;
    });
  }, []);

  const analyze = useCallback(
    async (projectId: string, sourceId: string, instruction: string) => {
      // Abort any existing request
      abortControllerRef.current?.abort();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Set up timeout
      const timeout = setTimeout(() => {
        abortController.abort();
      }, ANALYSIS_TIMEOUT_MS);

      // Reset state
      textRef.current = "";
      setStreamingText("");
      setIsStreaming(true);
      setIsComplete(false);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          setError("Authentication required");
          setIsStreaming(false);
          clearTimeout(timeout);
          return;
        }

        const response = await fetch(`${API_URL}/projects/${projectId}/research/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sourceId, instruction }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          if (response.status === 429) {
            setError("Rate limit reached. Please wait a moment.");
          } else {
            const body = await response.json().catch(() => null);
            setError(
              (body as { error?: string } | null)?.error || "Analysis failed. Tap to retry.",
            );
          }
          setIsStreaming(false);
          clearTimeout(timeout);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setError("No response received");
          setIsStreaming(false);
          clearTimeout(timeout);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data) as {
                type: string;
                text?: string;
                message?: string;
              };

              if (event.type === "token" && event.text) {
                textRef.current += event.text;
                scheduleUpdate();
              }

              if (event.type === "error" && event.message) {
                setError(event.message);
                setIsStreaming(false);
                setIsComplete(true);
                clearTimeout(timeout);
                return;
              }

              if (event.type === "done") {
                // Handled below after loop
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Ensure final text is flushed
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setStreamingText(textRef.current);
        setIsStreaming(false);
        setIsComplete(true);
        clearTimeout(timeout);
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error).name === "AbortError") {
          // Preserve partial text
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setStreamingText(textRef.current);
          setIsStreaming(false);

          if (textRef.current) {
            // Partial result — determine if it was a timeout or user abort
            setError("Analysis timed out. Tap to retry.");
            setIsComplete(true);
          } else {
            // No text yet — silent abort
            setError(null);
            setIsComplete(false);
          }
          return;
        }
        console.error("Analysis streaming error:", err);
        // Preserve any partial text
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setStreamingText(textRef.current);
        setError("Connection lost. Tap to retry.");
        setIsStreaming(false);
        setIsComplete(true);
      }
    },
    [getToken, scheduleUpdate],
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    textRef.current = "";
    setStreamingText("");
    setIsStreaming(false);
    setIsComplete(false);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    analyze,
    streamingText,
    isStreaming,
    isComplete,
    error,
    reset,
    abort,
  };
}
