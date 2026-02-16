"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Suggestion chips per PRD US-017:
 * "Simpler language" | "More concise" | "More conversational" | "Stronger" | "Expand"
 */
const SUGGESTION_CHIPS = [
  "Simpler language",
  "More concise",
  "More conversational",
  "Stronger",
  "Expand",
] as const;

interface AIRewriteSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Close the sheet */
  onClose: () => void;
  /** The selected text to rewrite */
  selectedText: string;
  /** Up to 500 chars before the selection for context */
  contextBefore: string;
  /** Up to 500 chars after the selection for context */
  contextAfter: string;
  /** Chapter title for prompt context */
  chapterTitle: string;
  /** Project description for prompt context */
  projectDescription: string;
  /** Chapter ID for logging */
  chapterId: string;
  /** Auth token getter */
  getToken: () => Promise<string | null>;
  /** Callback when the user accepts the rewrite */
  onAcceptRewrite: (newText: string) => void;
  /** API base URL */
  apiUrl: string;
}

type SheetState = "idle" | "loading" | "streaming" | "done" | "error";

/**
 * AIRewriteSheet - Bottom sheet for AI rewrite flow
 *
 * Per PRD US-017:
 * - Shows original text (read-only)
 * - Instruction text field (freeform)
 * - Suggestion chips
 * - Streams result token-by-token
 * - Loading state while waiting for first token
 * - Rate limit message when exceeded
 */
export function AIRewriteSheet({
  isOpen,
  onClose,
  selectedText,
  contextBefore,
  contextAfter,
  chapterTitle,
  projectDescription,
  chapterId,
  getToken,
  onAcceptRewrite,
  apiUrl,
}: AIRewriteSheetProps) {
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<SheetState>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Auto-scroll result area during streaming
  useEffect(() => {
    if (state === "streaming" && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [streamedText, state]);

  const handleSubmit = useCallback(
    async (instructionText: string) => {
      if (!instructionText.trim() || !selectedText.trim()) return;

      // Cancel any previous request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState("loading");
      setStreamedText("");
      setErrorMessage("");

      try {
        const token = await getToken();
        if (!token) {
          setState("error");
          setErrorMessage("Authentication required. Please sign in again.");
          return;
        }

        const response = await fetch(`${apiUrl}/ai/rewrite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            selectedText,
            instruction: instructionText,
            contextBefore,
            contextAfter,
            chapterTitle,
            projectDescription,
            chapterId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Request failed" }));
          const err = errorData as { error?: string; code?: string };

          if (response.status === 429) {
            setState("error");
            setErrorMessage(
              err.error || "You've used AI rewrite frequently. Please wait a moment.",
            );
            return;
          }

          setState("error");
          setErrorMessage(err.error || "Something went wrong. Please try again.");
          return;
        }

        // Read SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          setState("error");
          setErrorMessage("Failed to read response stream.");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let firstToken = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data) continue;

              try {
                const event = JSON.parse(data) as {
                  type: string;
                  text?: string;
                  message?: string;
                  interactionId?: string;
                };

                if (event.type === "token" && event.text) {
                  if (!firstToken) {
                    firstToken = true;
                    setState("streaming");
                  }
                  setStreamedText((prev) => prev + event.text);
                }

                if (event.type === "done") {
                  setState("done");
                }

                if (event.type === "error") {
                  setState("error");
                  setErrorMessage(event.message || "AI processing error.");
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // If we finished reading without hitting "done", mark as done
        if (firstToken) {
          setState("done");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState("error");
        setErrorMessage("Connection error. Please try again.");
      }
    },
    [
      selectedText,
      contextBefore,
      contextAfter,
      chapterTitle,
      projectDescription,
      chapterId,
      getToken,
      apiUrl,
    ],
  );

  const handleChipClick = useCallback(
    (chip: string) => {
      setInstruction(chip);
      handleSubmit(chip);
    },
    [handleSubmit],
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSubmit(instruction);
    },
    [instruction, handleSubmit],
  );

  const handleAccept = useCallback(() => {
    if (streamedText) {
      onAcceptRewrite(streamedText);
      onClose();
    }
  }, [streamedText, onAcceptRewrite, onClose]);

  const handleRetry = useCallback(() => {
    setState("idle");
    setStreamedText("");
    setErrorMessage("");
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl
                   max-h-[85vh] flex flex-col animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-label="AI Rewrite"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">AI Rewrite</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full
                       hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px]"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {/* Original text (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Original text</label>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-32 overflow-auto border border-gray-200">
              {selectedText}
            </div>
          </div>

          {/* Instruction input + chips (shown when idle or after error) */}
          {(state === "idle" || state === "error") && (
            <>
              {/* Error message */}
              {state === "error" && errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* Suggestion chips */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Quick suggestions
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleChipClick(chip)}
                      className="px-3 py-1.5 text-sm rounded-full border border-gray-300
                                 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-300
                                 hover:text-blue-700 transition-colors min-h-[36px]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Freeform instruction */}
              <form onSubmit={handleFormSubmit}>
                <label
                  htmlFor="ai-instruction"
                  className="block text-sm font-medium text-gray-500 mb-1"
                >
                  Or describe how to rewrite
                </label>
                <div className="flex gap-2">
                  <input
                    id="ai-instruction"
                    type="text"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g., Make it sound more confident..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                               min-h-[44px]"
                    maxLength={500}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!instruction.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
                               hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                               transition-colors min-w-[44px] min-h-[44px]"
                  >
                    Rewrite
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Loading state */}
          {state === "loading" && (
            <div className="flex items-center gap-3 py-4">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-sm text-gray-500">Rewriting...</span>
            </div>
          )}

          {/* Streaming / Done result */}
          {(state === "streaming" || state === "done") && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Rewritten text
                {state === "streaming" && (
                  <span className="ml-2 text-blue-500 animate-pulse">streaming...</span>
                )}
              </label>
              <div
                ref={resultRef}
                className="bg-blue-50 rounded-lg p-3 text-sm text-gray-800 max-h-48 overflow-auto
                           border border-blue-200 whitespace-pre-wrap"
              >
                {streamedText}
                {state === "streaming" && (
                  <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {state === "done" && streamedText && (
          <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100
                         rounded-lg hover:bg-gray-200 transition-colors min-h-[44px]"
            >
              Try again
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600
                         rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              Accept rewrite
            </button>
          </div>
        )}

        {/* Slide-up animation */}
        <style jsx>{`
          @keyframes slide-up {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
          .animate-slide-up {
            animation: slide-up 0.3s ease-out;
          }
        `}</style>
      </div>
    </>
  );
}

export default AIRewriteSheet;
