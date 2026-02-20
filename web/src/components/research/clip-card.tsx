"use client";

import { useState } from "react";
import { SourceCitationLink } from "./source-citation-link";

/**
 * ClipCard - Displays a saved research clip with source attribution.
 *
 * Per design-spec.md Section 7:
 * - Source title is a tappable link (navigates to Source Detail View)
 * - Shows chapter tag if assigned
 * - Truncated at 300 chars with "Show more"
 * - "Insert" and "Delete" action buttons with 44pt touch targets
 * - Source title for removed sources shows "[Source removed]" (not tappable)
 */

export interface ResearchClip {
  id: string;
  content: string;
  sourceId: string | null;
  sourceTitle: string;
  sourceLocation: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  createdAt: string;
}

export interface ClipCardProps {
  /** The clip data */
  clip: ResearchClip;
  /** Called when "Insert" is tapped */
  onInsert: () => void;
  /** Called when "Delete" is tapped */
  onDelete: () => void;
  /** Called to navigate to source detail view */
  onViewSource: (
    sourceId: string,
    returnTo: "ask" | "clips",
    sourceLocation?: string | null,
  ) => void;
  /** Whether insert is available (editor has cursor) */
  canInsert: boolean;
}

const TRUNCATE_LENGTH = 300;

/**
 * Format a chapter title into a compact label like "Ch. 4".
 *
 * Strategy:
 * - If the title starts with "Chapter N" (with or without colon/rest), extract the number
 * - Otherwise, truncate to a short label (max ~20 chars)
 */
function formatChapterLabel(title: string): string {
  // Match "Chapter 1", "Chapter 1: Title", "chapter 12" etc.
  const match = title.match(/^chapter\s+(\d+)/i);
  if (match) {
    return `Ch. ${match[1]}`;
  }
  // For non-standard chapter names, show a truncated version
  if (title.length > 20) {
    return title.slice(0, 18) + "...";
  }
  return title;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

export function ClipCard({ clip, onInsert, onDelete, onViewSource, canInsert }: ClipCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isTruncated = clip.content.length > TRUNCATE_LENGTH;
  const displayContent =
    isTruncated && !isExpanded ? clip.content.slice(0, TRUNCATE_LENGTH) + "..." : clip.content;

  return (
    <div className="border border-border rounded-lg p-3 bg-white" data-testid="clip-card">
      {/* Clip content */}
      <p className="text-sm text-foreground select-text whitespace-pre-wrap mb-1">
        {displayContent}
      </p>

      {/* Show more / less toggle */}
      {isTruncated && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 hover:text-blue-700 mb-2"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Source citation */}
      <SourceCitationLink
        sourceTitle={clip.sourceTitle}
        sourceId={clip.sourceId}
        sourceLocation={clip.sourceLocation}
        returnTo="clips"
        onNavigateToSource={onViewSource}
      />

      {/* Metadata row: chapter tag + saved time */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
        {clip.chapterTitle && (
          <>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[11px] leading-tight"
              data-testid="chapter-tag"
            >
              {formatChapterLabel(clip.chapterTitle)}
            </span>
            <span className="text-gray-300" aria-hidden="true">
              |
            </span>
          </>
        )}
        <span>Saved {formatRelativeTime(clip.createdAt)}</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={onInsert}
          disabled={!canInsert}
          className="min-h-[44px] px-3 text-xs font-medium text-blue-600 rounded-md
                     hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-default"
          aria-label="Insert quote into chapter with footnote"
        >
          Insert
        </button>

        <button
          onClick={onDelete}
          className="min-h-[44px] px-3 text-xs font-medium text-red-500 rounded-md
                     hover:bg-red-50 transition-colors ml-auto"
          aria-label="Delete clip"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
