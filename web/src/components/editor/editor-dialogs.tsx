"use client";

import { useRouter } from "next/navigation";
import type { ProjectData } from "@/types/editor";
import type { AIRewriteResult } from "./ai-rewrite-sheet";
import type { SheetState } from "@/hooks/use-ai-rewrite";
import type { DriveAccount } from "@/hooks/use-drive-accounts";
import type { DriveFileItem } from "@/hooks/use-drive-files";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import { RenameProjectDialog } from "@/components/project/rename-project-dialog";
import { DuplicateProjectDialog } from "@/components/project/duplicate-project-dialog";
import { DeleteChapterDialog } from "@/components/project/delete-chapter-dialog";
import { DisconnectDriveDialog } from "@/components/project/disconnect-drive-dialog";
import { AIRewriteSheet } from "./ai-rewrite-sheet";
import { DriveFilesSheet } from "@/components/drive/drive-files-sheet";
import { AccountsSheet } from "@/components/project/accounts-sheet";

interface EditorDialogsProps {
  projectData: ProjectData | null;
  projectId: string;

  // Delete project
  deleteDialogOpen: boolean;
  onDeleteProject: () => Promise<void>;
  onCloseDeleteDialog: () => void;

  // Rename project
  renameDialogOpen: boolean;
  onRenameProject: (projectId: string, newTitle: string) => Promise<boolean>;
  onCloseRenameDialog: () => void;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData | null>>;

  // Duplicate project
  duplicateDialogOpen: boolean;
  onDuplicateProject: (projectId: string) => Promise<string | null>;
  onCloseDuplicateDialog: () => void;

  // Delete chapter
  deleteChapterDialogOpen: boolean;
  chapterToDelete: string | null;
  onDeleteChapter: () => Promise<void>;
  onCloseDeleteChapterDialog: () => void;

  // Disconnect Drive
  disconnectDriveDialogOpen: boolean;
  driveEmail: string;
  driveAccounts: DriveAccount[];
  onDisconnectDriveAccount: (connectionId: string) => Promise<void>;
  onCloseDisconnectDriveDialog: () => void;

  // AI Rewrite
  aiSheetState: SheetState;
  aiCurrentResult: AIRewriteResult | null;
  aiErrorMessage: string | null;
  onAIAccept: (result: AIRewriteResult) => Promise<void>;
  onAIRetry: (result: AIRewriteResult, instruction: string) => Promise<void>;
  onAIDiscard: (result: AIRewriteResult) => Promise<void>;
  onGoDeeper: (result: AIRewriteResult) => void;

  // Drive files
  driveFilesOpen: boolean;
  driveFiles: DriveFileItem[];
  driveFilesLoading: boolean;
  driveFilesError: string | null;
  isConnectingDrive: boolean;
  isProjectConnected: boolean;
  onCloseDriveFiles: () => void;
  onRefreshDriveFiles: () => void;
  onConnectProjectToDrive: () => Promise<void>;
  onDisconnectProjectFromDrive: () => Promise<boolean>;
  onOpenSourcesPanel: () => void;
  onOpenDriveBrowser: (connectionId?: string) => Promise<void>;

  // Accounts sheet
  isAccountsSheetOpen: boolean;
  onCloseAccountsSheet: () => void;
  onConnectAccount: () => void;
  onRefetchDriveAccounts: () => Promise<void>;

  // Research panel (minimal props -- state managed by ResearchPanelProvider)
  isResearchPanelOpen: boolean;
  onCloseResearchPanel: () => void;
}

/**
 * EditorDialogs - All modal dialogs and sheet overlays for the editor page.
 *
 * Extracted to keep the page orchestrator focused on layout and state wiring.
 * Each dialog/sheet is a controlled component receiving open/close state from the parent.
 *
 * Source-related components (SourcesPanel, AddSourceSheet, DriveBrowserSheet,
 * SourceViewerSheet) have been removed. Source management is now handled by the
 * ResearchPanel via the ResearchPanelProvider context (#180).
 */
export function EditorDialogs({
  projectData,
  projectId,
  deleteDialogOpen,
  onDeleteProject,
  onCloseDeleteDialog,
  renameDialogOpen,
  onRenameProject,
  onCloseRenameDialog,
  setProjectData,
  duplicateDialogOpen,
  onDuplicateProject,
  onCloseDuplicateDialog,
  deleteChapterDialogOpen,
  chapterToDelete,
  onDeleteChapter,
  onCloseDeleteChapterDialog,
  disconnectDriveDialogOpen,
  driveEmail,
  driveAccounts,
  onDisconnectDriveAccount,
  onCloseDisconnectDriveDialog,
  aiSheetState,
  aiCurrentResult,
  aiErrorMessage,
  onAIAccept,
  onAIRetry,
  onAIDiscard,
  onGoDeeper,
  driveFilesOpen,
  driveFiles,
  driveFilesLoading,
  driveFilesError,
  isConnectingDrive,
  isProjectConnected,
  onCloseDriveFiles,
  onRefreshDriveFiles,
  onConnectProjectToDrive,
  onDisconnectProjectFromDrive,
  onOpenSourcesPanel,
  onOpenDriveBrowser,
  isAccountsSheetOpen,
  onCloseAccountsSheet,
  onConnectAccount,
  onRefetchDriveAccounts,
}: EditorDialogsProps) {
  const router = useRouter();

  return (
    <>
      {/* Delete project confirmation dialog (US-023) */}
      <DeleteProjectDialog
        projectTitle={projectData?.title || ""}
        isOpen={deleteDialogOpen}
        onConfirm={onDeleteProject}
        onCancel={onCloseDeleteDialog}
      />

      {/* Rename book dialog */}
      <RenameProjectDialog
        isOpen={renameDialogOpen}
        projectTitle={projectData?.title || ""}
        onConfirm={async (newTitle) => {
          const success = await onRenameProject(projectId, newTitle);
          if (success) {
            setProjectData((prev) => (prev ? { ...prev, title: newTitle } : prev));
            onCloseRenameDialog();
          }
        }}
        onCancel={onCloseRenameDialog}
      />

      {/* Duplicate book confirmation dialog */}
      <DuplicateProjectDialog
        isOpen={duplicateDialogOpen}
        projectTitle={projectData?.title || ""}
        onConfirm={async () => {
          const newProjectId = await onDuplicateProject(projectId);
          onCloseDuplicateDialog();
          if (newProjectId) {
            router.push(`/editor/${newProjectId}`);
          }
        }}
        onCancel={onCloseDuplicateDialog}
      />

      {/* Delete chapter confirmation dialog (US-014) */}
      <DeleteChapterDialog
        chapterTitle={
          projectData?.chapters.find((ch) => ch.id === chapterToDelete)?.title || "Untitled Chapter"
        }
        isOpen={deleteChapterDialogOpen}
        onConfirm={onDeleteChapter}
        onCancel={onCloseDeleteChapterDialog}
      />

      {/* Disconnect Google Drive confirmation dialog (US-008) */}
      <DisconnectDriveDialog
        email={driveEmail}
        isOpen={disconnectDriveDialogOpen}
        onConfirm={async () => {
          // Disconnect all accounts (legacy behavior)
          for (const account of driveAccounts) {
            await onDisconnectDriveAccount(account.id);
          }
          onCloseDisconnectDriveDialog();
        }}
        onCancel={onCloseDisconnectDriveDialog}
      />

      <AIRewriteSheet
        sheetState={aiSheetState}
        result={aiCurrentResult}
        errorMessage={aiErrorMessage}
        onAccept={onAIAccept}
        onRetry={onAIRetry}
        onDiscard={onAIDiscard}
        onGoDeeper={onGoDeeper}
      />

      {/* Drive files listing sheet (US-007) */}
      <DriveFilesSheet
        isOpen={driveFilesOpen}
        files={driveFiles}
        isLoading={driveFilesLoading || isConnectingDrive}
        error={driveFilesError}
        onClose={onCloseDriveFiles}
        onRefresh={onRefreshDriveFiles}
        onConnectDrive={onConnectProjectToDrive}
        onAddSources={async () => {
          onOpenSourcesPanel();
          await onOpenDriveBrowser();
        }}
        onViewSources={onOpenSourcesPanel}
        onDisconnectProject={async () => {
          const confirmed = window.confirm(
            "Disconnect this project from its Drive folder? Your Drive account remains connected.",
          );
          if (!confirmed) return;
          await onDisconnectProjectFromDrive();
        }}
        isProjectConnected={isProjectConnected}
      />

      {/* Google Accounts management sheet */}
      <AccountsSheet
        isOpen={isAccountsSheetOpen}
        accounts={driveAccounts}
        onClose={onCloseAccountsSheet}
        onConnectAccount={onConnectAccount}
        onDisconnectAccount={async (connectionId) => {
          await onDisconnectDriveAccount(connectionId);
          await onRefetchDriveAccounts();
        }}
      />
    </>
  );
}
