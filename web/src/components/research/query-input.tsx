"use client";

import { useRef, useCallback, useEffect } from "react";

export interface QueryInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

/**
 * QueryInput - Chat-style input at the bottom of the Ask tab.
 *
 * Per design spec Section 7 (QueryInput):
 * - enterkeyhint="send" for mobile keyboards
 * - Minimum 16px font size (prevents iOS zoom)
 * - 48pt container height
 * - Send button: 44pt minimum touch target, disabled when input empty
 * - Cmd+Return keyboard shortcut submits query
 */
export function QueryInput({
  placeholder,
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled = false,
}: QueryInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = value.trim().length > 0 && !isLoading && !disabled;

  const handleSubmit = useCallback(() => {
    if (canSubmit) {
      onSubmit();
    }
  }, [canSubmit, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Return (Mac) or Ctrl+Return (Windows/Linux) submits
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      // Plain Enter also submits (single-line chat input)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Auto-resize textarea to content (single line by default, grows if needed)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className="shrink-0 border-t border-border bg-background px-3 py-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          aria-label="Ask about your sources"
          enterKeyHint="send"
          className="flex-1 resize-none rounded-xl border border-border bg-gray-50 px-3 py-2.5
                     text-base text-foreground placeholder:text-muted-foreground
                     focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500
                     disabled:opacity-50
                     min-h-[44px] max-h-[120px] leading-normal"
          style={{ fontSize: "16px" }}
        />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label={isLoading ? "Searching..." : "Submit query"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                     bg-blue-600 text-white transition-colors
                     hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {isLoading ? (
            <svg
              className="h-5 w-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
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
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19V5m0 0l-7 7m7-7l7 7"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
