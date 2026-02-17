"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  /** Callback when delete is requested for a chapter */
  onDeleteChapter?: (chapterId: string) => void;
  /** Callback when a chapter is renamed via double-tap inline editing (US-013) */
  onChapterRename?: (chapterId: string, newTitle: string) => void;
  /** Total word count across all chapters */
  totalWordCount?: number;
  /** Real-time word count for the active chapter (overrides stored value) */
  activeChapterWordCount?: number;
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
 * Per PRD US-013 (Rename Chapter):
 * - Double-tap on chapter title enables inline editing
 * - Max 200 characters
 * - Empty title reverts to "Untitled Chapter"
 */
export function Sidebar({
  chapters,
  activeChapterId,
  onChapterSelect,
  onAddChapter,
  onDeleteChapter,
  onChapterRename,
  totalWordCount = 0,
  activeChapterWordCount,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const sortedChapters = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);

  // Track which chapter is being renamed inline
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);

  // Compute the effective total word count using the real-time active chapter word count
  const effectiveTotalWordCount =
    activeChapterWordCount !== undefined && activeChapterId
      ? totalWordCount -
        (chapters.find((ch) => ch.id === activeChapterId)?.wordCount ?? 0) +
        activeChapterWordCount
      : totalWordCount;

  // Format word count with comma separators
  const formatWordCount = (count: number): string => {
    return count.toLocaleString();
  };

  const handleRenameStart = useCallback((chapterId: string) => {
    setEditingChapterId(chapterId);
  }, []);

  const handleRenameEnd = useCallback(
    (chapterId: string, newTitle: string) => {
      setEditingChapterId(null);
      const trimmed = newTitle.trim();
      const finalTitle = trimmed || "Untitled Chapter";
      // Find original title to avoid no-op API calls
      const chapter = chapters.find((ch) => ch.id === chapterId);
      if (chapter && finalTitle !== chapter.title) {
        onChapterRename?.(chapterId, finalTitle);
      }
    },
    [chapters, onChapterRename],
  );

  const handleRenameCancel = useCallback(() => {
    setEditingChapterId(null);
  }, []);

  if (collapsed) {
    // Collapsed state - show only a pill indicator
    const activeChapter = sortedChapters.find((ch) => ch.id === activeChapterId);
    const activeIndex = activeChapter ? sortedChapters.indexOf(activeChapter) + 1 : 1;

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
        {sortedChapters.map((chapter) => {
          const isActive = chapter.id === activeChapterId;
          const displayWordCount =
            isActive && activeChapterWordCount !== undefined
              ? activeChapterWordCount
              : chapter.wordCount;
          const isEditing = editingChapterId === chapter.id;
          const canDelete = sortedChapters.length > 1;

          return (
            <ChapterListItem
              key={chapter.id}
              chapter={chapter}
              isActive={isActive}
              isEditing={isEditing}
              canDelete={canDelete}
              displayWordCount={displayWordCount}
              formatWordCount={formatWordCount}
              onSelect={() => onChapterSelect?.(chapter.id)}
              onRenameStart={() => handleRenameStart(chapter.id)}
              onRenameEnd={(newTitle) => handleRenameEnd(chapter.id, newTitle)}
              onRenameCancel={handleRenameCancel}
              onDelete={onDeleteChapter ? () => onDeleteChapter(chapter.id) : undefined}
            />
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
            {formatWordCount(effectiveTotalWordCount)} words
          </span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Individual chapter list item with double-tap rename support.
 *
 * Per PRD US-013:
 * - Double-tap (double-click) on a chapter title enables inline editing
 * - Single tap selects the chapter
 * - Max 200 characters for title
 * - Empty title reverts to "Untitled Chapter"
 * - Enter commits the rename, Escape cancels
 */
function ChapterListItem({
  chapter,
  isActive,
  isEditing,
  canDelete,
  displayWordCount,
  formatWordCount,
  onSelect,
  onRenameStart,
  onRenameEnd,
  onRenameCancel,
  onDelete,
}: {
  chapter: ChapterData;
  isActive: boolean;
  isEditing: boolean;
  canDelete: boolean;
  displayWordCount: number;
  formatWordCount: (count: number) => string;
  onSelect: () => void;
  onRenameStart: () => void;
  onRenameEnd: (newTitle: string) => void;
  onRenameCancel: () => void;
  onDelete?: () => void;
}) {
  if (isEditing) {
    return (
      <InlineRenameInput
        initialTitle={chapter.title}
        isActive={isActive}
        displayWordCount={displayWordCount}
        formatWordCount={formatWordCount}
        onCommit={onRenameEnd}
        onCancel={onRenameCancel}
      />
    );
  }

  return (
    <div
      className={`group w-full flex items-center min-h-[48px] transition-colors
                 ${
                   isActive
                     ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                     : "hover:bg-gray-100 dark:hover:bg-gray-800 text-foreground"
                 }`}
      role="listitem"
    >
      <button
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.preventDefault();
          onRenameStart();
        }}
        className="flex-1 px-4 py-3 text-left flex items-center justify-between min-w-0
                   focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-current={isActive ? "page" : undefined}
        aria-label={`${chapter.title || "Untitled Chapter"}, ${formatWordCount(displayWordCount)} words. Double-tap to rename.`}
      >
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium">
            {chapter.title || "Untitled Chapter"}
          </span>
        </div>
        <span
          className={`ml-2 text-xs tabular-nums ${
            isActive ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"
          }`}
        >
          {formatWordCount(displayWordCount)}w
        </span>
      </button>

      {/* Delete button - visible on hover/focus, only when more than 1 chapter */}
      {canDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mr-2 p-1.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100
                     hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground
                     hover:text-red-600 dark:hover:text-red-400 transition-all
                     focus:outline-none focus:ring-2 focus:ring-red-500
                     min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0"
          aria-label={`Delete ${chapter.title || "Untitled Chapter"}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Inline rename input for chapter titles in the sidebar.
 * Mounted only when editing, so initial state is naturally correct.
 * Auto-focuses and selects all text on mount.
 */
function InlineRenameInput({
  initialTitle,
  isActive,
  displayWordCount,
  formatWordCount,
  onCommit,
  onCancel,
}: {
  initialTitle: string;
  isActive: boolean;
  displayWordCount: number;
  formatWordCount: (count: number) => string;
  onCommit: (newTitle: string) => void;
  onCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and select on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const handleCommit = useCallback(() => {
    onCommit(editValue);
  }, [editValue, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCommit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [handleCommit, onCancel],
  );

  return (
    <div
      className={`w-full px-4 py-3 flex items-center justify-between
                 min-h-[48px] transition-colors
                 ${
                   isActive
                     ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                     : "bg-gray-100 dark:bg-gray-800 text-foreground"
                 }`}
      role="listitem"
    >
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        maxLength={200}
        className="flex-1 min-w-0 text-sm font-medium bg-white dark:bg-gray-900
                   border border-blue-500 rounded px-2 py-1 outline-none
                   focus:ring-2 focus:ring-blue-500"
        aria-label="Chapter title"
      />
      <span
        className={`ml-2 text-xs tabular-nums shrink-0 ${
          isActive ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"
        }`}
      >
        {formatWordCount(displayWordCount)}w
      </span>
    </div>
  );
}

/**
 * Focusable element selector for focus management
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile sidebar overlay component
 * Used when sidebar is shown as overlay in portrait mode
 *
 * Accessibility:
 * - role="dialog" + aria-modal for screen reader announcement
 * - Escape key closes the overlay
 * - Focus moves into the panel on open
 * - Focus returns to the trigger element on close
 * - Focus is trapped within the dialog while open
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
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const prevIsOpenRef = useRef(false);

  // Focus management: capture trigger, focus first element, return focus on close
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      // Opening: capture the element that triggered the overlay
      triggerRef.current = document.activeElement;

      // Focus the first focusable element inside the panel
      if (panelRef.current) {
        const firstFocusable = panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    } else if (!isOpen && wasOpen) {
      // Closing: return focus to the trigger element
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger instanceof HTMLElement) {
        trigger.focus();
      }
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap: keep focus within the dialog
  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Tab" || !panelRef.current) return;

    const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [isOpen, handleFocusTrap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Sidebar container */}
      <div
        ref={panelRef}
        className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw]"
        role="dialog"
        aria-modal="true"
        aria-label="Chapter navigation"
      >
        {children}
      </div>
    </div>
  );
}

export default Sidebar;
