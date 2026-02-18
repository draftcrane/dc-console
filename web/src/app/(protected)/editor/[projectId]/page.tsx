"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Sidebar, SidebarOverlay, type ChapterData } from "@/components/sidebar";
import { DriveBanner } from "@/components/drive-banner";
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
import { useAutoSave } from "@/hooks/use-auto-save";
import { useSignOut } from "@/hooks/use-sign-out";
import { OnboardingTooltips } from "@/components/onboarding-tooltips";
import { useChapterManagement } from "@/hooks/use-chapter-management";
import { useEditorAI } from "@/hooks/use-editor-ai";
import { useEditorTitle } from "@/hooks/use-editor-title";
import { useProjectActions } from "@/hooks/use-project-actions";
import { ProjectSwitcher } from "@/components/project-switcher";
import { SettingsMenu } from "@/components/settings-menu";

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
  const [driveFilesOpen, setDriveFilesOpen] = useState(false);

  /**
   * Connect Drive with project context (US-006).
   * Stores the project ID in sessionStorage so the Drive success page
   * can auto-create the book folder after OAuth completes.
   */
  const connectDriveWithProject = useCallback(() => {
    sessionStorage.setItem("dc_pending_drive_project", projectId);
    connectDrive();
  }, [projectId, connectDrive]);

  /**
   * Open the Drive files sheet (US-007).
   * Fetches the file list from the project's Book Folder.
   */
  const openDriveFiles = useCallback(() => {
    const folderId = projectData?.driveFolderId;
    if (!folderId) return;
    setDriveFilesOpen(true);
    fetchFiles(folderId);
  }, [projectData, fetchFiles]);

  const closeDriveFiles = useCallback(() => {
    setDriveFilesOpen(false);
    resetDriveFiles();
  }, [resetDriveFiles]);

  const refreshDriveFiles = useCallback(() => {
    const folderId = projectData?.driveFolderId;
    if (!folderId) return;
    fetchFiles(folderId);
  }, [projectData, fetchFiles]);

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

  // Delete dialog state (US-023)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Disconnect Drive dialog state (US-008)
  const [disconnectDriveDialogOpen, setDisconnectDriveDialogOpen] = useState(false);

  // Project actions: list (for switcher), rename, duplicate
  const {
    projects: allProjects,
    renameDialogOpen,
    openRenameDialog,
    closeRenameDialog,
    renameProject,
    isRenaming,
    duplicateDialogOpen,
    openDuplicateDialog,
    closeDuplicateDialog,
    duplicateProject,
    isDuplicating,
  } = useProjectActions({
    getToken: getToken as () => Promise<string | null>,
  });

  // Rename dialog local state
  const [renameValue, setRenameValue] = useState("");

  const handleOpenRenameDialog = useCallback(() => {
    setRenameValue(projectData?.title || "");
    openRenameDialog();
  }, [projectData, openRenameDialog]);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameValue.trim()) return;
    const success = await renameProject(projectId, renameValue.trim());
    if (success) {
      setProjectData((prev) => (prev ? { ...prev, title: renameValue.trim() } : prev));
      closeRenameDialog();
    }
  }, [projectId, renameValue, renameProject, closeRenameDialog, setProjectData]);

  const handleDuplicateConfirm = useCallback(async () => {
    const newProjectId = await duplicateProject(projectId);
    closeDuplicateDialog();
    if (newProjectId) {
      router.push(`/editor/${newProjectId}`);
    }
  }, [projectId, duplicateProject, closeDuplicateDialog, router]);

  // Fetch project data
  useEffect(() => {
    async function fetchData() {
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
    }

    fetchData();
  }, [projectId, getToken, router, activeChapterId]);

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

  // Handle project deletion (US-023)
  const handleDeleteProject = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      // Check if user has other projects to determine redirect target
      const meResponse = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (meResponse.ok) {
        const meData = (await meResponse.json()) as { projects: { id: string }[] };
        if (meData.projects.length > 0) {
          router.push("/dashboard");
        } else {
          router.push("/setup");
        }
      } else {
        // Fallback: redirect to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
      setDeleteDialogOpen(false);
    }
  }, [getToken, projectId, router]);

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
            {/* Persistent Drive connection status (US-005) */}
            {driveStatus && (
              <DriveStatusIndicator
                connected={driveStatus.connected}
                email={driveStatus.email}
                onConnect={connectDriveWithProject}
                onViewFiles={
                  driveStatus.connected && projectData?.driveFolderId ? openDriveFiles : undefined
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

            <div className="w-px h-5 bg-border" aria-hidden="true" />

            {/* Save status indicator (US-015) */}
            <SaveIndicator status={saveStatus} />

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
              onDisconnectDrive={() => setDisconnectDriveDialogOpen(true)}
              onRenameBook={handleOpenRenameDialog}
              onDuplicateBook={openDuplicateDialog}
              isDuplicating={isDuplicating}
              onDeleteProject={() => setDeleteDialogOpen(true)}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="max-w-[700px] mx-auto px-6 py-8">
            {/* Drive connection banner - contextual, not blocking (US-005) */}
            {driveStatus && !driveStatus.connected && (
              <div className="mb-6">
                <DriveBanner
                  connected={false}
                  dismissible={true}
                  onConnect={connectDriveWithProject}
                />
              </div>
            )}

            {/* Drive connected confirmation banner */}
            {driveStatus?.connected && (
              <div className="mb-6">
                <DriveBanner connected={true} email={driveStatus.email} dismissible={true} />
              </div>
            )}

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
        onCancel={() => setDeleteDialogOpen(false)}
      />

      {/* Rename book dialog */}
      {renameDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h2 id="rename-dialog-title" className="text-lg font-semibold text-gray-900 mb-4">
              Rename Book
            </h2>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") closeRenameDialog();
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={closeRenameDialog}
                disabled={isRenaming}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                           hover:bg-gray-200 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={isRenaming || !renameValue.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg
                           hover:bg-gray-800 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRenaming ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate book confirmation dialog */}
      {duplicateDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h2 id="duplicate-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
              Duplicate Book
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Duplicate &ldquo;{projectData?.title}&rdquo;? This creates a full copy of all
              chapters.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDuplicateDialog}
                disabled={isDuplicating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                           hover:bg-gray-200 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicateConfirm}
                disabled={isDuplicating}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg
                           hover:bg-gray-800 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDuplicating ? "Duplicating..." : "Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}

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
          setDisconnectDriveDialogOpen(false);
        }}
        onCancel={() => setDisconnectDriveDialogOpen(false)}
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
        isLoading={driveFilesLoading}
        error={driveFilesError}
        onClose={closeDriveFiles}
        onRefresh={refreshDriveFiles}
      />
    </div>
  );
}
