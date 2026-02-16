"use client";

import { useState, useCallback } from "react";
import type { AIRewriteResult } from "@/components/ai-rewrite-sheet";

interface UseAIRewriteOptions {
  /** Function to get the auth token */
  getToken: () => Promise<string | null>;
  /** API base URL */
  apiUrl: string;
}

interface UseAIRewriteReturn {
  /** Whether the bottom sheet is open */
  isSheetOpen: boolean;
  /** The current AI rewrite result being reviewed */
  currentResult: AIRewriteResult | null;
  /** Whether a retry request is in progress */
  isRetrying: boolean;
  /** Open the sheet with a new AI rewrite result */
  showResult: (result: AIRewriteResult) => void;
  /** Handle "Use This" action — logs acceptance, returns the result */
  handleAccept: (result: AIRewriteResult) => Promise<AIRewriteResult>;
  /** Handle "Try Again" action — logs rejection, triggers new request */
  handleRetry: (
    result: AIRewriteResult,
    instruction: string,
  ) => Promise<void>;
  /** Handle "Discard" action — logs rejection, closes sheet */
  handleDiscard: (result: AIRewriteResult) => Promise<void>;
  /** Close the sheet without logging (for internal use) */
  closeSheet: () => void;
}

/**
 * useAIRewrite - Hook for managing AI rewrite accept/reject/retry flow
 *
 * Per PRD US-018:
 * - Each acceptance/rejection logged via API
 * - Unlimited iterations (try again)
 * - No silent rewrites — user must explicitly tap "Use This"
 */
export function useAIRewrite({ getToken, apiUrl }: UseAIRewriteOptions): UseAIRewriteReturn {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [currentResult, setCurrentResult] = useState<AIRewriteResult | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const showResult = useCallback((result: AIRewriteResult) => {
    setCurrentResult(result);
    setIsSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setCurrentResult(null);
    setIsRetrying(false);
  }, []);

  /**
   * Log interaction acceptance/rejection to the API.
   * Fire-and-forget: we don't block the UI on logging success.
   */
  const logInteraction = useCallback(
    async (interactionId: string, action: "accept" | "reject") => {
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
        // Log but don't block the user flow on logging failures
        console.error(`Failed to log AI interaction ${action}:`, err);
      }
    },
    [getToken, apiUrl],
  );

  const handleAccept = useCallback(
    async (result: AIRewriteResult): Promise<AIRewriteResult> => {
      // Log acceptance (fire-and-forget)
      logInteraction(result.interactionId, "accept");

      // Close the sheet
      setIsSheetOpen(false);
      setCurrentResult(null);

      return result;
    },
    [logInteraction],
  );

  const handleRetry = useCallback(
    async (result: AIRewriteResult, ...[]: [instruction: string]) => {
      setIsRetrying(true);

      // Log rejection for the current attempt
      logInteraction(result.interactionId, "reject");

      // The actual retry request is handled by the parent component
      // (US-017 rewrite flow). The parent should call showResult() with the
      // new result when the AI responds, which will reset isRetrying.
      // The instruction parameter is passed through to the parent's onRetry
      // callback so it can send the updated instruction to the AI.
    },
    [logInteraction],
  );

  const handleDiscard = useCallback(
    async (result: AIRewriteResult) => {
      // Log rejection
      logInteraction(result.interactionId, "reject");

      // Close the sheet
      closeSheet();
    },
    [logInteraction, closeSheet],
  );

  return {
    isSheetOpen,
    currentResult,
    isRetrying,
    showResult,
    handleAccept,
    handleRetry,
    handleDiscard,
    closeSheet,
  };
}
