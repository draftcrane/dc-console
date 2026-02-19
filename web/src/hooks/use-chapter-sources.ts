"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback, useEffect } from "react";
import type { SourceMaterial } from "./use-sources";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Hook for managing chapter-source linking and reference viewing.
 * Provides CRUD for linking sources to chapters and state for viewing linked source content.
 */
export function useChapterSources(projectId: string, chapterId: string | null) {
  const { getToken } = useAuth();
  const [linkedSources, setLinkedSources] = useState<SourceMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference viewing state
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState("");
  const [isContentLoading, setIsContentLoading] = useState(false);

  /** Fetch linked sources for the current chapter */
  const fetchLinkedSources = useCallback(async () => {
    if (!chapterId) {
      setLinkedSources([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      const response = await fetch(`${API_URL}/chapters/${chapterId}/sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch linked sources");
      const data = await response.json();
      setLinkedSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load linked sources");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, chapterId]);

  // Fetch when chapterId changes
  useEffect(() => {
    fetchLinkedSources();
  }, [fetchLinkedSources]);

  /** Link a source to the current chapter */
  const linkSource = useCallback(
    async (sourceId: string) => {
      if (!chapterId) return;

      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/chapters/${chapterId}/sources/${sourceId}/link`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to link source");
        await fetchLinkedSources();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to link source");
      }
    },
    [getToken, chapterId, fetchLinkedSources],
  );

  /** Unlink a source from the current chapter (soft-archive) */
  const unlinkSource = useCallback(
    async (sourceId: string) => {
      if (!chapterId) return;

      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/chapters/${chapterId}/sources/${sourceId}/link`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to unlink source");
        // Optimistically remove from list
        setLinkedSources((prev) => prev.filter((s) => s.id !== sourceId));
        // Clear active source if it was unlinked
        if (activeSourceId === sourceId) {
          setActiveSourceId(null);
          setActiveContent("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to unlink source");
      }
    },
    [getToken, chapterId, activeSourceId],
  );

  /** Load content for a linked source (for reference viewing) */
  const loadSourceContent = useCallback(
    async (sourceId: string) => {
      try {
        setIsContentLoading(true);
        setActiveSourceId(sourceId);
        const token = await getToken();
        const response = await fetch(`${API_URL}/sources/${sourceId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to load source content");
        const data = await response.json();
        setActiveContent(data.content || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load content");
        setActiveContent("");
      } finally {
        setIsContentLoading(false);
      }
    },
    [getToken],
  );

  return {
    linkedSources,
    isLoading,
    error,
    linkSource,
    unlinkSource,
    fetchLinkedSources,
    // Reference viewing
    activeSourceId,
    setActiveSourceId: (id: string | null) => {
      setActiveSourceId(id);
      if (id) {
        loadSourceContent(id);
      } else {
        setActiveContent("");
      }
    },
    activeContent,
    isContentLoading,
  };
}
