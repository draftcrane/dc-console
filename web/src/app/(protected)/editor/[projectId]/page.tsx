"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import type { ChapterData } from "@/components/layout/sidebar";
import type { TextEditorHandle } from "@/components/editor/text-editor";
import { OnboardingTooltips } from "@/components/editor/onboarding-tooltips";
import { CrashRecoveryDialog } from "@/components/editor/crash-recovery-dialog";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { EditorWritingArea } from "@/components/editor/editor-writing-area";
import { EditorDialogs } from "@/components/editor/editor-dialogs";
import { EditorPanel, EditorPanelOverlay } from "@/components/editor/editor-panel";
import { ChapterEditorPanel } from "@/components/editor/chapter-editor-panel";
import { ToastProvider } from "@/components/toast";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useSignOut } from "@/hooks/use-sign-out";
import { useChapterManagement } from "@/hooks/use-chapter-management";
import { useEditorAI } from "@/hooks/use-editor-ai";
import { useEditorTitle } from "@/hooks/use-editor-title";
import { useProjectActions } from "@/hooks/use-project-actions";
import { useEditorProject } from "@/hooks/use-editor-project";
import { useChapterContent } from "@/hooks/use-chapter-content";
import { useViewMode } from "@/hooks/use-view-mode";
import { SourcesProvider } from "@/contexts/sources-context";
import { SourcesPanel } from "@/components/sources/sources-panel";
import { SourcesPanelOverlay } from "@/components/sources/sources-panel-overlay";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Writing Environment Page
 *
 * This component is the orchestrator: it wires together hooks and delegates
 * all UI rendering to focused child components.
 */
export default function EditorPage() {
  return (
    <ToastProvider>
      <EditorPageInner />
    </ToastProvider>
  );
}

function EditorPageInner() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  // Editor ref for AI rewrite text replacement
  const editorRef = useRef<TextEditorHandle>(null);

  // View mode state with URL sync (#318)
  const { viewMode, setViewMode } = useViewMode();

  // --- Core project data ---
  const { projectData, setProjectData, activeChapterId, setActiveChapterId, isLoading, error } =
    useEditorProject({
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

  // --- Editor Panel state (#317) ---
  const [editorPanelOpen, setEditorPanelOpen] = useState(false);
  const [editorSelectedText, setEditorSelectedText] = useState("");

  // Read selected text from editor whenever selection changes
  const handleEditorSelectionUpdate = useCallback(() => {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      setEditorSelectedText("");
      return;
    }
    const selected = editor.state.doc.textBetween(from, to, "\n");
    setEditorSelectedText(selected.trim() ? selected : "");
  }, []);

  // Clear stale selected text when editor loses focus (#357)
  // Without this, clicking outside the editor leaves editorSelectedText
  // set from the previous selection, causing the instruction panel to
  // show "Selected text" when nothing is visually selected.
  // Exception: keep selection alive while the editor panel is open —
  // the panel needs the selected text to offer rewrite instructions.
  const handleEditorBlur = useCallback(() => {
    setTimeout(() => {
      if (editorPanelOpen) return; // Panel needs the selection
      const editor = editorRef.current?.getEditor();
      if (!editor?.isFocused) {
        setEditorSelectedText("");
      }
    }, 200);
  }, [editorPanelOpen]);

  const handleToggleEditorPanel = useCallback(() => {
    setEditorPanelOpen((prev) => !prev);
  }, []);

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
  } = useProjectActions({
    getToken: getToken as () => Promise<string | null>,
    projectId,
  });

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
    <SourcesProvider projectId={projectId} editorRef={editorRef}>
      <div className="flex h-[calc(100dvh-3.5rem)]">
        <OnboardingTooltips />

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

        <EditorPanel isOpen={editorPanelOpen} onClose={() => setEditorPanelOpen(false)}>
          <ChapterEditorPanel
            sheetState={aiSheetState}
            result={aiCurrentResult}
            errorMessage={aiErrorMessage}
            selectedText={editorSelectedText}
            onAccept={handleAIAccept}
            onRetry={handleAIRetry}
            onDiscard={handleAIDiscard}
            onGoDeeper={handleGoDeeper}
            onRewriteWithInstruction={() => {
              handleOpenAiRewrite();
            }}
          />
        </EditorPanel>

        <div className="flex-1 flex flex-col min-w-0">
          {projectData && (
            <EditorToolbar
              projectData={projectData}
              allProjects={allProjects}
              totalWordCount={totalWordCount}
              saveStatus={saveStatus}
              onSaveRetry={saveNow}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isEditorPanelOpen={editorPanelOpen}
              onToggleEditorPanel={handleToggleEditorPanel}
              projectId={projectId}
              activeChapterId={activeChapterId}
              getToken={getToken as () => Promise<string | null>}
              apiUrl={API_URL}
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
            onSelectionUpdate={handleEditorSelectionUpdate}
            onBlur={handleEditorBlur}
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

        <SourcesPanel />

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
        />

        <SourcesPanelOverlay />

        <EditorPanelOverlay isOpen={editorPanelOpen} onClose={() => setEditorPanelOpen(false)}>
          <ChapterEditorPanel
            sheetState={aiSheetState}
            result={aiCurrentResult}
            errorMessage={aiErrorMessage}
            selectedText={editorSelectedText}
            onAccept={handleAIAccept}
            onRetry={handleAIRetry}
            onDiscard={handleAIDiscard}
            onGoDeeper={handleGoDeeper}
            onRewriteWithInstruction={() => {
              handleOpenAiRewrite();
            }}
          />
        </EditorPanelOverlay>
      </div>
    </SourcesProvider>
  );
}
