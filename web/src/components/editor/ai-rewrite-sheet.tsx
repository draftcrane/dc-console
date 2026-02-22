"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { SheetState } from "@/hooks/use-ai-rewrite";

/**
 * Data representing an AI rewrite result, passed in from the parent
 * (created by the AI rewrite request flow in US-017).
 */
export interface AIRewriteResult {
  /** AI interaction ID from the API */
  interactionId: string;
  /** The original selected text before AI rewrite */
  originalText: string;
  /** The AI-generated rewrite suggestion */
  rewriteText: string;
  /** The instruction the user gave to the AI */
  instruction: string;
  /** Which attempt number this is (1-based) */
  attemptNumber: number;
  /** Which AI tier produced this result */
  tier: "edge" | "frontier";
}

interface AIRewriteSheetProps {
  /** Current state of the sheet: idle (closed), streaming, or complete */
  sheetState: SheetState;
  /** The current AI rewrite result to display */
  result: AIRewriteResult | null;
  /** Inline error message to display in the rewrite area */
  errorMessage: string | null;
  /** Called when user taps "Use This" — accepts the rewrite */
  onAccept: (result: AIRewriteResult) => void;
  /** Called when user taps "Try Again" — sends a new request with updated instruction */
  onRetry: (result: AIRewriteResult, instruction: string) => void;
  /** Called when user taps "Discard"/"Cancel" or clicks outside */
  onDiscard: (result: AIRewriteResult) => void;
  /** Called when user taps "Go Deeper" — escalate to frontier model */
  onGoDeeper?: (result: AIRewriteResult) => void;
}

/**
 * AIRewriteSheet - Bottom sheet for reviewing AI rewrite results
 *
 * Per PRD US-018:
 * - Shows three actions after AI response completes: "Use This", "Try Again", "Discard"
 * - "Use This" replaces selected text with AI result
 * - "Try Again" preserves original text, instruction field editable, new request sent
 * - "Discard" closes bottom sheet with no changes
 * - Tapping outside is equivalent to "Discard"
 * - User always sees original and rewrite simultaneously
 * - Focus trap for accessibility
 * - Unlimited iterations (try again as many times as wanted)
 *
 * Streaming enhancements:
 * - Opens immediately when streaming starts (sheetState = "streaming")
 * - Shows tokens progressively with a blinking cursor
 * - "Use This" / "Try Again" disabled during streaming; "Cancel" enabled
 * - After completion: full behavior restored
 */
export function AIRewriteSheet({
  sheetState,
  result,
  errorMessage,
  onAccept,
  onRetry,
  onDiscard,
  onGoDeeper,
}: AIRewriteSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);
  const [editedInstruction, setEditedInstruction] = useState("");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [lastResultId, setLastResultId] = useState<string | null>(null);
  const rewriteEndRef = useRef<HTMLSpanElement>(null);

  const isOpen = sheetState !== "idle";
  const isStreaming = sheetState === "streaming";
  const isComplete = sheetState === "complete";
  const [originalExpanded, setOriginalExpanded] = useState(false);

  // Sync instruction field when a new result arrives or streaming starts.
  // This uses the React-documented "adjusting state during render" pattern
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // to avoid cascading renders from effects.
  const resultId = result?.interactionId ?? null;
  const streamingKey =
    result && !result.interactionId && sheetState === "streaming" ? "streaming" : null;
  const trackingKey = resultId || streamingKey;

  if (trackingKey && trackingKey !== lastResultId) {
    if (!hasUserEdited) setEditedInstruction("");
    setHasUserEdited(false);
    setLastResultId(trackingKey);
    if (resultId) {
      const isShort = result!.originalText.split(/\s+/).length < 50;
      setOriginalExpanded(isShort);
    }
  }

  // Auto-scroll to bottom of rewrite area during streaming
  useEffect(() => {
    if (isStreaming && rewriteEndRef.current) {
      rewriteEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isStreaming, result?.rewriteText]);

  // Focus trap: trap Tab key within the bottom sheet
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || !result) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onDiscard(result);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isOpen, result, onDiscard],
  );

  // Add/remove keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      requestAnimationFrame(() => {
        firstFocusableRef.current?.focus();
      });
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !result) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onDiscard(result);
    }
  };

  const handleAccept = () => {
    onAccept(result);
  };

  const handleRetry = () => {
    onRetry(result, editedInstruction.trim() || result.instruction);
    setHasUserEdited(false);
  };

  const handleDiscard = () => {
    onDiscard(result);
  };

  const handleGoDeeper = () => {
    onGoDeeper?.(result);
  };

  return (
    <>
      {/* Backdrop - clicking outside is equivalent to "Discard" */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="AI Rewrite Result"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl
                   border-t border-gray-200 animate-slide-up
                   max-h-[80vh] flex flex-col"
      >
        {/* Drag handle indicator */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="px-6 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">AI Rewrite</h2>
              {isStreaming && (
                <span className="text-sm text-blue-600 flex items-center gap-1">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Writing...
                </span>
              )}
            </div>
            {isComplete && result.attemptNumber > 0 && (
              <span className="text-sm text-gray-500">Attempt {result.attemptNumber}</span>
            )}
          </div>
        </div>

        {/* Scrollable content: rewrite first, then original */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* AI Rewrite (primary — visible above the fold) */}
          <div>
            <h3 className="text-sm font-medium text-blue-600 mb-2">Rewrite</h3>
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-900 leading-relaxed whitespace-pre-wrap border border-blue-100 min-h-[60px]">
              {errorMessage && !result.rewriteText ? (
                <span className="text-red-600">{errorMessage}</span>
              ) : (
                <>
                  {result.rewriteText}
                  {isStreaming && (
                    <span
                      ref={rewriteEndRef}
                      className="inline-block w-0.5 h-4 bg-blue-600 ml-0.5 align-text-bottom animate-pulse"
                      aria-hidden="true"
                    />
                  )}
                  {errorMessage && result.rewriteText && (
                    <div className="mt-3 text-red-600 text-xs">{errorMessage}</div>
                  )}
                </>
              )}
              {isStreaming && !result.rewriteText && !errorMessage && (
                <span
                  ref={rewriteEndRef}
                  className="inline-block w-0.5 h-4 bg-blue-600 animate-pulse"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          {/* Original text — collapsible disclosure */}
          <div>
            <button
              type="button"
              onClick={() => setOriginalExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              aria-expanded={originalExpanded}
              aria-controls="original-text-content"
            >
              <svg
                className={`h-4 w-4 transition-transform duration-200 ${originalExpanded ? "rotate-90" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
              Original
            </button>
            {originalExpanded && (
              <div
                id="original-text-content"
                className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-[20]"
              >
                {result.originalText}
              </div>
            )}
          </div>

          {/* Editable instruction field */}
          <div>
            <label className="text-sm font-medium text-gray-500 mb-2 block">Instruction</label>
            <textarea
              ref={firstFocusableRef}
              value={editedInstruction || result.instruction}
              onChange={(e) => {
                setEditedInstruction(e.target.value);
                setHasUserEdited(true);
              }}
              disabled={isStreaming}
              className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
              rows={2}
              placeholder="Edit instruction for retry..."
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {/* Discard / Cancel */}
          <button
            onClick={handleDiscard}
            className="flex-1 h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700
                       hover:bg-gray-50 transition-colors min-w-[44px] min-h-[44px]"
            aria-label={isStreaming ? "Cancel rewrite" : "Discard rewrite and close"}
          >
            {isStreaming ? "Cancel" : "Discard"}
          </button>

          {/* Try Again */}
          <button
            onClick={handleRetry}
            disabled={isStreaming}
            className="flex-1 h-11 rounded-lg border border-blue-300 text-sm font-medium text-blue-700
                       hover:bg-blue-50 transition-colors min-w-[44px] min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Try again with current instruction"
          >
            Try Again
          </button>

          {/* Go Deeper — shown only for edge tier results that are complete */}
          {isComplete && result.tier === "edge" && onGoDeeper && (
            <button
              onClick={handleGoDeeper}
              className="flex-1 h-11 rounded-lg border border-purple-300 text-sm font-medium text-purple-700
                         hover:bg-purple-50 transition-colors min-w-[44px] min-h-[44px]"
              aria-label="Rewrite with more powerful AI model"
            >
              Go Deeper
            </button>
          )}

          {/* Use This (primary action) */}
          <button
            ref={lastFocusableRef}
            onClick={handleAccept}
            disabled={isStreaming || !result.rewriteText}
            className="flex-1 h-11 rounded-lg bg-blue-600 text-sm font-medium text-white
                       hover:bg-blue-700 transition-colors min-w-[44px] min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Use this rewrite to replace selected text"
          >
            Use This
          </button>
        </div>

        {/* Safe area for devices with home indicators */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </>
  );
}

export default AIRewriteSheet;
