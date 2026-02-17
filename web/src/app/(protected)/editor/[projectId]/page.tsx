"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Sidebar, SidebarOverlay, type ChapterData } from "@/components/sidebar";
import { DriveBanner } from "@/components/drive-banner";
import { DriveStatusIndicator } from "@/components/drive-status-indicator";
import { ChapterEditor, type ChapterEditorHandle } from "@/components/chapter-editor";
import { AIRewriteSheet, type AIRewriteResult } from "@/components/ai-rewrite-sheet";
import { DriveFilesSheet } from "@/components/drive-files-sheet";
import { useAIRewrite } from "@/hooks/use-ai-rewrite";
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

  // AI rewrite hook
  const aiRewrite = useAIRewrite({
    getToken,
    apiUrl: API_URL,
  });

  // Editor state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

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

  // Ref to hold saveNow for chapter switch
  const saveNowRef = useRef(saveNow);
  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  // Word count state (US-024)
  const [selectionWordCount, setSelectionWordCount] = useState(0);

  // Settings menu and delete dialog state (US-023)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Delete chapter dialog state (US-014)
  const [deleteChapterDialogOpen, setDeleteChapterDialogOpen] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);

  // Disconnect Drive dialog state (US-008)
  const [disconnectDriveDialogOpen, setDisconnectDriveDialogOpen] = useState(false);

  // AI rewrite state
  const abortControllerRef = useRef<AbortController | null>(null);
  const rewriteContextRef = useRef<{
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    firstInteractionId?: string;
  } | null>(null);

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

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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

  // Handle chapter selection - save current chapter before switching
  const handleChapterSelect = useCallback(
    async (chapterId: string) => {
      if (activeChapterId && currentContent) {
        await saveNowRef.current();
      }
      setActiveChapterId(chapterId);
      setMobileOverlayOpen(false);
    },
    [activeChapterId, currentContent],
  );

  // Handle add chapter
  const handleAddChapter = useCallback(async () => {
    if (!projectData) return;

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/chapters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Untitled Chapter",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create chapter");
      }

      const newChapter: Chapter = await response.json();

      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: [...prev.chapters, newChapter],
        };
      });

      setActiveChapterId(newChapter.id);
    } catch (err) {
      console.error("Failed to add chapter:", err);
    }
  }, [projectData, projectId, getToken]);

  /**
   * Rename a chapter via the API.
   * Shared by both the sidebar inline rename (US-013) and editor title field.
   * Empty title reverts to "Untitled Chapter" per acceptance criteria.
   */
  const handleChapterRename = useCallback(
    async (chapterId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      const finalTitle = trimmed || "Untitled Chapter";

      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/chapters/${chapterId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: finalTitle }),
        });

        if (response.ok) {
          setProjectData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              chapters: prev.chapters.map((ch) =>
                ch.id === chapterId ? { ...ch, title: finalTitle } : ch,
              ),
            };
          });
        }
      } catch (err) {
        console.error("Failed to update chapter title:", err);
      }
    },
    [getToken],
  );

  /**
   * Reorder chapters via the API (US-012A).
   * Optimistically updates local state, then persists to the server.
   * Drive file names are NOT renamed on reorder (per acceptance criteria).
   */
  const handleChapterReorder = useCallback(
    async (chapterIds: string[]) => {
      if (!projectData) return;

      // Optimistic update: assign new sortOrder based on position
      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: prev.chapters.map((ch) => {
            const newIndex = chapterIds.indexOf(ch.id);
            return newIndex !== -1 ? { ...ch, sortOrder: newIndex + 1 } : ch;
          }),
        };
      });

      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/chapters/reorder`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ chapterIds }),
        });

        if (!response.ok) {
          throw new Error("Failed to reorder chapters");
        }

        // Sync with server response
        const data = (await response.json()) as { chapters: Chapter[] };
        setProjectData((prev) => {
          if (!prev) return prev;
          return { ...prev, chapters: data.chapters };
        });
      } catch (err) {
        console.error("Failed to reorder chapters:", err);
        // Revert optimistic update by re-fetching
        try {
          const token = await getToken();
          const response = await fetch(`${API_URL}/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data: ProjectData = await response.json();
            setProjectData(data);
          }
        } catch {
          // Silent fallback - user can refresh
        }
      }
    },
    [projectData, projectId, getToken],
  );

  // Handle editor title field save (wraps handleChapterRename for the active chapter)
  const handleTitleSave = useCallback(async () => {
    if (!activeChapterId) {
      setEditingTitle(false);
      return;
    }

    await handleChapterRename(activeChapterId, titleValue);
    setEditingTitle(false);
  }, [activeChapterId, titleValue, handleChapterRename]);

  const handleTitleEdit = useCallback(() => {
    if (activeChapter) {
      setTitleValue(activeChapter.title);
      setEditingTitle(true);
    }
  }, [activeChapter]);

  // Settings menu: close on outside click (US-023)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    }

    if (settingsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [settingsMenuOpen]);

  // Settings menu: close on Escape (US-023)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsMenuOpen(false);
      }
    }

    if (settingsMenuOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [settingsMenuOpen]);

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

  // Handle opening delete chapter dialog (US-014)
  const handleDeleteChapterRequest = useCallback((chapterId: string) => {
    setChapterToDelete(chapterId);
    setDeleteChapterDialogOpen(true);
  }, []);

  // Handle chapter deletion (US-014)
  const handleDeleteChapter = useCallback(async () => {
    if (!chapterToDelete || !projectData) return;

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/chapters/${chapterToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const code = (body as { code?: string } | null)?.code;
        if (code === "LAST_CHAPTER") {
          console.error("Cannot delete the last chapter of a project");
          setDeleteChapterDialogOpen(false);
          setChapterToDelete(null);
          return;
        }
        throw new Error("Failed to delete chapter");
      }

      // Determine the adjacent chapter to navigate to
      const sortedChapters = [...projectData.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
      const deletedIndex = sortedChapters.findIndex((ch) => ch.id === chapterToDelete);
      const remainingChapters = sortedChapters.filter((ch) => ch.id !== chapterToDelete);

      // Navigate to the next chapter, or the previous if we deleted the last one
      let nextChapterId: string | null = null;
      if (remainingChapters.length > 0) {
        if (deletedIndex < remainingChapters.length) {
          nextChapterId = remainingChapters[deletedIndex].id;
        } else {
          nextChapterId = remainingChapters[remainingChapters.length - 1].id;
        }
      }

      // Update local state - remove deleted chapter
      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: prev.chapters.filter((ch) => ch.id !== chapterToDelete),
        };
      });

      // Navigate to adjacent chapter if the deleted one was active
      if (chapterToDelete === activeChapterId && nextChapterId) {
        setActiveChapterId(nextChapterId);
      }

      setDeleteChapterDialogOpen(false);
      setChapterToDelete(null);
    } catch (err) {
      console.error("Failed to delete chapter:", err);
      setDeleteChapterDialogOpen(false);
      setChapterToDelete(null);
    }
  }, [chapterToDelete, projectData, getToken, activeChapterId]);

  // AI rewrite: request rewrite via SSE streaming (progressive — opens sheet immediately)
  const requestRewrite = useCallback(
    async (
      selectedText: string,
      instruction: string,
      contextBefore: string,
      contextAfter: string,
      tier?: "edge" | "frontier",
      parentInteractionId?: string,
    ) => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Open the sheet immediately — user sees it before tokens arrive
      aiRewrite.startStreaming(selectedText, instruction, tier ?? "frontier");

      try {
        const token = await getToken();
        if (!token) {
          aiRewrite.abortStreaming("Authentication required");
          return;
        }

        const response = await fetch(`${API_URL}/ai/rewrite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            selectedText,
            instruction,
            contextBefore,
            contextAfter,
            chapterTitle: activeChapter?.title || "",
            projectDescription: projectData?.description || "",
            chapterId: activeChapterId || "",
            parentInteractionId,
            ...(tier && { tier }),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          if (response.status === 429) {
            const body = await response.json().catch(() => null);
            const msg =
              (body as { message?: string } | null)?.message ||
              "You've used AI rewrite frequently. Please wait a moment.";
            aiRewrite.abortStreaming(msg);
          } else {
            aiRewrite.abortStreaming("Something went wrong. Please try again.");
          }
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          aiRewrite.abortStreaming("No response received");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let interactionId = "";
        let attemptNumber = 1;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data) continue;

              try {
                const event = JSON.parse(data) as {
                  type: string;
                  text?: string;
                  message?: string;
                  interactionId?: string;
                  attemptNumber?: number;
                  tier?: "edge" | "frontier";
                };

                if (event.type === "start" && event.interactionId) {
                  interactionId = event.interactionId;
                  attemptNumber = event.attemptNumber ?? 1;

                  // Update result with server-resolved tier
                  if (event.tier) {
                    aiRewrite.setTier(event.tier);
                  }

                  // Track the first interaction ID for retry chains
                  if (attemptNumber === 1 && rewriteContextRef.current) {
                    rewriteContextRef.current.firstInteractionId = interactionId;
                  }
                }

                if (event.type === "token" && event.text) {
                  aiRewrite.appendToken(event.text);
                }

                if (event.type === "done" && event.interactionId) {
                  interactionId = event.interactionId;
                }

                if (event.type === "error" && event.message) {
                  aiRewrite.abortStreaming(event.message);
                  return;
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Finalize — interactionId from start event or done event
        const resultId = interactionId || crypto.randomUUID();
        if (!aiRewrite.hasTokens()) {
          aiRewrite.abortStreaming("No rewrite was generated. Please try again.");
          return;
        }
        aiRewrite.completeStreaming(resultId, attemptNumber);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          aiRewrite.abortStreaming();
          return;
        }
        console.error("AI rewrite streaming error:", err);
        aiRewrite.abortStreaming("Connection error. Please try again.");
      }
    },
    [getToken, activeChapter, projectData, activeChapterId, aiRewrite],
  );

  const handleSelectionWordCountChange = useCallback((count: number) => {
    setSelectionWordCount(count);
  }, []);

  const handleOpenAiRewrite = useCallback(() => {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    const selected = editor.state.doc.textBetween(from, to, "\n");
    if (!selected.trim()) return;

    const textBeforeSelection = editor.state.doc.textBetween(0, from, "\n");
    const before = textBeforeSelection.slice(-500);

    const docLength = editor.state.doc.content.size;
    const textAfterSelection = editor.state.doc.textBetween(to, docLength, "\n");
    const after = textAfterSelection.slice(0, 500);

    rewriteContextRef.current = {
      selectedText: selected,
      contextBefore: before,
      contextAfter: after,
    };

    requestRewrite(selected, "Improve this text", before, after);
  }, [requestRewrite]);

  const handleAIAccept = useCallback(
    async (result: AIRewriteResult) => {
      if (editorRef.current) {
        const replaced = editorRef.current.replaceText(result.originalText, result.rewriteText);
        if (!replaced) {
          // Text changed since rewrite was requested — user can copy manually
          aiRewrite.abortStreaming(
            "The selected text has changed. Please select it again and retry. You can copy the rewrite text above.",
          );
          return;
        }
      }

      await aiRewrite.handleAccept(result);
      rewriteContextRef.current = null;
    },
    [aiRewrite],
  );

  const handleAIRetry = useCallback(
    async (result: AIRewriteResult, instruction: string) => {
      await aiRewrite.handleRetry(result, instruction);

      const ctx = rewriteContextRef.current;
      if (ctx) {
        requestRewrite(
          ctx.selectedText,
          instruction,
          ctx.contextBefore,
          ctx.contextAfter,
          undefined,
          ctx.firstInteractionId,
        );
      }
    },
    [aiRewrite, requestRewrite],
  );

  const handleAIDiscard = useCallback(
    async (result: AIRewriteResult) => {
      // Abort any in-flight request
      abortControllerRef.current?.abort();
      await aiRewrite.handleDiscard(result);
      rewriteContextRef.current = null;
    },
    [aiRewrite],
  );

  const handleGoDeeper = useCallback(
    (result: AIRewriteResult) => {
      const ctx = rewriteContextRef.current;
      if (!ctx) return;

      // Re-submit same text/instruction with frontier tier
      requestRewrite(
        ctx.selectedText,
        result.instruction,
        ctx.contextBefore,
        ctx.contextAfter,
        "frontier",
        ctx.firstInteractionId,
      );
    },
    [requestRewrite],
  );

  const countWords = useCallback((html: string): number => {
    const text = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text ? text.split(" ").length : 0;
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
            <h2 className="text-sm font-medium text-foreground truncate">{projectData?.title}</h2>
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
            {selectionWordCount > 0 && aiRewrite.sheetState === "idle" && (
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
            <div className="relative" ref={settingsMenuRef}>
              <button
                onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Settings"
                aria-expanded={settingsMenuOpen}
                aria-haspopup="true"
              >
                <svg
                  className="w-5 h-5 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {settingsMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                  role="menu"
                  aria-label="Project settings"
                >
                  {/* View Drive Files (US-007) - shown when Drive is connected and project has a folder */}
                  {driveStatus?.connected && projectData?.driveFolderId && (
                    <>
                      <button
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          openDriveFiles();
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100
                                   transition-colors min-h-[44px] flex items-center gap-2"
                        role="menuitem"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
                        </svg>
                        View Drive Files
                      </button>
                      <div className="my-1 border-t border-gray-200" role="separator" />
                    </>
                  )}

                  {/* Disconnect Google Drive (US-008) - only shown when connected */}
                  {driveStatus?.connected && (
                    <>
                      <button
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          setDisconnectDriveDialogOpen(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100
                                   transition-colors min-h-[44px] flex items-center gap-2"
                        role="menuitem"
                      >
                        <svg
                          className="w-4 h-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18"
                          />
                        </svg>
                        Disconnect Google Drive
                      </button>
                      <div className="my-1 border-t border-gray-200" role="separator" />
                    </>
                  )}

                  <button
                    onClick={() => {
                      setSettingsMenuOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50
                               transition-colors min-h-[44px] flex items-center gap-2"
                    role="menuitem"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete Project
                  </button>

                  {/* Separator */}
                  <div className="my-1 border-t border-gray-200" role="separator" />

                  {/* Sign out (US-003) */}
                  <button
                    onClick={() => {
                      setSettingsMenuOpen(false);
                      handleSignOut();
                    }}
                    disabled={isSigningOut}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100
                               transition-colors min-h-[44px] flex items-center gap-2
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    role="menuitem"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    {isSigningOut ? "Signing out\u2026" : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
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
        sheetState={aiRewrite.sheetState}
        result={aiRewrite.currentResult}
        errorMessage={aiRewrite.errorMessage}
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
