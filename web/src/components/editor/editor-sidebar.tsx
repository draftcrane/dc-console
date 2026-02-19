"use client";

import { Sidebar, SidebarOverlay, type ChapterData } from "@/components/layout/sidebar";

interface EditorSidebarProps {
  chapters: ChapterData[];
  activeChapterId: string | undefined;
  onChapterSelect: (chapterId: string) => Promise<void>;
  onAddChapter: () => Promise<void>;
  onDeleteChapter: (chapterId: string) => void;
  onChapterRename: (chapterId: string, newTitle: string) => Promise<void>;
  onChapterReorder: (chapterIds: string[]) => Promise<void>;
  totalWordCount: number;
  activeChapterWordCount: number;
  /** Desktop sidebar collapsed state */
  sidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
  /** Mobile overlay state */
  mobileOverlayOpen: boolean;
  onOpenMobileOverlay: () => void;
  onCloseMobileOverlay: () => void;
}

/**
 * EditorSidebar - Responsive sidebar wrapper for the editor page.
 *
 * Handles the desktop persistent sidebar and the mobile overlay pattern
 * per PRD Section 14 (iPad-First Design):
 * - Sidebar persistent in landscape (240-280pt), hidden in portrait with "Ch X" pill
 * - Touch targets 44x44pt minimum
 */
export function EditorSidebar({
  chapters,
  activeChapterId,
  onChapterSelect,
  onAddChapter,
  onDeleteChapter,
  onChapterRename,
  onChapterReorder,
  totalWordCount,
  activeChapterWordCount,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
  mobileOverlayOpen,
  onOpenMobileOverlay,
  onCloseMobileOverlay,
}: EditorSidebarProps) {
  const sharedProps = {
    chapters,
    activeChapterId,
    onChapterSelect,
    onAddChapter,
    onDeleteChapter,
    onChapterRename,
    onChapterReorder,
    totalWordCount,
    activeChapterWordCount,
  };

  return (
    <>
      {/* Desktop sidebar - persistent, collapsible */}
      <div className="hidden lg:block">
        <Sidebar
          {...sharedProps}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={onToggleSidebarCollapsed}
        />
      </div>

      {/* Mobile sidebar - collapsed pill + overlay */}
      <div className="lg:hidden">
        <Sidebar {...sharedProps} collapsed={true} onToggleCollapsed={onOpenMobileOverlay} />

        <SidebarOverlay isOpen={mobileOverlayOpen} onClose={onCloseMobileOverlay}>
          <Sidebar {...sharedProps} collapsed={false} onToggleCollapsed={onCloseMobileOverlay} />
        </SidebarOverlay>
      </div>
    </>
  );
}
