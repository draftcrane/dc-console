"use client";

import { useEffect, useRef } from "react";

/**
 * StreamingResponse — Reusable streaming text display with blinking cursor.
 *
 * ARIA: Uses aria-busy during streaming, aria-live="polite" for screen reader
 * announcements when content changes.
 *
 * Extracted from the ai-rewrite-sheet pattern for reuse across editor panel modes
 * (Chapter, Book, Library analysis).
 */

interface StreamingResponseProps {
  /** The text content to display (grows during streaming) */
  text: string;
  /** Whether content is currently streaming */
  isStreaming: boolean;
  /** Error message to display instead of or alongside content */
  errorMessage?: string | null;
  /** Accent color class for the cursor (defaults to violet) */
  cursorColorClass?: string;
  /** Optional className for the container */
  className?: string;
}

export function StreamingResponse({
  text,
  isStreaming,
  errorMessage,
  cursorColorClass = "bg-[var(--dc-color-interactive-escalation)]",
  className = "",
}: StreamingResponseProps) {
  const endRef = useRef<HTMLSpanElement>(null);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && endRef.current?.scrollIntoView) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isStreaming, text]);

  const hasText = text.length > 0;
  const showErrorOnly = errorMessage && !hasText;
  const showErrorInline = errorMessage && hasText;

  return (
    <div
      className={`p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap min-h-[60px]
                  bg-[var(--dc-color-interactive-escalation-subtle)]
                  border border-[var(--dc-color-interactive-escalation-border)]
                  text-[var(--dc-color-text-secondary)] ${className}`}
      role="region"
      aria-label="Rewrite result"
      aria-busy={isStreaming}
      aria-live="polite"
    >
      {showErrorOnly ? (
        <span className="text-[var(--dc-color-status-error)]">{errorMessage}</span>
      ) : (
        <>
          {text}
          {isStreaming && (
            <span
              ref={endRef}
              className={`inline-block w-0.5 h-4 ml-0.5 align-text-bottom editor-cursor-blink ${cursorColorClass}`}
              aria-hidden="true"
            />
          )}
          {showErrorInline && (
            <div className="mt-3 text-[var(--dc-color-status-error)] text-xs">{errorMessage}</div>
          )}
        </>
      )}
      {isStreaming && !hasText && !errorMessage && (
        <span
          ref={endRef}
          className={`inline-block w-0.5 h-4 editor-cursor-blink ${cursorColorClass}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
