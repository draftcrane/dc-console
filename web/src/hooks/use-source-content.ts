"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface SourceContentResult {
  content: string;
  wordCount: number;
  cachedAt: string;
}

export function useSourceContent() {
  const { getToken } = useAuth();
  const [content, setContent] = useState<string>("");
  const [wordCount, setWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(
    async (sourceId: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/sources/${sourceId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to load source content");
        const data: SourceContentResult = await response.json();
        setContent(data.content);
        setWordCount(data.wordCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load content");
      } finally {
        setIsLoading(false);
      }
    },
    [getToken],
  );

  const reset = useCallback(() => {
    setContent("");
    setWordCount(0);
    setError(null);
  }, []);

  return { content, wordCount, isLoading, error, fetchContent, reset };
}
