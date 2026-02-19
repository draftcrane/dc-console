"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface UseChapterContentOptions {
  activeChapterId: string | null;
  getToken: () => Promise<string | null>;
  /** setContent from useAutoSave — populates the editor when chapter content arrives */
  setContent: (html: string) => void;
  /** Current content HTML from useAutoSave */
  currentContent: string;
}

interface UseChapterContentReturn {
  /** Word count of the current editor content */
  currentWordCount: number;
  /** Word count of the active text selection */
  selectionWordCount: number;
  /** Callback for the editor to report selection word count changes */
  handleSelectionWordCountChange: (count: number) => void;
}

/**
 * Loads chapter content from the API when the active chapter changes and
 * provides word-count helpers.
 *
 * Extracted from EditorPage to keep content-loading logic isolated.
 */
export function useChapterContent({
  activeChapterId,
  getToken,
  setContent,
  currentContent,
}: UseChapterContentOptions): UseChapterContentReturn {
  const [selectionWordCount, setSelectionWordCount] = useState(0);

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

  return {
    currentWordCount,
    selectionWordCount,
    handleSelectionWordCountChange,
  };
}
