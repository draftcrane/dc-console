"use client";

import { useState, useCallback } from "react";

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
  driveFolderId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
}

interface UseChapterManagementOptions {
  projectId: string;
  apiUrl: string;
  getToken: () => Promise<string | null>;
  projectData: ProjectData | null;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData | null>>;
  activeChapterId: string | null;
  setActiveChapterId: (id: string | null) => void;
  setMobileOverlayOpen: (open: boolean) => void;
  /** Ref to the current saveNow function — ref avoids stale closure issues */
  saveNowRef: React.RefObject<(() => Promise<void>) | null>;
  currentContent: string;
}

interface UseChapterManagementReturn {
  /** Chapter pending deletion confirmation */
  chapterToDelete: string | null;
  /** Whether the delete chapter dialog is open */
  deleteChapterDialogOpen: boolean;
  setDeleteChapterDialogOpen: (open: boolean) => void;
  setChapterToDelete: (id: string | null) => void;
  handleAddChapter: () => Promise<void>;
  handleChapterRename: (chapterId: string, newTitle: string) => Promise<void>;
  handleChapterReorder: (chapterIds: string[]) => Promise<void>;
  handleChapterSelect: (chapterId: string) => Promise<void>;
  handleDeleteChapterRequest: (chapterId: string) => void;
  handleDeleteChapter: () => Promise<void>;
}

/**
 * Encapsulates chapter CRUD operations for the editor page.
 *
 * Manages add, rename, reorder, select, and delete flows,
 * including optimistic updates and API synchronization.
 */
export function useChapterManagement({
  projectId,
  apiUrl,
  getToken,
  projectData,
  setProjectData,
  activeChapterId,
  setActiveChapterId,
  setMobileOverlayOpen,
  saveNowRef,
  currentContent,
}: UseChapterManagementOptions): UseChapterManagementReturn {
  const [deleteChapterDialogOpen, setDeleteChapterDialogOpen] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);

  // Handle chapter selection - save current chapter before switching
  const handleChapterSelect = useCallback(
    async (chapterId: string) => {
      if (activeChapterId && currentContent) {
        await saveNowRef.current?.();
      }
      setActiveChapterId(chapterId);
      setMobileOverlayOpen(false);
    },
    [activeChapterId, currentContent, saveNowRef, setActiveChapterId, setMobileOverlayOpen],
  );

  // Handle add chapter
  const handleAddChapter = useCallback(async () => {
    if (!projectData) return;

    try {
      const token = await getToken();
      const response = await fetch(`${apiUrl}/projects/${projectId}/chapters`, {
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
  }, [projectData, projectId, getToken, apiUrl, setProjectData, setActiveChapterId]);

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
        const response = await fetch(`${apiUrl}/chapters/${chapterId}`, {
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
    [getToken, apiUrl, setProjectData],
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
        const response = await fetch(`${apiUrl}/projects/${projectId}/chapters/reorder`, {
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
          const response = await fetch(`${apiUrl}/projects/${projectId}`, {
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
    [projectData, projectId, getToken, apiUrl, setProjectData],
  );

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
      const response = await fetch(`${apiUrl}/chapters/${chapterToDelete}`, {
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
  }, [
    chapterToDelete,
    projectData,
    getToken,
    apiUrl,
    activeChapterId,
    setProjectData,
    setActiveChapterId,
  ]);

  return {
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
  };
}
