"use client";

import type { SaveStatus } from "@/hooks/use-auto-save";

interface SaveIndicatorProps {
  status: SaveStatus;
  /** Called when the user taps the error message to retry */
  onRetry?: () => void;
}

/**
 * SaveIndicator - Accessible save status display
 *
 * Per US-015 acceptance criteria:
 * - "Saving..." while save in progress
 * - "Saved [timestamp]" after successful save
 * - "Save failed - retrying" on failure with active retry
 * - "Save failed" after retries exhausted (tappable to retry)
 * - Uses aria-live="polite" for screen readers
 */
export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  const { text, className } = getStatusDisplay(status);

  const isTappable = status.state === "error" && onRetry;

  return (
    <span
      className={`text-xs transition-colors ${className}${isTappable ? " cursor-pointer underline decoration-dotted" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onClick={isTappable ? onRetry : undefined}
      aria-label={isTappable ? `${text}. Tap to retry.` : undefined}
    >
      {text}
      {isTappable ? " — tap to retry" : ""}
    </span>
  );
}

function getStatusDisplay(status: SaveStatus): { text: string; className: string } {
  switch (status.state) {
    case "idle":
      return { text: "", className: "text-muted-foreground" };

    case "saving":
      return { text: "Saving\u2026", className: "text-blue-600" };

    case "saved": {
      const timeStr = formatTime(status.at);
      return { text: `Saved ${timeStr}`, className: "text-muted-foreground" };
    }

    case "error":
      return { text: status.message, className: "text-red-600" };
  }
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60_000) {
    return "just now";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default SaveIndicator;
