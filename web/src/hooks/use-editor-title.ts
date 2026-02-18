"use client";

import { useState, useCallback } from "react";

interface Chapter {
  id: string;
  title: string;
}

interface UseEditorTitleOptions {
  activeChapter: Chapter | undefined;
  activeChapterId: string | null;
  handleChapterRename: (chapterId: string, newTitle: string) => Promise<void>;
}

interface UseEditorTitleReturn {
  editingTitle: boolean;
  titleValue: string;
  setTitleValue: (value: string) => void;
  handleTitleEdit: () => void;
  handleTitleSave: () => Promise<void>;
  setEditingTitle: (editing: boolean) => void;
}

/**
 * Manages the editable chapter title at the top of the editor.
 */
export function useEditorTitle({
  activeChapter,
  activeChapterId,
  handleChapterRename,
}: UseEditorTitleOptions): UseEditorTitleReturn {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  const handleTitleEdit = useCallback(() => {
    if (activeChapter) {
      setTitleValue(activeChapter.title);
      setEditingTitle(true);
    }
  }, [activeChapter]);

  const handleTitleSave = useCallback(async () => {
    if (!activeChapterId) {
      setEditingTitle(false);
      return;
    }

    await handleChapterRename(activeChapterId, titleValue);
    setEditingTitle(false);
  }, [activeChapterId, titleValue, handleChapterRename]);

  return {
    editingTitle,
    titleValue,
    setTitleValue,
    handleTitleEdit,
    handleTitleSave,
    setEditingTitle,
  };
}
