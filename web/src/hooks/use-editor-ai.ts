"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAIRewrite, type SheetState, type AIRewriteResult } from "@/hooks/use-ai-rewrite";
import type { ChapterEditorHandle } from "@/components/editor/chapter-editor";

interface Chapter {
  id: string;
  title: string;
  sortOrder: number;
  wordCount: number;
  version: number;
  status: string;
}

interface ProjectData {
  id: string;
  title: string;
  description?: string;
  chapters: Chapter[];
}

interface UseEditorAIOptions {
  getToken: () => Promise<string | null>;
  apiUrl: string;
  activeChapter: Chapter | undefined;
  projectData: ProjectData | null;
  activeChapterId: string | null;
  editorRef: React.RefObject<ChapterEditorHandle | null>;
}

interface UseEditorAIReturn {
  sheetState: SheetState;
  currentResult: AIRewriteResult | null;
  errorMessage: string | null;
  handleOpenAiRewrite: () => void;
  handleAIAccept: (result: AIRewriteResult) => Promise<void>;
  handleAIRetry: (result: AIRewriteResult, instruction: string) => Promise<void>;
  handleAIDiscard: (result: AIRewriteResult) => Promise<void>;
  handleGoDeeper: (result: AIRewriteResult) => void;
}

/**
 * Encapsulates all AI rewrite concern: state management (via useAIRewrite),
 * SSE streaming, and handler callbacks.
 *
 * Keeps abortControllerRef and rewriteContextRef private to this hook,
 * avoiding split-ownership bugs between state and handlers.
 */
export function useEditorAI({
  getToken,
  apiUrl,
  activeChapter,
  projectData,
  activeChapterId,
  editorRef,
}: UseEditorAIOptions): UseEditorAIReturn {
  const aiRewrite = useAIRewrite({ getToken, apiUrl });

  const abortControllerRef = useRef<AbortController | null>(null);
  const rewriteContextRef = useRef<{
    selectedText: string;
    contextBefore: string;
    contextAfter: string;
    firstInteractionId?: string;
  } | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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

        const response = await fetch(`${apiUrl}/ai/rewrite`, {
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
          const body = await response.json().catch(() => null);
          if (response.status === 429) {
            const msg =
              (body as { message?: string } | null)?.message ||
              "You've used AI rewrite frequently. Please wait a moment.";
            aiRewrite.abortStreaming(msg);
          } else {
            const serverMsg = (body as { error?: string } | null)?.error;
            console.error("AI rewrite failed:", response.status, body);
            aiRewrite.abortStreaming(serverMsg || "Something went wrong. Please try again.");
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
    [getToken, activeChapter, projectData, activeChapterId, aiRewrite, apiUrl],
  );

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
  }, [requestRewrite, editorRef]);

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
    [aiRewrite, editorRef],
  );

  const handleAIRetry = useCallback(
    async (result: AIRewriteResult, instruction: string) => {
      await aiRewrite.handleRetry(result);

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

  return {
    sheetState: aiRewrite.sheetState,
    currentResult: aiRewrite.currentResult,
    errorMessage: aiRewrite.errorMessage,
    handleOpenAiRewrite,
    handleAIAccept,
    handleAIRetry,
    handleAIDiscard,
    handleGoDeeper,
  };
}
