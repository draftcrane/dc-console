"use client";

import { useState } from "react";

/**
 * Chapter data structure
 */
export interface ChapterData {
  id: string;
  title: string;
  wordCount: number;
  sortOrder: number;
}

/**
 * Sidebar props
 */
export interface SidebarProps {
  /** List of chapters */
  chapters: ChapterData[];
  /** Currently active chapter ID */
  activeChapterId?: string;
  /** Callback when a chapter is selected */
  onChapterSelect?: (chapterId: string) => void;
  /** Callback when "+" button is clicked to add a new chapter */
  onAddChapter?: () => void;
  /** Total word count across all chapters */
  totalWordCount?: number;
  /** Whether the sidebar is collapsed (for responsive) */
  collapsed?: boolean;
  /** Callback to toggle collapsed state */
  onToggleCollapsed?: () => void;
}

/**
 * Sidebar Component - Basic Shell
 *
 * Per PRD Section 9 (Writing Environment Layout):
 * - Chapter list with titles
 * - Word counts per chapter (muted text)
 * - "+" button for new chapter
 * - Total word count at bottom
 *
 * Per PRD Section 14 (iPad-First Design):
 * - Touch targets minimum 44x44pt
 * - Chapter list items: full-width, min 48pt tall
 *
 * Per PRD Section 9 (Sidebar Responsive Behavior):
 * - iPad Landscape (1024pt+): Persistent, 240-280pt wide, collapsible
 * - iPad Portrait (768pt): Hidden by default with "Ch X" pill indicator
 * - Desktop (1200pt+): Persistent
 *
 * Note: This is a basic shell without editor integration (placeholder only).
 * Editor integration and long-press drag reordering will be added in future phases.
 */
export function Sidebar({
  chapters,
  activeChapterId,
  onChapterSelect,
  onAddChapter,
  totalWordCount = 0,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const sortedChapters = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);

  // Format word count with comma separators
  const formatWordCount = (count: number): string => {
    return count.toLocaleString();
  };

  if (collapsed) {
    // Collapsed state - show only a pill indicator
    const activeChapter = sortedChapters.find((ch) => ch.id === activeChapterId);
    const activeIndex = activeChapter
      ? sortedChapters.indexOf(activeChapter) + 1
      : 1;

    return (
      <button
        onClick={onToggleCollapsed}
        className="fixed left-2 top-1/2 -translate-y-1/2 z-40
                   px-3 py-2 rounded-full bg-blue-600 text-white text-sm font-medium
                   shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                   transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={`Chapter ${activeIndex}. Tap to open chapter list.`}
      >
        Ch {activeIndex}
      </button>
    );
  }

  return (
    <aside
      className="flex flex-col h-full w-[260px] min-w-[240px] max-w-[280px]
                 bg-gray-50 dark:bg-gray-900 border-r border-border"
      role="navigation"
      aria-label="Chapter navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Chapters</h2>
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Collapse sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Chapter list */}
      <nav className="flex-1 overflow-y-auto py-2" role="list" aria-label="Chapter list">
        {sortedChapters.map((chapter, index) => {
          const isActive = chapter.id === activeChapterId;

          return (
            <button
              key={chapter.id}
              onClick={() => onChapterSelect?.(chapter.id)}
              className={`w-full px-4 py-3 text-left flex items-center justify-between
                         min-h-[48px] transition-colors
                         focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500
                         ${
                           isActive
                             ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                             : "hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground"
                         }`}
              role="listitem"
              aria-current={isActive ? "page" : undefined}
              aria-label={`${chapter.title}, ${formatWordCount(chapter.wordCount)} words`}
            >
              <div className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium">
                  {chapter.title || "Untitled Chapter"}
                </span>
              </div>
              <span
                className={`ml-2 text-xs tabular-nums ${
                  isActive
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-muted-foreground"
                }`}
              >
                {formatWordCount(chapter.wordCount)}w
              </span>
            </button>
          );
        })}
      </nav>

      {/* Add chapter button */}
      <div className="px-4 py-2 border-t border-border">
        <button
          onClick={onAddChapter}
          className="w-full py-3 px-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700
                     text-muted-foreground hover:border-blue-500 hover:text-blue-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     transition-colors flex items-center justify-center gap-2
                     min-h-[48px]"
          aria-label="Add new chapter"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-sm">Add Chapter</span>
        </button>
      </div>

      {/* Total word count */}
      <div className="px-4 py-3 border-t border-border bg-gray-100 dark:bg-gray-800/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium text-foreground tabular-nums">
            {formatWordCount(totalWordCount)} words
          </span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Mobile sidebar overlay component
 * Used when sidebar is shown as overlay in portrait mode
 */
export function SidebarOverlay({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar container */}
      <div className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw]">
        {children}
      </div>
    </div>
  );
}

export default Sidebar;
