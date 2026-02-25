"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectData } from "@/types/editor";
import type { SaveStatus } from "@/hooks/use-auto-save";
import type { ProjectSummary } from "@/hooks/use-project-actions";
import { ProjectSwitcher } from "@/components/project/project-switcher";
import { SaveIndicator } from "./save-indicator";
import { ExportMenu } from "@/components/project/export-menu";
import { SettingsMenu } from "@/components/project/settings-menu";
import { useSourcesContext } from "@/contexts/sources-context";
import { WorkspaceToggle, type ViewMode } from "./workspace-toggle";
import { PanelToggleButton } from "./panel-toggle-button";

interface EditorToolbarProps {
  projectData: ProjectData;
  allProjects: ProjectSummary[];
  totalWordCount: number;

  // Save
  saveStatus: SaveStatus;
  onSaveRetry: () => void;

  // View mode (#318)
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  // Editor Panel (#317)
  isEditorPanelOpen?: boolean;
  onToggleEditorPanel?: () => void;

  // Export
  projectId: string;
  activeChapterId: string | null;
  getToken: () => Promise<string | null>;
  apiUrl: string;

  // Settings
  onRenameBook: () => void;
  onDuplicateBook: () => void;
  isDuplicating: boolean;
  onDeleteProject: () => void;
  onSignOut: () => void;
  isSigningOut: boolean;
}

/**
 * EditorToolbar - Top toolbar for the writing environment.
 *
 * Per Issue #318: Contains workspace toggle control for Chapter/Book view switching.
 * The toggle is placed prominently in the toolbar for immediate discoverability.
 */
export function EditorToolbar({
  projectData,
  allProjects,
  totalWordCount,
  saveStatus,
  onSaveRetry,
  viewMode,
  onViewModeChange,
  isEditorPanelOpen = false,
  onToggleEditorPanel,
  projectId,
  activeChapterId,
  getToken,
  apiUrl,
  onRenameBook,
  onDuplicateBook,
  isDuplicating,
  onDeleteProject,
  onSignOut,
  isSigningOut,
}: EditorToolbarProps) {
  const { isPanelOpen, togglePanel, connections } = useSourcesContext();
  const [announcement, setAnnouncement] = useState("");

  // Keyboard shortcuts (#394)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || !e.shiftKey) return;

      switch (e.key.toLowerCase()) {
        case "e":
          e.preventDefault();
          onToggleEditorPanel?.();
          break;
        case "l":
          e.preventDefault();
          togglePanel();
          break;
        case "b":
          e.preventDefault();
          onViewModeChange(viewMode === "chapter" ? "book" : "chapter");
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToggleEditorPanel, togglePanel, viewMode, onViewModeChange]);

  // aria-live announcements (#393)
  const announce = useCallback((msg: string) => {
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(msg));
  }, []);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      onViewModeChange(mode);
      announce(`Switched to ${mode === "chapter" ? "Chapter" : "Book"} view`);
    },
    [onViewModeChange, announce],
  );

  const handleToggleEditor = useCallback(() => {
    onToggleEditorPanel?.();
    announce(isEditorPanelOpen ? "Editor panel closed" : "Editor panel opened");
  }, [onToggleEditorPanel, isEditorPanelOpen, announce]);

  const handleToggleLibrary = useCallback(() => {
    togglePanel();
    announce(isPanelOpen ? "Library panel closed" : "Library panel opened");
  }, [togglePanel, isPanelOpen, announce]);

  return (
    <div
      className="flex items-center h-12 px-4 border-b border-border bg-background shrink-0"
      role="toolbar"
      aria-label="Editor toolbar"
      aria-orientation="horizontal"
    >
      {/* Left: Project switcher */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <ProjectSwitcher
          currentProject={{
            id: projectData.id,
            title: projectData.title,
            wordCount: totalWordCount,
          }}
          projects={allProjects.map((p) => ({
            id: p.id,
            title: p.title,
            wordCount: p.wordCount,
          }))}
        />
      </div>

      {/* Center: Workspace toggle - in flex flow to avoid overlap (#353) */}
      <div className="flex-1 flex justify-center min-w-0 px-2">
        <WorkspaceToggle value={viewMode} onChange={handleViewModeChange} />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <SaveIndicator status={saveStatus} onRetry={onSaveRetry} />

        {/* Editor Panel toggle (#317, #389) */}
        {onToggleEditorPanel && (
          <PanelToggleButton
            label="Editor"
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            }
            isOpen={isEditorPanelOpen}
            onToggle={handleToggleEditor}
            zone="editor"
          />
        )}

        <PanelToggleButton
          label="Library"
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          }
          isOpen={isPanelOpen}
          onToggle={handleToggleLibrary}
          zone="library"
        />

        <ExportMenu
          projectId={projectId}
          projectTitle={projectData.title}
          activeChapterId={activeChapterId}
          getToken={getToken}
          apiUrl={apiUrl}
          connections={connections}
        />

        <SettingsMenu
          onRenameBook={onRenameBook}
          onDuplicateBook={onDuplicateBook}
          isDuplicating={isDuplicating}
          onDeleteProject={onDeleteProject}
          onSignOut={onSignOut}
          isSigningOut={isSigningOut}
        />
      </div>

      {/* Screen reader announcements (#393) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
