"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Sidebar, SidebarOverlay, type ChapterData } from "@/components/sidebar";
import { DriveStatusIndicator } from "@/components/drive-status-indicator";
import { ChapterEditor, type ChapterEditorHandle } from "@/components/chapter-editor";
import { AIRewriteSheet } from "@/components/ai-rewrite-sheet";
import { DriveFilesSheet } from "@/components/drive-files-sheet";
import { useDriveStatus } from "@/hooks/use-drive-status";
import { useDriveFiles } from "@/hooks/use-drive-files";
import { SaveIndicator } from "@/components/save-indicator";
import { CrashRecoveryDialog } from "@/components/crash-recovery-dialog";
import { ExportMenu } from "@/components/export-menu";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import { DeleteChapterDialog } from "@/components/delete-chapter-dialog";
import { DisconnectDriveDialog } from "@/components/disconnect-drive-dialog";
import { RenameProjectDialog } from "@/components/rename-project-dialog";
import { DuplicateProjectDialog } from "@/components/duplicate-project-dialog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useSignOut } from "@/hooks/use-sign-out";
import { OnboardingTooltips } from "@/components/onboarding-tooltips";
import { useChapterManagement } from "@/hooks/use-chapter-management";
import { useEditorAI } from "@/hooks/use-editor-ai";
import { useEditorTitle } from "@/hooks/use-editor-title";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useSourceActions } from "@/hooks/use-source-actions";
import { ProjectSwitcher } from "@/components/project-switcher";
import { SettingsMenu } from "@/components/settings-menu";
import { SourcesPanel } from "@/components/sources-panel";
import { SourceViewerSheet } from "@/components/source-viewer-sheet";

interface Chapter {
  id: string;
  title: string;
  sortOrder: number;
  wordCount: number;
  version: number;
  status: string;
}

/**
 * Shape returned by GET /projects/:projectId.
 * The API returns a flat object with project fields + chapters array,
 * NOT a nested { project, chapters } structure.
 */
interface ProjectData {
  id: string;
  title: string;
  description?: string;
  driveFolderId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
}

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
 * Per US-015: Three-tier auto-save (IndexedDB → Drive/R2 → D1 metadata).
 */
export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  // Editor ref for AI rewrite text replacement
  const editorRef = useRef<ChapterEditorHandle>(null);

  // Drive connection status (US-005, US-008)
  const {
    status: driveStatus,
    connect: connectDrive,
    disconnect: disconnectDrive,
  } = useDriveStatus();

  // Drive files listing (US-007)
  const {
    fetchFiles,
    files: driveFiles,
    isLoading: driveFilesLoading,
    error: driveFilesError,
    reset: resetDriveFiles,
  } = useDriveFiles();

  // Get active chapter for version
  const activeChapter = projectData?.chapters.find((ch) => ch.id === activeChapterId);

  // Three-tier auto-save hook (US-015)
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

  // Chapter management hook
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

  // AI rewrite hook (combines state + handlers)
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

  // Editor title hook
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

  // Word count state (US-024)
  const [selectionWordCount, setSelectionWordCount] = useState(0);

  // Fetch project data
  const fetchProjectData = useCallback(async () => {
    try {
      const token = await getToken();

      const projectResponse = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!projectResponse.ok) {
        if (projectResponse.status === 404) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Failed to load project");
      }

      const data: ProjectData = await projectResponse.json();
      setProjectData(data);

      if (data.chapters.length > 0 && !activeChapterId) {
        const sortedChapters = [...data.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
        setActiveChapterId(sortedChapters[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, projectId, router, activeChapterId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleProjectConnected = useCallback(
    async (driveFolderId: string) => {
      // Optimistically reflect connection in the current view.
      setProjectData((prev) => (prev ? { ...prev, driveFolderId } : prev));
      // Then refresh canonical server state.
      await fetchProjectData();
    },
    [fetchProjectData],
  );

  const handleProjectDisconnected = useCallback(async () => {
    setProjectData((prev) => (prev ? { ...prev, driveFolderId: null } : prev));
    await fetchProjectData();
  }, [fetchProjectData]);

  // Project actions: list, rename, duplicate, delete, Drive files, disconnect, connect project to Drive
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
    isConnectingDrive, // NEW
    onConnectProjectToDrive, // NEW
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
  // Source materials hook (facade over sources, content, and Picker)
  const {
    sources,
    isSourcesLoading,
    isSourcesPanelOpen,
    openSourcesPanel,
    closeSourcesPanel,
    isViewerOpen,
    activeSource,
    viewerContent,
    viewerWordCount,
    isContentLoading,
    openSourceViewer,
    closeSourceViewer,
    addFromPicker,
    isPickerLoading,
    removeSource,
    importSourceAsChapter,
    error: sourcesError,
  } = useSourceActions(projectId);

  // Load chapter content from API when active chapter changes
  useEffect(() => {
    if (!activeChapterId) return;

    let cancelled = false;

    async function loadContent() {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/chapters/${activeChapterId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (response.ok) {
          const data = (await response.json()) as { content: string; version: number };
          setContent(data.content || "");
        } else if (response.status === 404) {
          setContent("");
        }
      } catch (err) {
        console.error("Failed to load chapter content:", err);
        if (!cancelled) {
          setContent("");
        }
      }
    }

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [activeChapterId, getToken, setContent]);

  const handleSelectionWordCountChange = useCallback((count: number) => {
    setSelectionWordCount(count);
  }, []);

  const countWords = useCallback((html: string): number => {
    const text = html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 0 ? text.split(" ").length : 0;
  }, []);

  const currentWordCount = countWords(currentContent);

  const totalWordCount = projectData?.chapters.reduce((sum, ch) => sum + ch.wordCount, 0) ?? 0;

  const sidebarChapters: ChapterData[] =
    projectData?.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      wordCount: ch.wordCount,
      sortOrder: ch.sortOrder,
    })) ?? [];

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

      <div className="hidden lg:block">
        <Sidebar
          chapters={sidebarChapters}
          activeChapterId={activeChapterId ?? undefined}
          onChapterSelect={handleChapterSelect}
          onAddChapter={handleAddChapter}
          onDeleteChapter={handleDeleteChapterRequest}
          onChapterRename={handleChapterRename}
          onChapterReorder={handleChapterReorder}
          totalWordCount={totalWordCount}
          activeChapterWordCount={currentWordCount}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      <div className="lg:hidden">
        <Sidebar
          chapters={sidebarChapters}
          activeChapterId={activeChapterId ?? undefined}
          onChapterSelect={handleChapterSelect}
          onAddChapter={handleAddChapter}
          onDeleteChapter={handleDeleteChapterRequest}
          onChapterRename={handleChapterRename}
          onChapterReorder={handleChapterReorder}
          totalWordCount={totalWordCount}
          activeChapterWordCount={currentWordCount}
          collapsed={true}
          onToggleCollapsed={() => setMobileOverlayOpen(true)}
        />

        <SidebarOverlay isOpen={mobileOverlayOpen} onClose={() => setMobileOverlayOpen(false)}>
          <Sidebar
            chapters={sidebarChapters}
            activeChapterId={activeChapterId ?? undefined}
            onChapterSelect={handleChapterSelect}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapterRequest}
            onChapterRename={handleChapterRename}
            onChapterReorder={handleChapterReorder}
            totalWordCount={totalWordCount}
            activeChapterWordCount={currentWordCount}
            collapsed={false}
            onToggleCollapsed={() => setMobileOverlayOpen(false)}
          />
        </SidebarOverlay>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {projectData && (
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
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save status indicator (US-015) */}
            <SaveIndicator status={saveStatus} onRetry={saveNow} />

            <div className="w-px h-5 bg-border" aria-hidden="true" />

            {/* Persistent Drive connection status (US-005) */}
            {driveStatus && (
              <DriveStatusIndicator
                connected={driveStatus.connected}
                isProjectConnected={!!projectData?.driveFolderId} // NEW PROP
                email={driveStatus.email}
                onConnect={connectDriveWithProject}
                onViewFiles={
                  driveStatus.connected ? openDriveFiles : undefined
                }
              />
            )}

            {/* Toolbar AI Rewrite fallback — visible when text is selected */}
            {selectionWordCount > 0 && aiSheetState === "idle" && (
              <>
                <button
                  onClick={handleOpenAiRewrite}
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

            {/* SAVE_INDICATOR_PLACEHOLDER */}

            <ExportMenu
              projectId={projectId}
              activeChapterId={activeChapterId}
              getToken={getToken as () => Promise<string | null>}
              apiUrl={API_URL}
              driveConnected={driveStatus?.connected ?? false}
            />

            {/* Settings dropdown menu (US-023) */}
            <SettingsMenu
              driveConnected={driveStatus?.connected ?? false}
              hasDriveFolder={!!projectData?.driveFolderId}
              onViewDriveFiles={openDriveFiles}
              onViewSources={openSourcesPanel}
              onDisconnectDrive={openDisconnectDriveDialog}
              onRenameBook={openRenameDialog}
              onDuplicateBook={openDuplicateDialog}
              isDuplicating={isDuplicating}
              onDeleteProject={openDeleteDialog}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="max-w-[700px] mx-auto px-6 py-8">




            {/* Chapter title - editable at top of editor (US-011) */}
            {editingTitle ? (
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="text-3xl font-semibold text-foreground mb-6 outline-none w-full
                           border-b-2 border-blue-500 bg-transparent"
                autoFocus
                maxLength={200}
              />
            ) : (
              <h1
                className="text-3xl font-semibold text-foreground mb-6 outline-none cursor-text
                           hover:bg-gray-50 focus:bg-gray-50 focus:ring-2 focus:ring-blue-500
                           rounded px-1 -mx-1 transition-colors"
                onClick={handleTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTitleEdit();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Edit chapter title: ${activeChapter?.title || "Untitled Chapter"}`}
                title="Click to edit title"
              >
                {activeChapter?.title || "Untitled Chapter"}
              </h1>
            )}

            <ChapterEditor
              ref={editorRef}
              content={currentContent}
              onUpdate={handleContentChange}
              onSelectionWordCountChange={handleSelectionWordCountChange}
            />

            <div className="mt-4 flex items-center justify-end">
              <span className="text-sm text-muted-foreground tabular-nums">
                {selectionWordCount > 0
                  ? `${selectionWordCount.toLocaleString()} / ${currentWordCount.toLocaleString()} words`
                  : `${currentWordCount.toLocaleString()} words`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete project confirmation dialog (US-023) */}
      <DeleteProjectDialog
        projectTitle={projectData?.title || ""}
        isOpen={deleteDialogOpen}
        onConfirm={handleDeleteProject}
        onCancel={closeDeleteDialog}
      />

      {/* Rename book dialog */}
      <RenameProjectDialog
        isOpen={renameDialogOpen}
        projectTitle={projectData?.title || ""}
        onConfirm={async (newTitle) => {
          const success = await renameProject(projectId, newTitle);
          if (success) {
            setProjectData((prev) => (prev ? { ...prev, title: newTitle } : prev));
            closeRenameDialog();
          }
        }}
        onCancel={closeRenameDialog}
      />

      {/* Duplicate book confirmation dialog */}
      <DuplicateProjectDialog
        isOpen={duplicateDialogOpen}
        projectTitle={projectData?.title || ""}
        onConfirm={async () => {
          const newProjectId = await duplicateProject(projectId);
          closeDuplicateDialog();
          if (newProjectId) {
            router.push(`/editor/${newProjectId}`);
          }
        }}
        onCancel={closeDuplicateDialog}
      />

      {/* Delete chapter confirmation dialog (US-014) */}
      <DeleteChapterDialog
        chapterTitle={
          projectData?.chapters.find((ch) => ch.id === chapterToDelete)?.title || "Untitled Chapter"
        }
        isOpen={deleteChapterDialogOpen}
        onConfirm={handleDeleteChapter}
        onCancel={() => {
          setDeleteChapterDialogOpen(false);
          setChapterToDelete(null);
        }}
      />

      {/* Disconnect Google Drive confirmation dialog (US-008) */}
      <DisconnectDriveDialog
        email={driveStatus?.email}
        isOpen={disconnectDriveDialogOpen}
        onConfirm={async () => {
          await disconnectDrive();
          closeDisconnectDriveDialog();
        }}
        onCancel={closeDisconnectDriveDialog}
      />

      <AIRewriteSheet
        sheetState={aiSheetState}
        result={aiCurrentResult}
        errorMessage={aiErrorMessage}
        onAccept={handleAIAccept}
        onRetry={handleAIRetry}
        onDiscard={handleAIDiscard}
        onGoDeeper={handleGoDeeper}
      />

      {/* Drive files listing sheet (US-007) */}
      <DriveFilesSheet
        isOpen={driveFilesOpen}
        files={driveFiles}
        isLoading={driveFilesLoading || isConnectingDrive}
        error={driveFilesError}
        onClose={closeDriveFiles}
        onRefresh={refreshDriveFiles}
        onConnectDrive={onConnectProjectToDrive}
        onAddSources={async () => {
          openSourcesPanel();
          await addFromPicker();
        }}
        onViewSources={openSourcesPanel}
        onDisconnectProject={async () => {
          const confirmed = window.confirm(
            "Disconnect this project from its Drive folder? Your Drive account remains connected.",
          );
          if (!confirmed) return;
          await disconnectProjectFromDrive();
        }}
        isProjectConnected={!!projectData?.driveFolderId}
      />

      {/* Source materials panel */}
      <SourcesPanel
        isOpen={isSourcesPanelOpen}
        sources={sources}
        isLoading={isSourcesLoading}
        error={sourcesError}
        isPickerLoading={isPickerLoading}
        onClose={closeSourcesPanel}
        onAddFromPicker={addFromPicker}
        onViewSource={openSourceViewer}
        onImportAsChapter={async (sourceId) => {
          const result = await importSourceAsChapter(sourceId);
          if (result) {
            // Refresh project data to include the new chapter
            const token = await getToken();
            const response = await fetch(`${API_URL}/projects/${projectId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const data: ProjectData = await response.json();
              setProjectData(data);
              setActiveChapterId(result.chapterId);
            }
            closeSourcesPanel();
          }
        }}
        onRemoveSource={removeSource}
      />

      {/* Source content viewer */}
      <SourceViewerSheet
        isOpen={isViewerOpen}
        title={activeSource?.title ?? ""}
        content={viewerContent}
        wordCount={viewerWordCount}
        isLoading={isContentLoading}
        error={sourcesError}
        onClose={closeSourceViewer}
        onImportAsChapter={async () => {
          if (!activeSource) return;
          const result = await importSourceAsChapter(activeSource.id);
          if (result) {
            const token = await getToken();
            const response = await fetch(`${API_URL}/projects/${projectId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const data: ProjectData = await response.json();
              setProjectData(data);
              setActiveChapterId(result.chapterId);
            }
            closeSourcesPanel();
          }
        }}
      />
    </div>
  );
}
