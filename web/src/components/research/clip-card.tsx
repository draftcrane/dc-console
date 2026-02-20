"use client";

import { useState, useRef } from "react";
import type { ResearchClip } from "@/hooks/use-research-clips";

const TRUNCATE_LIMIT = 300;

interface ClipCardProps {
  clip: ResearchClip;
  onDelete: (clipId: string) => void;
  onSourceTap?: (sourceId: string) => void;
}

/**
 * ClipCard -- displays a saved text snippet with source info, chapter tag, and actions.
 *
 * Features:
 * - Snippet text truncated at 300 chars with "Show more" / "Show less" toggle
 * - Source title (tappable if source exists, "[Source removed]" in gray otherwise)
 * - Chapter tag badge if assigned
 * - Delete via overflow menu or swipe-left gesture
 * - 44pt minimum touch targets per iPad-first design
 */
export function ClipCard({ clip, onDelete, onSourceTap }: ClipCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Swipe tracking
  const touchStartX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiped, setSwiped] = useState(false);

  const isLong = clip.snippetText.length > TRUNCATE_LIMIT;
  const displayText =
    isLong && !expanded ? clip.snippetText.slice(0, TRUNCATE_LIMIT) : clip.snippetText;

  const hasSource = clip.sourceId !== null;

  // Format date relative
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Compact chapter label: "Chapter N: Title" -> "Ch. N"
  const chapterLabel = (() => {
    if (!clip.chapterTitle) return null;
    const match = clip.chapterTitle.match(/^Chapter\s+(\d+)/i);
    if (match) return `Ch. ${match[1]}`;
    return clip.chapterTitle.length > 20
      ? clip.chapterTitle.slice(0, 20) + "..."
      : clip.chapterTitle;
  })();

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.touches[0].clientX;
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 80));
    } else {
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 60) {
      setSwiped(true);
    } else {
      setSwipeOffset(0);
      setSwiped(false);
    }
  };

  const handleDeleteConfirm = () => {
    onDelete(clip.id);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete action behind the card (revealed by swipe) */}
      {swiped && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            onClick={handleDeleteConfirm}
            className="h-full px-4 bg-red-500 text-white font-medium text-sm flex items-center"
            style={{ minHeight: 44 }}
            aria-label="Delete clip"
          >
            Delete
          </button>
        </div>
      )}

      <div
        className="bg-white border border-gray-200 rounded-lg p-3 transition-transform"
        style={{ transform: swiped ? `translateX(-80px)` : `translateX(-${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header: source + chapter tag + menu */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasSource ? (
              <button
                onClick={() => onSourceTap?.(clip.sourceId!)}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate font-medium"
                style={{ minHeight: 44, display: "flex", alignItems: "center" }}
              >
                {clip.sourceTitle}
              </button>
            ) : (
              <span
                className="text-sm text-gray-400 italic"
                style={{ minHeight: 44, display: "flex", alignItems: "center" }}
              >
                [Source removed]
              </span>
            )}

            {chapterLabel && (
              <span className="shrink-0 px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                {chapterLabel}
              </span>
            )}
          </div>

          {/* Overflow menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded"
              style={{
                minHeight: 44,
                minWidth: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Clip actions"
              aria-expanded={menuOpen}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDeleteConfirm();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    style={{ minHeight: 44, display: "flex", alignItems: "center" }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Snippet text */}
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {displayText}
          {isLong && !expanded && "..."}
        </p>

        {/* Show more/less toggle */}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-700 mt-1 font-medium"
            style={{ minHeight: 44, display: "flex", alignItems: "center" }}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {/* Footer: date */}
        <div className="mt-2 text-xs text-gray-400">{formatDate(clip.createdAt)}</div>
      </div>
    </div>
  );
}
