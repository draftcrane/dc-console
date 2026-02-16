"use client";

import { useEffect, useRef, useCallback, useState } from "react";

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
}

interface AIRewriteSheetProps {
  /** Whether the bottom sheet is open */
  isOpen: boolean;
  /** The current AI rewrite result to display */
  result: AIRewriteResult | null;
  /** Whether a retry request is currently loading */
  isRetrying: boolean;
  /** Called when user taps "Use This" — accepts the rewrite */
  onAccept: (result: AIRewriteResult) => void;
  /** Called when user taps "Try Again" — sends a new request with updated instruction */
  onRetry: (result: AIRewriteResult, instruction: string) => void;
  /** Called when user taps "Discard" or clicks outside — closes with no changes */
  onDiscard: (result: AIRewriteResult) => void;
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
 */
export function AIRewriteSheet({
  isOpen,
  result,
  isRetrying,
  onAccept,
  onRetry,
  onDiscard,
}: AIRewriteSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);
  const [editedInstruction, setEditedInstruction] = useState("");
  const [lastResultId, setLastResultId] = useState<string | null>(null);

  // Sync instruction field when a new result arrives (tracked by interactionId)
  if (result && result.interactionId !== lastResultId) {
    setEditedInstruction(result.instruction);
    setLastResultId(result.interactionId);
  }

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
    onRetry(result, editedInstruction);
  };

  const handleDiscard = () => {
    onDiscard(result);
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
            <h2 className="text-lg font-semibold text-gray-900">AI Rewrite</h2>
            <span className="text-sm text-gray-500">Attempt {result.attemptNumber}</span>
          </div>
        </div>

        {/* Scrollable content: original and rewrite side by side */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* Original text */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Original</h3>
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {result.originalText}
            </div>
          </div>

          {/* AI Rewrite */}
          <div>
            <h3 className="text-sm font-medium text-blue-600 mb-2">Rewrite</h3>
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-900 leading-relaxed whitespace-pre-wrap border border-blue-100">
              {result.rewriteText}
            </div>
          </div>

          {/* Editable instruction field */}
          <div>
            <label
              htmlFor="ai-instruction"
              className="text-sm font-medium text-gray-500 mb-2 block"
            >
              Instruction
            </label>
            <textarea
              ref={firstFocusableRef}
              id="ai-instruction"
              value={editedInstruction}
              onChange={(e) => setEditedInstruction(e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900
                         leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent min-h-[60px]"
              placeholder="Adjust your instruction and try again..."
              rows={2}
              disabled={isRetrying}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {/* Discard */}
          <button
            onClick={handleDiscard}
            disabled={isRetrying}
            className="flex-1 h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700
                       hover:bg-gray-50 transition-colors min-w-[44px] min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Discard rewrite and close"
          >
            Discard
          </button>

          {/* Try Again */}
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 h-11 rounded-lg border border-blue-300 text-sm font-medium text-blue-700
                       hover:bg-blue-50 transition-colors min-w-[44px] min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Try again with current instruction"
          >
            {isRetrying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                Retrying...
              </span>
            ) : (
              "Try Again"
            )}
          </button>

          {/* Use This (primary action) */}
          <button
            ref={lastFocusableRef}
            onClick={handleAccept}
            disabled={isRetrying}
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
