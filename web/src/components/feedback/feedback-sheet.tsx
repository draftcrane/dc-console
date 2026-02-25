"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useToast } from "@/components/toast";
import { useFeedbackContext } from "@/hooks/use-feedback-context";
import { useFocusTrap } from "@/hooks/use-focus-trap";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type FeedbackType = "bug" | "suggestion";

interface FeedbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * FeedbackSheet - Bottom sheet for submitting bug reports and feature suggestions (#338).
 *
 * Follows the standard bottom sheet pattern:
 * - Fixed bottom-0, rounded-t-2xl, max-h-[80vh]
 * - Backdrop with click-to-close
 * - Focus trap (Tab/Shift+Tab cycle, Escape to close)
 * - Body scroll lock
 * - Safe area inset for iPad home indicator
 * - sheet-slide-up animation from globals.css
 *
 * Two-step flow: select type (bug/suggestion) -> describe -> submit.
 * Context is auto-captured at submission time via useFeedbackContext().
 */
export function FeedbackSheet({ isOpen, onClose }: FeedbackSheetProps) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const { collectContext } = useFeedbackContext();

  const sheetRef = useFocusTrap({ isOpen, onEscape: onClose });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [type, setType] = useState<FeedbackType | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);

  // Track landscape/portrait for side sheet vs bottom sheet
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    setIsLandscape(query.matches);
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setType(null);
      setDescription("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Body scroll lock
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

  const handleSubmit = useCallback(async () => {
    if (!type || description.trim().length < 10) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const context = collectContext();

      const response = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          description: description.trim(),
          context,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to submit feedback");
      }

      onClose();
      showToast("Thanks for your feedback");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [type, description, getToken, collectContext, onClose, showToast]);

  if (!isOpen) return null;

  const canSubmit = type !== null && description.trim().length >= 10 && !isSubmitting;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — bottom (portrait) or side (landscape) */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report a problem"
        className={
          isLandscape
            ? "fixed inset-y-0 right-0 z-50 w-full max-w-[380px] bg-white rounded-l-2xl shadow-2xl border-l border-gray-200 sheet-slide-right flex flex-col"
            : "fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 sheet-slide-up max-h-[80vh] flex flex-col"
        }
      >
        {/* Drag handle — portrait only */}
        {!isLandscape && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden="true" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-3 pt-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Report a Problem</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors -mr-2"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {/* Type selector - radio cards */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">
              What kind of feedback?
            </legend>
            <div className="grid grid-cols-2 gap-3" role="radiogroup">
              {/* Bug card */}
              <button
                type="button"
                role="radio"
                aria-checked={type === "bug"}
                onClick={() => {
                  setType("bug");
                  // Focus textarea after selecting type
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                className={`flex items-center gap-2 rounded-lg border p-3 min-h-[44px] text-sm font-medium
                           transition-colors ${
                             type === "bug"
                               ? "border-red-200 bg-red-50 text-red-600"
                               : "border-gray-300 text-gray-700 hover:bg-gray-50"
                           }`}
              >
                {/* Bug icon */}
                <svg
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Something broke
              </button>

              {/* Suggestion card */}
              <button
                type="button"
                role="radio"
                aria-checked={type === "suggestion"}
                onClick={() => {
                  setType("suggestion");
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                className={`flex items-center gap-2 rounded-lg border p-3 min-h-[44px] text-sm font-medium
                           transition-colors ${
                             type === "suggestion"
                               ? "border-blue-200 bg-blue-50 text-blue-600"
                               : "border-gray-300 text-gray-700 hover:bg-gray-50"
                           }`}
              >
                {/* Lightbulb icon */}
                <svg
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                I have an idea
              </button>
            </div>
          </fieldset>

          {/* Description textarea */}
          <div>
            <label
              htmlFor="feedback-description"
              className="text-sm font-medium text-gray-700 mb-2 block"
            >
              Tell us more
            </label>
            <textarea
              ref={textareaRef}
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder={
                type === "bug"
                  ? "What happened? What did you expect?"
                  : "What would make DraftCrane better for you?"
              }
              maxLength={2000}
              className="w-full min-h-[120px] rounded-lg border border-gray-300 p-3 text-base leading-relaxed
                         placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed
                         resize-none"
              style={{ fontSize: "16px" }}
            />
            {/* Character count hint */}
            {description.length > 0 && description.trim().length < 10 && (
              <p className="mt-1 text-xs text-gray-400">
                {10 - description.trim().length} more characters needed
              </p>
            )}
          </div>

          {/* Context disclosure */}
          <p className="flex items-start gap-1.5 text-xs text-gray-400">
            <svg
              className="h-3.5 w-3.5 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Includes your browser and page info to help us investigate.
          </p>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Submit button */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-11 rounded-lg bg-gray-900 text-sm font-medium text-white
                       hover:bg-gray-800 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Sending..." : "Send Report"}
          </button>
        </div>

        {/* Safe area for devices with home indicators */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </>
  );
}
