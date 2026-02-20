"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import type { ChapterData } from "@/components/layout/sidebar";
import type { ChapterEditorHandle } from "@/components/editor/chapter-editor";
import { OnboardingTooltips } from "@/components/editor/onboarding-tooltips";
import { CrashRecoveryDialog } from "@/components/editor/crash-recovery-dialog";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { EditorWritingArea } from "@/components/editor/editor-writing-area";
import { EditorDialogs } from "@/components/editor/editor-dialogs";
import {
  ResearchPanelProvider,
  useResearchPanel,
} from "@/components/research/research-panel-provider";
import { ResearchPanel } from "@/components/research/research-panel";
import { useDriveAccounts } from "@/hooks/use-drive-accounts";
import { useDriveFiles } from "@/hooks/use-drive-files";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useSignOut } from "@/hooks/use-sign-out";
import { useChapterManagement } from "@/hooks/use-chapter-management";
import { useEditorAI } from "@/hooks/use-editor-ai";
import { useEditorTitle } from "@/hooks/use-editor-title";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useSourceActions } from "@/hooks/use-source-actions";
import { useEditorProject } from "@/hooks/use-editor-project";
import { useChapterContent } from "@/hooks/use-chapter-content";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Writing Environment Page
 *
 * Per PRD Section 9 (Writing Environment Layout):
 * Three zones:
 * 1. Sidebar with chapter list, word counts, "+" button, total word count
 * 2. Editor with clean writing area, editable chapter title
 * 3. Toolbar with minimal formatting, save status, Export, Settings
 *
 * Per PRD Section 14 (iPad-First Design):
 * - Sidebar responsive: persistent in landscape (240-280pt), hidden in portrait with "Ch X" pill
 * - Touch targets 44x44pt minimum
 * - Uses 100dvh for viewport height
 *
 * Per US-011: Editor content width constrained to ~680-720px.
 * Per US-015: Three-tier auto-save (IndexedDB -> Drive/R2 -> D1 metadata).
 *
 * This component is the orchestrator: it wires together hooks and delegates
 * all UI rendering to focused child components.
 *
 * Source/research panel state is managed by ResearchPanelProvider context (#180).
 */
export default function EditorPage() {
  return (
    <ResearchPanelProvider>
      <EditorPageInner />
    </ResearchPanelProvider>
  );
}

function EditorPageInner() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  // Research panel state from context
  const {
    isOpen: isResearchPanelOpen,
    closePanel: closeResearchPanel,
    openPanel: openResearchPanel,
  } = useResearchPanel();

  // Editor ref for AI rewrite text replacement
  const editorRef = useRef<ChapterEditorHandle>(null);

  // --- Core project data ---
  const {
    projectData,
    setProjectData,
    activeChapterId,
    setActiveChapterId,
    isLoading,
    error,
    handleProjectConnected,
    handleProjectDisconnected,
  } = useEditorProject({
    projectId,
    getToken: getToken as () => Promise<string | null>,
  });

  // Get active chapter for version
  const activeChapter = projectData?.chapters.find((ch) => ch.id === activeChapterId);

  // --- Auto-save ---
  const {
    handleContentChange,
    saveNow,
    saveStatus,
    recoveryPrompt,
    acceptRecovery,
    dismissRecovery,
    content: currentContent,
    setContent,
  } = useAutoSave({
    chapterId: activeChapterId,
    version: activeChapter?.version ?? 1,
    getToken: getToken as () => Promise<string | null>,
    apiUrl: API_URL,
  });

  // Sign-out with auto-save flush (US-003)
  const { handleSignOut, isSigningOut } = useSignOut(saveNow);

  // Ref to hold saveNow for chapter switch (avoids stale closure)
  const saveNowRef = useRef(saveNow);
  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  // --- Chapter content loading & word counts ---
  const { currentWordCount, selectionWordCount, handleSelectionWordCountChange } =
    useChapterContent({
      activeChapterId,
      getToken: getToken as () => Promise<string | null>,
      setContent,
      currentContent,
    });

  // --- Sidebar UI state ---
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  // --- Accounts management sheet state ---
  const [isAccountsSheetOpen, setIsAccountsSheetOpen] = useState(false);

  // --- Drive connection (multi-account) ---
  const {
    accounts: driveAccounts,
    connected: driveConnected,
    email: driveEmail,
    connect: connectDrive,
    disconnect: disconnectDriveAccount,
    refetch: refetchDriveAccounts,
  } = useDriveAccounts();

  // Drive files listing (US-007)
  const {
    fetchFiles,
    files: driveFiles,
    isLoading: driveFilesLoading,
    error: driveFilesError,
    reset: resetDriveFiles,
  } = useDriveFiles();

  // --- Chapter management ---
  const {
    chapterToDelete,
    deleteChapterDialogOpen,
    setDeleteChapterDialogOpen,
    setChapterToDelete,
    handleAddChapter,
    handleChapterRename,
    handleChapterReorder,
    handleChapterSelect,
    handleDeleteChapterRequest,
    handleDeleteChapter,
  } = useChapterManagement({
    projectId,
    apiUrl: API_URL,
    getToken: getToken as () => Promise<string | null>,
    projectData,
    setProjectData,
    activeChapterId,
    setActiveChapterId,
    setMobileOverlayOpen,
    saveNowRef,
    currentContent,
  });

  // --- AI rewrite ---
  const {
    sheetState: aiSheetState,
    currentResult: aiCurrentResult,
    errorMessage: aiErrorMessage,
    handleOpenAiRewrite,
    handleAIAccept,
    handleAIRetry,
    handleAIDiscard,
    handleGoDeeper,
  } = useEditorAI({
    getToken: getToken as () => Promise<string | null>,
    apiUrl: API_URL,
    activeChapter,
    projectData,
    activeChapterId,
    editorRef,
  });

  // --- Editor title ---
  const {
    editingTitle,
    titleValue,
    setTitleValue,
    handleTitleEdit,
    handleTitleSave,
    setEditingTitle,
  } = useEditorTitle({
    activeChapter,
    activeChapterId,
    handleChapterRename,
  });

  // --- Project actions ---
  const {
    projects: allProjects,
    renameDialogOpen,
    openRenameDialog,
    closeRenameDialog,
    renameProject,
    duplicateDialogOpen,
    openDuplicateDialog,
    closeDuplicateDialog,
    duplicateProject,
    isDuplicating,
    deleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    handleDeleteProject,
    driveFilesOpen,
    openDriveFiles,
    closeDriveFiles,
    refreshDriveFiles,
    connectDriveWithProject,
    disconnectDriveDialogOpen,
    openDisconnectDriveDialog,
    closeDisconnectDriveDialog,
    isConnectingDrive,
    onConnectProjectToDrive,
    disconnectProjectFromDrive,
  } = useProjectActions({
    getToken: getToken as () => Promise<string | null>,
    projectId,
    fetchDriveFiles: fetchFiles,
    resetDriveFiles,
    connectDrive,
    driveFolderId: projectData?.driveFolderId,
    onProjectConnected: handleProjectConnected,
    onProjectDisconnected: handleProjectDisconnected,
  });

  // --- Source materials (retained for Drive files sheet callbacks) ---
  const { openDriveBrowser } = useSourceActions(projectId);

  // --- Computed values ---
  const totalWordCount = projectData?.chapters.reduce((sum, ch) => sum + ch.wordCount, 0) ?? 0;

  const sidebarChapters: ChapterData[] =
    projectData?.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      wordCount: ch.wordCount,
      sortOrder: ch.sortOrder,
    })) ?? [];

  // --- Loading / Error states ---
  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      {/* First-time onboarding tooltips (#38) */}
      <OnboardingTooltips />

      {/* Crash recovery dialog */}
      {recoveryPrompt && (
        <CrashRecoveryDialog
          recovery={recoveryPrompt}
          onAccept={acceptRecovery}
          onDismiss={dismissRecovery}
        />
      )}

      <EditorSidebar
        chapters={sidebarChapters}
        activeChapterId={activeChapterId ?? undefined}
        onChapterSelect={handleChapterSelect}
        onAddChapter={handleAddChapter}
        onDeleteChapter={handleDeleteChapterRequest}
        onChapterRename={handleChapterRename}
        onChapterReorder={handleChapterReorder}
        totalWordCount={totalWordCount}
        activeChapterWordCount={currentWordCount}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebarCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOverlayOpen={mobileOverlayOpen}
        onOpenMobileOverlay={() => setMobileOverlayOpen(true)}
        onCloseMobileOverlay={() => setMobileOverlayOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {projectData && (
          <EditorToolbar
            projectData={projectData}
            allProjects={allProjects}
            totalWordCount={totalWordCount}
            saveStatus={saveStatus}
            onSaveRetry={saveNow}
            driveConnected={driveConnected}
            driveEmail={driveEmail}
            onConnectDriveWithProject={connectDriveWithProject}
            onViewDriveFiles={driveConnected ? openDriveFiles : undefined}
            selectionWordCount={selectionWordCount}
            aiSheetState={aiSheetState}
            onOpenAiRewrite={handleOpenAiRewrite}
            projectId={projectId}
            activeChapterId={activeChapterId}
            getToken={getToken as () => Promise<string | null>}
            apiUrl={API_URL}
            isResearchPanelOpen={isResearchPanelOpen}
            onToggleResearchPanel={() => {
              if (isResearchPanelOpen) {
                closeResearchPanel();
              } else {
                openResearchPanel();
              }
            }}
            hasDriveFolder={!!projectData.driveFolderId}
            onViewSources={() => openResearchPanel("sources")}
            onManageAccounts={() => setIsAccountsSheetOpen(true)}
            onDisconnectDrive={openDisconnectDriveDialog}
            onRenameBook={openRenameDialog}
            onDuplicateBook={openDuplicateDialog}
            isDuplicating={isDuplicating}
            onDeleteProject={openDeleteDialog}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />
        )}

        <EditorWritingArea
          editorRef={editorRef}
          currentContent={currentContent}
          onContentChange={handleContentChange}
          onSelectionWordCountChange={handleSelectionWordCountChange}
          activeChapter={activeChapter}
          editingTitle={editingTitle}
          titleValue={titleValue}
          onTitleValueChange={setTitleValue}
          onTitleEdit={handleTitleEdit}
          onTitleSave={handleTitleSave}
          onTitleEditCancel={() => setEditingTitle(false)}
          currentWordCount={currentWordCount}
          selectionWordCount={selectionWordCount}
        />
      </div>

      {/* Research Panel (#182) - side-by-side in landscape, overlay in portrait */}
      <ResearchPanel />

      <EditorDialogs
        projectData={projectData}
        projectId={projectId}
        // Delete project
        deleteDialogOpen={deleteDialogOpen}
        onDeleteProject={handleDeleteProject}
        onCloseDeleteDialog={closeDeleteDialog}
        // Rename project
        renameDialogOpen={renameDialogOpen}
        onRenameProject={renameProject}
        onCloseRenameDialog={closeRenameDialog}
        setProjectData={setProjectData}
        // Duplicate project
        duplicateDialogOpen={duplicateDialogOpen}
        onDuplicateProject={duplicateProject}
        onCloseDuplicateDialog={closeDuplicateDialog}
        // Delete chapter
        deleteChapterDialogOpen={deleteChapterDialogOpen}
        chapterToDelete={chapterToDelete}
        onDeleteChapter={handleDeleteChapter}
        onCloseDeleteChapterDialog={() => {
          setDeleteChapterDialogOpen(false);
          setChapterToDelete(null);
        }}
        // Disconnect Drive
        disconnectDriveDialogOpen={disconnectDriveDialogOpen}
        driveEmail={driveEmail}
        driveAccounts={driveAccounts}
        onDisconnectDriveAccount={disconnectDriveAccount}
        onCloseDisconnectDriveDialog={closeDisconnectDriveDialog}
        // AI Rewrite
        aiSheetState={aiSheetState}
        aiCurrentResult={aiCurrentResult}
        aiErrorMessage={aiErrorMessage}
        onAIAccept={handleAIAccept}
        onAIRetry={handleAIRetry}
        onAIDiscard={handleAIDiscard}
        onGoDeeper={handleGoDeeper}
        // Drive files
        driveFilesOpen={driveFilesOpen}
        driveFiles={driveFiles}
        driveFilesLoading={driveFilesLoading}
        driveFilesError={driveFilesError}
        isConnectingDrive={isConnectingDrive}
        isProjectConnected={!!projectData?.driveFolderId}
        onCloseDriveFiles={closeDriveFiles}
        onRefreshDriveFiles={refreshDriveFiles}
        onConnectProjectToDrive={onConnectProjectToDrive}
        onDisconnectProjectFromDrive={disconnectProjectFromDrive}
        onOpenSourcesPanel={() => openResearchPanel("sources")}
        onOpenDriveBrowser={openDriveBrowser}
        // Accounts sheet
        isAccountsSheetOpen={isAccountsSheetOpen}
        onCloseAccountsSheet={() => setIsAccountsSheetOpen(false)}
        onConnectAccount={() => connectDrive()}
        onRefetchDriveAccounts={refetchDriveAccounts}
        // Research panel (minimal props)
        isResearchPanelOpen={isResearchPanelOpen}
        onCloseResearchPanel={closeResearchPanel}
      />
    </div>
  );
}
