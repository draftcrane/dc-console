"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Sidebar, SidebarOverlay, type ChapterData } from "@/components/sidebar";
import { DriveBanner } from "@/components/drive-banner";
import { ChapterEditor, type ChapterEditorHandle } from "@/components/chapter-editor";
import { AIRewriteSheet, type AIRewriteResult } from "@/components/ai-rewrite-sheet";
import { useAIRewrite } from "@/hooks/use-ai-rewrite";
import { SaveIndicator } from "@/components/save-indicator";
import { CrashRecoveryDialog } from "@/components/crash-recovery-dialog";
import { useAutoSave } from "@/hooks/use-auto-save";

interface Project {
  id: string;
  title: string;
  description?: string;
  driveFolderId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DriveStatus {
  connected: boolean;
  email?: string;
}

interface Chapter {
  id: string;
  title: string;
  sortOrder: number;
  wordCount: number;
  version: number;
  status: string;
}

interface ProjectData {
  project: Project;
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
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  // Editor ref for AI rewrite text replacement
  const editorRef = useRef<ChapterEditorHandle>(null);

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

  // Ref to hold saveNow for chapter switch
  const saveNowRef = useRef(saveNow);
  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  // Word count state (US-024)
  const [selectionWordCount, setSelectionWordCount] = useState(0);

  // AI rewrite state
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [isStreamingRewrite, setIsStreamingRewrite] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rewriteContextRef = useRef<{
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    firstInteractionId?: string;
  } | null>(null);

  // Fetch project data and drive status
  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();

        const [projectResponse, userResponse] = await Promise.all([
          fetch(`${API_URL}/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

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

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setDriveStatus(userData.drive);
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

  // Handle chapter title update
  const handleTitleSave = useCallback(async () => {
    if (!activeChapterId || !titleValue.trim()) {
      setEditingTitle(false);
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/chapters/${activeChapterId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: titleValue.trim() }),
      });

      if (response.ok) {
        setProjectData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            chapters: prev.chapters.map((ch) =>
              ch.id === activeChapterId ? { ...ch, title: titleValue.trim() } : ch,
            ),
          };
        });
      }
    } catch (err) {
      console.error("Failed to update chapter title:", err);
    } finally {
      setEditingTitle(false);
    }
  }, [activeChapterId, titleValue, getToken]);

  const handleTitleEdit = useCallback(() => {
    if (activeChapter) {
      setTitleValue(activeChapter.title);
      setEditingTitle(true);
    }
  }, [activeChapter]);

  // AI rewrite: request rewrite via SSE streaming
  const requestRewrite = useCallback(
    async (
      selectedText: string,
      instruction: string,
      contextBefore: string,
      contextAfter: string,
      attemptNumber: number,
      parentInteractionId?: string,
    ) => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsStreamingRewrite(true);

      try {
        const token = await getToken();
        if (!token) return;

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
            projectDescription: projectData?.project.description || "",
            chapterId: activeChapterId || "",
            parentInteractionId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          if (response.status === 429) {
            const body = await response.json().catch(() => null);
            const msg =
              (body as { message?: string } | null)?.message ||
              "You've used AI rewrite frequently. Please wait a moment.";
            setRateLimitMessage(msg);
            setTimeout(() => setRateLimitMessage(null), 5000);
          }
          setIsStreamingRewrite(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setIsStreamingRewrite(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";
        let interactionId = "";

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
                };

                if (event.type === "token" && event.text) {
                  streamedText += event.text;
                }

                if (event.type === "done" && event.interactionId) {
                  interactionId = event.interactionId;
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        if (streamedText) {
          const resultId = interactionId || crypto.randomUUID();

          // Track the first interaction ID for retry chains
          if (attemptNumber === 1 && rewriteContextRef.current) {
            rewriteContextRef.current.firstInteractionId = resultId;
          }

          const result: AIRewriteResult = {
            interactionId: resultId,
            originalText: selectedText,
            rewriteText: streamedText,
            instruction,
            attemptNumber,
          };
          aiRewrite.showResult(result);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("AI rewrite streaming error:", err);
      } finally {
        setIsStreamingRewrite(false);
      }
    },
    [getToken, activeChapter, projectData, activeChapterId, aiRewrite],
  );

  const handleSelectionChange = useCallback((hasSelection: boolean) => {
    setHasTextSelection(hasSelection);
  }, []);

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

    requestRewrite(selected, "Improve this text", before, after, 1);
  }, [requestRewrite]);

  const handleAIAccept = useCallback(
    async (result: AIRewriteResult) => {
      const accepted = await aiRewrite.handleAccept(result);

      if (editorRef.current) {
        editorRef.current.replaceText(accepted.originalText, accepted.rewriteText);
      }

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
          result.attemptNumber + 1,
          ctx.firstInteractionId,
        );
      }
    },
    [aiRewrite, requestRewrite],
  );

  const handleAIDiscard = useCallback(
    async (result: AIRewriteResult) => {
      await aiRewrite.handleDiscard(result);
      rewriteContextRef.current = null;
    },
    [aiRewrite],
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
            <h2 className="text-sm font-medium text-foreground truncate">
              {projectData?.project.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Save status indicator (US-015) */}
            <SaveIndicator status={saveStatus} />

            <button
              className="h-9 px-3 text-sm rounded-lg hover:bg-gray-100 transition-colors min-w-[44px]"
              aria-label="Export"
            >
              Export
            </button>

            <button
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Settings"
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
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="max-w-[700px] mx-auto px-6 py-8">
            {/* Drive connection banner - contextual, not blocking */}
            {driveStatus && !driveStatus.connected && (
              <div className="mb-6">
                <DriveBanner connected={false} dismissible={true} />
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
              onRewrite={handleOpenAiRewrite}
              onSelectionChange={handleSelectionChange}
              onSelectionWordCountChange={handleSelectionWordCountChange}
            />

            {rateLimitMessage && (
              <div
                role="alert"
                className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"
              >
                {rateLimitMessage}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="h-9">
                {hasTextSelection && !isStreamingRewrite && (
                  <button
                    onClick={handleOpenAiRewrite}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                               text-blue-700 bg-blue-50 border border-blue-200 rounded-lg
                               hover:bg-blue-100 transition-colors min-h-[36px]"
                    aria-label="AI Rewrite selected text"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    AI Rewrite
                  </button>
                )}
                {isStreamingRewrite && (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Rewriting...
                  </div>
                )}
              </div>

              <span className="text-sm text-muted-foreground tabular-nums">
                {selectionWordCount > 0
                  ? `${selectionWordCount.toLocaleString()} / ${currentWordCount.toLocaleString()} words`
                  : `${currentWordCount.toLocaleString()} words`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AIRewriteSheet
        isOpen={aiRewrite.isSheetOpen}
        result={aiRewrite.currentResult}
        isRetrying={aiRewrite.isRetrying || isStreamingRewrite}
        onAccept={handleAIAccept}
        onRetry={handleAIRetry}
        onDiscard={handleAIDiscard}
      />
    </div>
  );
}
