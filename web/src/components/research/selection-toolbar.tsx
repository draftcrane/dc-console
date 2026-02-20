"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// === Types ===

interface Chapter {
  id: string;
  title: string;
}

interface SelectionToolbarProps {
  /** Chapters available for tagging */
  chapters: Chapter[];
  /** Called when "Save to Clips" is tapped. Returns the selected chapterId (null = "All chapters"). */
  onSaveToClips: (chapterId: string | null) => void;
  /** Called when "Copy" is tapped */
  onCopy: () => void;
  /** Whether a save is currently in progress */
  isSaving?: boolean;
  /** Whether the content was already saved (show checkmark) */
  isSaved?: boolean;
}

interface ToolbarPosition {
  top: number;
  left: number;
}

// === Helper: compute toolbar position above selection ===

function getToolbarPosition(scrollContainer: HTMLElement | null): ToolbarPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  // Position using fixed coordinates (toolbar uses position:fixed)
  const toolbarHeight = 44;
  const gap = 8;

  let top = rect.top - toolbarHeight - gap;
  const left = rect.left + rect.width / 2;

  // If toolbar would go above viewport, show below selection instead
  if (top < 8) {
    top = rect.bottom + gap;
  }

  // If toolbar would go below viewport when below selection, clamp
  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    if (top + toolbarHeight > containerRect.bottom) {
      top = containerRect.bottom - toolbarHeight - gap;
    }
  }

  return { top, left };
}

// === Selection Toolbar Component ===

/**
 * Floating toolbar that appears above text selection in the Source Detail View.
 *
 * Shows "Copy" and "Save to Clips" buttons (44pt height per design spec).
 * After save, briefly shows a chapter tag dropdown (2s auto-dismiss).
 *
 * Uses position:fixed based on getSelection().getRangeAt(0).getBoundingClientRect()
 * per technical notes in the issue.
 */
export function SelectionToolbar({
  chapters,
  onSaveToClips,
  onCopy,
  isSaving = false,
  isSaved = false,
}: SelectionToolbarProps) {
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const dropdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Track text selection changes
  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";

      if (text.length > 0) {
        setHasSelection(true);
        // Delay position computation slightly to let iOS selection handles settle
        requestAnimationFrame(() => {
          const pos = getToolbarPosition(null);
          if (pos) {
            setPosition(pos);
          }
        });
      } else {
        setHasSelection(false);
        setPosition(null);
        setShowChapterDropdown(false);
      }
    }

    // Listen for mouseup/touchend for initial selection
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  // Clear dropdown timer on unmount
  useEffect(() => {
    return () => {
      if (dropdownTimerRef.current) {
        clearTimeout(dropdownTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    onCopy();
  }, [onCopy]);

  const handleSaveToClips = useCallback(() => {
    if (isSaved) return;

    // If no chapters exist, save immediately with no chapter
    if (chapters.length === 0) {
      onSaveToClips(null);
      return;
    }

    // Show chapter dropdown — save is deferred until selection or auto-dismiss
    setShowChapterDropdown(true);
    if (dropdownTimerRef.current) {
      clearTimeout(dropdownTimerRef.current);
    }
    dropdownTimerRef.current = setTimeout(() => {
      setShowChapterDropdown(false);
      // Auto-dismiss: save with no chapter
      onSaveToClips(null);
    }, 2000);
  }, [onSaveToClips, isSaved, chapters.length]);

  const handleChapterSelect = useCallback(
    (chapterId: string | null) => {
      // Cancel the auto-dismiss timer since user made an explicit selection
      if (dropdownTimerRef.current) {
        clearTimeout(dropdownTimerRef.current);
        dropdownTimerRef.current = null;
      }
      setShowChapterDropdown(false);
      onSaveToClips(chapterId);
    },
    [onSaveToClips],
  );

  if (!hasSelection || !position) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[9998] toolbar-scale-in"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
      }}
      // Prevent toolbar clicks from clearing the selection
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      {/* Main toolbar buttons */}
      <div className="flex items-center bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="h-11 px-4 text-sm font-medium text-white hover:bg-gray-700
                     transition-colors flex items-center gap-1.5"
          aria-label="Copy selected text"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-600" aria-hidden="true" />

        {/* Save to Clips button */}
        <button
          onClick={handleSaveToClips}
          disabled={isSaving}
          className={`h-11 px-4 text-sm font-medium transition-colors flex items-center gap-1.5
            ${isSaved ? "text-green-400 cursor-default" : "text-white hover:bg-gray-700"}`}
          aria-label={isSaved ? "Saved to Clips" : "Save to Clips"}
        >
          {isSaved ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Saved
            </>
          ) : isSaving ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
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
              Saving...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Save to Clips
            </>
          )}
        </button>
      </div>

      {/* Chapter tag dropdown -- appears briefly after save */}
      {showChapterDropdown && chapters.length > 0 && (
        <div className="mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-40 overflow-auto toolbar-scale-in">
          <button
            onClick={() => handleChapterSelect(null)}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50
                       transition-colors font-medium"
          >
            All chapters
          </button>
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => handleChapterSelect(chapter.id)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50
                         transition-colors truncate"
            >
              {chapter.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
