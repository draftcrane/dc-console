"use client";

import type { TextSelectionState } from "@/hooks/use-text-selection";

interface FloatingActionBarProps {
  /** Current text selection state from useTextSelection hook */
  selection: TextSelectionState;
  /** Callback when the AI Rewrite button is clicked */
  onRewrite?: (selectedText: string) => void;
}

/**
 * FloatingActionBar - Appears near text selection with an "AI Rewrite" button.
 *
 * Per PRD US-016:
 * - Floating bar appears ~200ms after native menu (delay handled by useTextSelection)
 * - Positioned on opposite side of selection from native iPadOS menu
 *   (native menu appears above selection, this bar appears below)
 * - Minimum touch target: 48x48pt for AI Rewrite button
 * - Maximum selection: 2,000 words with warning message
 * - Does NOT interfere with native copy/paste menu
 * - Tracks selection bounds when user adjusts handles
 */
export function FloatingActionBar({ selection, onRewrite }: FloatingActionBarProps) {
  if (!selection.hasSelection || !selection.floatingBarPosition) {
    return null;
  }

  const { top, left } = selection.floatingBarPosition;

  const handleRewriteClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent the click from propagating to the editor and clearing selection
    e.preventDefault();
    e.stopPropagation();

    if (selection.exceedsLimit) return;
    onRewrite?.(selection.selectedText);
  };

  return (
    <div
      role="toolbar"
      aria-label="AI text actions"
      className="absolute z-50 flex items-center gap-2 bg-white border border-gray-200
                 rounded-xl shadow-lg px-2 py-1 select-none
                 transform -translate-x-1/2"
      style={{
        top: `${top}px`,
        left: `${left}px`,
      }}
      // Prevent mousedown from stealing focus from the editor
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {selection.exceedsLimit ? (
        <span className="text-sm text-amber-700 px-3 py-2 whitespace-nowrap" role="alert">
          Select up to 2,000 words
        </span>
      ) : (
        <button
          onClick={handleRewriteClick}
          className="flex items-center gap-2 px-4 py-2 min-w-[48px] min-h-[48px]
                     text-sm font-medium text-white bg-blue-600 rounded-lg
                     hover:bg-blue-700 active:bg-blue-800
                     transition-colors whitespace-nowrap
                     touch-manipulation"
          aria-label="AI Rewrite selected text"
        >
          {/* Sparkle/AI icon */}
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
          AI Rewrite
        </button>
      )}
    </div>
  );
}

export default FloatingActionBar;
