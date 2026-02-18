"use client";

import { useState, useCallback, useRef } from "react";
import type { AIRewriteResult } from "@/components/ai-rewrite-sheet";

export type SheetState = "idle" | "streaming" | "complete";

interface UseAIRewriteOptions {
  /** Function to get the auth token */
  getToken: () => Promise<string | null>;
  /** API base URL */
  apiUrl: string;
}

interface UseAIRewriteReturn {
  /** Current state of the AI rewrite sheet */
  sheetState: SheetState;
  /** The current AI rewrite result being reviewed */
  currentResult: AIRewriteResult | null;
  /** Error message to display inline in the sheet */
  errorMessage: string | null;
  /** Transition idle → streaming: opens sheet immediately with placeholder */
  startStreaming: (originalText: string, instruction: string, tier: "edge" | "frontier") => void;
  /** Append a token to the streaming result */
  appendToken: (text: string) => void;
  /** Transition streaming → complete: finalize the result */
  completeStreaming: (interactionId: string, attemptNumber: number) => void;
  /** Abort streaming: show error or close sheet */
  abortStreaming: (errorMessage?: string) => void;
  /** Handle "Use This" action — logs acceptance, returns the result */
  handleAccept: (result: AIRewriteResult) => Promise<AIRewriteResult>;
  /** Handle "Try Again" action — logs rejection, triggers new request */
  handleRetry: (result: AIRewriteResult, instruction: string) => Promise<void>;
  /** Handle "Discard" / "Cancel" action — logs rejection if complete, closes sheet */
  handleDiscard: (result: AIRewriteResult) => Promise<void>;
  /** Close the sheet and reset all state */
  closeSheet: () => void;
  /** Update the tier on the current result (called when server reports actual tier) */
  setTier: (tier: "edge" | "frontier") => void;
  /** Check if any tokens have been accumulated */
  hasTokens: () => boolean;
}

/**
 * useAIRewrite - Hook for managing AI rewrite accept/reject/retry flow
 *
 * Models the sheet as a three-state machine: idle → streaming → complete.
 * Streaming state opens the sheet immediately and shows tokens progressively.
 *
 * Per PRD US-018:
 * - Each acceptance/rejection logged via API
 * - Unlimited iterations (try again)
 * - No silent rewrites — user must explicitly tap "Use This"
 */
export function useAIRewrite({ getToken, apiUrl }: UseAIRewriteOptions): UseAIRewriteReturn {
  const [sheetState, setSheetState] = useState<SheetState>("idle");
  const [currentResult, setCurrentResult] = useState<AIRewriteResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Accumulate streamed text in a ref for performance (avoid re-render per token)
  const streamedTextRef = useRef("");

  const startStreaming = useCallback(
    (originalText: string, instruction: string, tier: "edge" | "frontier") => {
      streamedTextRef.current = "";
      setErrorMessage(null);
      setCurrentResult({
        interactionId: "",
        originalText,
        rewriteText: "",
        instruction,
        attemptNumber: 0,
        tier,
      });
      setSheetState("streaming");
    },
    [],
  );

  const appendToken = useCallback((text: string) => {
    streamedTextRef.current += text;
    setCurrentResult((prev) => {
      if (!prev) return prev;
      return { ...prev, rewriteText: streamedTextRef.current };
    });
  }, []);

  const completeStreaming = useCallback((interactionId: string, attemptNumber: number) => {
    setCurrentResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        interactionId,
        attemptNumber,
        rewriteText: streamedTextRef.current,
      };
    });
    setSheetState("complete");
  }, []);

  const abortStreaming = useCallback((msg?: string) => {
    if (msg && streamedTextRef.current) {
      // Have partial text — show error inline, keep sheet open
      setErrorMessage(msg);
      setSheetState("complete");
    } else if (msg) {
      // No text yet — show error inline briefly then close
      setErrorMessage(msg);
      setSheetState("complete");
    } else {
      // Clean abort (user cancelled)
      setSheetState("idle");
      setCurrentResult(null);
      setErrorMessage(null);
    }
  }, []);

  const closeSheet = useCallback(() => {
    setSheetState("idle");
    setCurrentResult(null);
    setErrorMessage(null);
    streamedTextRef.current = "";
  }, []);

  /**
   * Log interaction acceptance/rejection to the API.
   * Fire-and-forget: we don't block the UI on logging success.
   */
  const logInteraction = useCallback(
    async (interactionId: string, action: "accept" | "reject") => {
      if (!interactionId) return;
      try {
        const token = await getToken();
        if (!token) return;

        await fetch(`${apiUrl}/ai/interactions/${interactionId}/${action}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (err) {
        console.error(`Failed to log AI interaction ${action}:`, err);
      }
    },
    [getToken, apiUrl],
  );

  const handleAccept = useCallback(
    async (result: AIRewriteResult): Promise<AIRewriteResult> => {
      logInteraction(result.interactionId, "accept");
      closeSheet();
      return result;
    },
    [logInteraction, closeSheet],
  );

  const handleRetry = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (result: AIRewriteResult, _instruction: string) => {
      logInteraction(result.interactionId, "reject");
      // Transition back to streaming — caller will initiate new request
      // startStreaming will be called by the page's requestRewrite
    },
    [logInteraction],
  );

  const handleDiscard = useCallback(
    async (result: AIRewriteResult) => {
      if (result.interactionId) {
        logInteraction(result.interactionId, "reject");
      }
      closeSheet();
    },
    [logInteraction, closeSheet],
  );

  const setTier = useCallback((tier: "edge" | "frontier") => {
    setCurrentResult((prev) => {
      if (!prev) return prev;
      return { ...prev, tier };
    });
  }, []);

  const hasTokens = useCallback(() => {
    return streamedTextRef.current.length > 0;
  }, []);

  return {
    sheetState,
    currentResult,
    errorMessage,
    startStreaming,
    appendToken,
    completeStreaming,
    abortStreaming,
    handleAccept,
    handleRetry,
    handleDiscard,
    closeSheet,
    setTier,
    hasTokens,
  };
}
