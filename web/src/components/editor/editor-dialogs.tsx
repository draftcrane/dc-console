"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ProjectData } from "@/types/editor";
import type { AIRewriteResult } from "./ai-rewrite-sheet";
import type { SheetState } from "@/hooks/use-ai-rewrite";
import type { SourceMaterial } from "@/hooks/use-sources";
import type { DriveAccount } from "@/hooks/use-drive-accounts";
import type { DriveFileItem } from "@/hooks/use-drive-files";
import type { DriveBrowseItem } from "@/hooks/use-drive-browser";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import { RenameProjectDialog } from "@/components/project/rename-project-dialog";
import { DuplicateProjectDialog } from "@/components/project/duplicate-project-dialog";
import { DeleteChapterDialog } from "@/components/project/delete-chapter-dialog";
import { DisconnectDriveDialog } from "@/components/project/disconnect-drive-dialog";
import { AIRewriteSheet } from "./ai-rewrite-sheet";
import { DriveFilesSheet } from "@/components/drive/drive-files-sheet";
import { SourcesPanel } from "@/components/drive/sources-panel";
import { AddSourceSheet } from "@/components/drive/add-source-sheet";
import { DriveBrowserSheet } from "@/components/drive/drive-browser-sheet";
import { AccountsSheet } from "@/components/project/accounts-sheet";
import { SourceViewerSheet } from "@/components/drive/source-viewer-sheet";

interface EditorDialogsProps {
  projectData: ProjectData | null;
  projectId: string;
  getToken: () => Promise<string | null>;
  apiUrl: string;

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

  // Sources panel
  isSourcesPanelOpen: boolean;
  sources: SourceMaterial[];
  isSourcesLoading: boolean;
  sourcesError: string | null;
  isPickerLoading: boolean;
  onCloseSourcesPanel: () => void;
  onOpenAddSourceSheet: () => void;
  onOpenSourceViewer: (source: SourceMaterial) => void;
  onRemoveSource: (sourceId: string) => Promise<void>;
  importSourceAsChapter: (sourceId: string) => Promise<{ chapterId: string } | null>;
  activeChapterTitle: string | undefined;
  linkedSources: SourceMaterial[];
  onLinkSource: (sourceId: string) => Promise<void>;
  onUnlinkSource: (sourceId: string) => Promise<void>;
  setActiveChapterId: (id: string | null) => void;

  // Add source sheet
  isAddSourceSheetOpen: boolean;
  onCloseAddSourceSheet: () => void;
  onSelectDriveAccount: (connectionId: string) => void;
  onUploadLocal: (file: File) => Promise<void>;

  // Drive browser
  isDriveBrowserOpen: boolean;
  driveItems: DriveBrowseItem[];
  isDriveLoading: boolean;
  driveError: string | null;
  driveCanGoBack: boolean;
  onCloseDriveBrowser: () => void;
  onDriveGoBack: () => void;
  onOpenDriveFolder: (folderId: string) => void;
  onAddFromDriveBrowser: (files: DriveBrowseItem[]) => Promise<void>;
  isDriveDoc: (item: DriveBrowseItem) => boolean;
  isDriveFolder: (item: DriveBrowseItem) => boolean;

  // Accounts sheet
  isAccountsSheetOpen: boolean;
  onCloseAccountsSheet: () => void;
  onConnectAccount: () => void;
  onRefetchDriveAccounts: () => Promise<void>;

  // Source viewer
  isViewerOpen: boolean;
  activeSource: SourceMaterial | null;
  viewerContent: string;
  viewerWordCount: number;
  isContentLoading: boolean;
  contentError: string | null;
  onCloseSourceViewer: () => void;
}

/**
 * EditorDialogs - All modal dialogs and sheet overlays for the editor page.
 *
 * Extracted to keep the page orchestrator focused on layout and state wiring.
 * Each dialog/sheet is a controlled component receiving open/close state from the parent.
 */
export function EditorDialogs({
  projectData,
  projectId,
  getToken,
  apiUrl,
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
  isSourcesPanelOpen,
  sources,
  isSourcesLoading,
  sourcesError,
  isPickerLoading,
  onCloseSourcesPanel,
  onOpenAddSourceSheet,
  onOpenSourceViewer,
  onRemoveSource,
  importSourceAsChapter,
  activeChapterTitle,
  linkedSources,
  onLinkSource,
  onUnlinkSource,
  setActiveChapterId,
  isAddSourceSheetOpen,
  onCloseAddSourceSheet,
  onSelectDriveAccount,
  onUploadLocal,
  isDriveBrowserOpen,
  driveItems,
  isDriveLoading,
  driveError,
  driveCanGoBack,
  onCloseDriveBrowser,
  onDriveGoBack,
  onOpenDriveFolder,
  onAddFromDriveBrowser,
  isDriveDoc,
  isDriveFolder,
  isAccountsSheetOpen,
  onCloseAccountsSheet,
  onConnectAccount,
  onRefetchDriveAccounts,
  isViewerOpen,
  activeSource,
  viewerContent,
  viewerWordCount,
  isContentLoading,
  contentError,
  onCloseSourceViewer,
}: EditorDialogsProps) {
  const router = useRouter();

  const handleImportSourceAsChapter = useCallback(
    async (sourceId: string) => {
      const result = await importSourceAsChapter(sourceId);
      if (result) {
        const token = await getToken();
        const response = await fetch(`${apiUrl}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setProjectData(data);
          setActiveChapterId(result.chapterId);
        }
        onCloseSourcesPanel();
      }
    },
    [
      importSourceAsChapter,
      getToken,
      apiUrl,
      projectId,
      setProjectData,
      setActiveChapterId,
      onCloseSourcesPanel,
    ],
  );

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

      {/* Source materials panel */}
      <SourcesPanel
        isOpen={isSourcesPanelOpen}
        sources={sources}
        isLoading={isSourcesLoading}
        error={sourcesError}
        isPickerLoading={isPickerLoading}
        onClose={onCloseSourcesPanel}
        onAddFromPicker={onOpenAddSourceSheet}
        onViewSource={onOpenSourceViewer}
        onImportAsChapter={handleImportSourceAsChapter}
        onRemoveSource={onRemoveSource}
        activeChapterTitle={activeChapterTitle}
        linkedSourceIds={new Set(linkedSources.map((s) => s.id))}
        onLinkSource={onLinkSource}
        onUnlinkSource={onUnlinkSource}
      />

      {/* Add source sheet (multi-account + local upload) */}
      <AddSourceSheet
        isOpen={isAddSourceSheetOpen}
        accounts={driveAccounts}
        isPickerLoading={isDriveLoading}
        onClose={onCloseAddSourceSheet}
        onSelectDriveAccount={(connectionId) => onSelectDriveAccount(connectionId)}
        onUploadLocal={onUploadLocal}
        onConnectAccount={onConnectAccount}
      />

      <DriveBrowserSheet
        isOpen={isDriveBrowserOpen}
        items={driveItems}
        isLoading={isDriveLoading}
        error={driveError}
        canGoBack={driveCanGoBack}
        onClose={onCloseDriveBrowser}
        onBack={onDriveGoBack}
        onOpenFolder={onOpenDriveFolder}
        onSelectDocs={onAddFromDriveBrowser}
        isDoc={isDriveDoc}
        isFolder={isDriveFolder}
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

      {/* Source content viewer */}
      <SourceViewerSheet
        isOpen={isViewerOpen}
        title={activeSource?.title ?? ""}
        content={viewerContent}
        wordCount={viewerWordCount}
        isLoading={isContentLoading}
        error={contentError}
        onClose={onCloseSourceViewer}
        onImportAsChapter={async () => {
          if (!activeSource) return;
          await handleImportSourceAsChapter(activeSource.id);
        }}
        tabs={
          linkedSources.length > 0
            ? linkedSources.map((s) => ({ id: s.id, title: s.title }))
            : undefined
        }
        activeTabId={activeSource?.id ?? null}
        onTabChange={(sourceId) => {
          const source = linkedSources.find((s) => s.id === sourceId);
          if (source) onOpenSourceViewer(source);
        }}
      />
    </>
  );
}
