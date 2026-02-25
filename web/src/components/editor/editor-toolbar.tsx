"use client";

import type { ProjectData } from "@/types/editor";
import type { SaveStatus } from "@/hooks/use-auto-save";
import type { ProjectSummary } from "@/hooks/use-project-actions";
import { ProjectSwitcher } from "@/components/project/project-switcher";
import { SaveIndicator } from "./save-indicator";
import { ExportMenu } from "@/components/project/export-menu";
import { SettingsMenu } from "@/components/project/settings-menu";
import { useSourcesContext } from "@/contexts/sources-context";
import { WorkspaceToggle, type ViewMode } from "./workspace-toggle";

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

  return (
    <div className="flex items-center h-12 px-4 border-b border-border bg-background shrink-0">
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
        <WorkspaceToggle value={viewMode} onChange={onViewModeChange} />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <SaveIndicator status={saveStatus} onRetry={onSaveRetry} />

        {/* Editor Panel toggle (#317) */}
        {onToggleEditorPanel && (
          <button
            onClick={onToggleEditorPanel}
            className={`min-h-[44px] px-2.5 flex items-center gap-1.5 rounded-lg text-sm font-medium
                       transition-colors duration-150 ease-in-out ${isEditorPanelOpen ? "bg-[var(--dc-color-interactive-escalation-subtle)] text-[var(--dc-color-interactive-escalation)]" : "text-[var(--dc-color-text-muted)] hover:bg-[var(--dc-color-surface-tertiary)]"}`}
            aria-label={isEditorPanelOpen ? "Close editor panel" : "Open editor panel"}
            aria-pressed={isEditorPanelOpen}
          >
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
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <span className="hidden sm:inline">Editor</span>
          </button>
        )}

        <button
          onClick={togglePanel}
          className={`min-h-[44px] px-2.5 flex items-center gap-1.5 rounded-lg text-sm font-medium
                     transition-colors duration-150 ease-in-out ${isPanelOpen ? "bg-[var(--dc-color-interactive-primary-subtle)] text-[var(--dc-color-interactive-primary-on-subtle)]" : "text-[var(--dc-color-text-muted)] hover:bg-[var(--dc-color-surface-tertiary)]"}`}
          aria-label={isPanelOpen ? "Close library panel" : "Open library panel"}
          aria-pressed={isPanelOpen}
        >
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span className="hidden sm:inline">Library</span>
        </button>

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
    </div>
  );
}
