"use client";

import type { ProjectData } from "@/types/editor";
import type { SaveStatus } from "@/hooks/use-auto-save";
import type { SheetState } from "@/hooks/use-ai-rewrite";
import type { ProjectSummary } from "@/hooks/use-project-actions";
import { ProjectSwitcher } from "@/components/project/project-switcher";
import { SaveIndicator } from "./save-indicator";
import { ExportMenu } from "@/components/project/export-menu";
import { SettingsMenu } from "@/components/project/settings-menu";

interface EditorToolbarProps {
  projectData: ProjectData;
  allProjects: ProjectSummary[];
  totalWordCount: number;

  // Save
  saveStatus: SaveStatus;
  onSaveRetry: () => void;

  // AI Rewrite
  selectionWordCount: number;
  aiSheetState: SheetState;
  onOpenAiRewrite: () => void;

  // Export
  driveConnected: boolean;
  projectId: string;
  activeChapterId: string | null;
  getToken: () => Promise<string | null>;
  apiUrl: string;

  // Settings
  hasDriveFolder: boolean;
  driveFolderId?: string | null;
  onSetupDrive?: () => void;
  onUnlinkDrive?: () => void;
  onManageAccounts: () => void;
  onRenameBook: () => void;
  onDuplicateBook: () => void;
  isDuplicating: boolean;
  onDeleteProject: () => void;
  onSignOut: () => void;
  isSigningOut: boolean;
}

/**
 * EditorToolbar - Top toolbar for the writing environment.
 */
export function EditorToolbar({
  projectData,
  allProjects,
  totalWordCount,
  saveStatus,
  onSaveRetry,
  selectionWordCount,
  aiSheetState,
  onOpenAiRewrite,
  driveConnected,
  projectId,
  activeChapterId,
  getToken,
  apiUrl,
  hasDriveFolder,
  driveFolderId,
  onSetupDrive,
  onUnlinkDrive,
  onManageAccounts,
  onRenameBook,
  onDuplicateBook,
  isDuplicating,
  onDeleteProject,
  onSignOut,
  isSigningOut,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2 min-w-0">
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

      <div className="flex items-center gap-2">
        <SaveIndicator status={saveStatus} onRetry={onSaveRetry} />

        {selectionWordCount > 0 && aiSheetState === "idle" && (
          <>
            <button
              onClick={onOpenAiRewrite}
              className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg text-sm font-medium
                         text-blue-700 hover:bg-blue-50 transition-colors"
              aria-label="AI Rewrite selected text"
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
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              <span className="hidden sm:inline">AI Rewrite</span>
            </button>
            <div className="w-px h-5 bg-border" aria-hidden="true" />
          </>
        )}

        <ExportMenu
          projectId={projectId}
          activeChapterId={activeChapterId}
          getToken={getToken}
          apiUrl={apiUrl}
          driveConnected={driveConnected}
        />

        <SettingsMenu
          hasDriveFolder={hasDriveFolder}
          driveFolderId={driveFolderId}
          onSetupDrive={onSetupDrive}
          onUnlinkDrive={onUnlinkDrive}
          onManageAccounts={onManageAccounts}
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
