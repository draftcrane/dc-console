"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Clip model matching API response */
export interface ResearchClip {
  id: string;
  projectId: string;
  sourceId: string | null;
  chapterId: string | null;
  sourceTitle: string;
  snippetText: string;
  chapterTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook for managing research clips -- fetch, create, and delete.
 *
 * Provides client-side state management for clips with optimistic
 * delete and deduplication-aware save.
 */
export function useResearchClips(projectId: string) {
  const { getToken } = useAuth();
  const [clips, setClips] = useState<ResearchClip[]>([]);
  const [clipCount, setClipCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch all clips for the project, optionally filtered by chapter */
  const fetchClips = useCallback(
    async (chapterId?: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        const url = chapterId
          ? `${API_URL}/projects/${projectId}/research/clips?chapterId=${chapterId}`
          : `${API_URL}/projects/${projectId}/research/clips`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to fetch clips");
        const data = (await response.json()) as { clips: ResearchClip[]; count: number };
        setClips(data.clips);
        setClipCount(data.count);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clips");
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, projectId],
  );

  /** Save a new clip */
  const saveClip = useCallback(
    async (input: {
      sourceId?: string | null;
      sourceTitle: string;
      snippetText: string;
      chapterId?: string | null;
    }): Promise<{ isNew: boolean } | null> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/research/clips`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error((data as { error?: string } | null)?.error || "Failed to save clip");
        }
        const data = (await response.json()) as { clip: ResearchClip };
        const isNew = response.status === 201;
        if (isNew) {
          setClips((prev) => [data.clip, ...prev]);
          setClipCount((prev) => prev + 1);
        }
        return { isNew };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save clip");
        return null;
      }
    },
    [getToken, projectId],
  );

  /** Delete a clip (optimistic removal) */
  const deleteClip = useCallback(
    async (clipId: string) => {
      try {
        setError(null);
        // Optimistic removal
        setClips((prev) => prev.filter((c) => c.id !== clipId));
        setClipCount((prev) => Math.max(0, prev - 1));

        const token = await getToken();
        const response = await fetch(`${API_URL}/research/clips/${clipId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          // Revert on failure -- re-fetch to get accurate state
          await fetchClips();
          throw new Error("Failed to delete clip");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete clip");
      }
    },
    [getToken, fetchClips],
  );

  return {
    clips,
    clipCount,
    isLoading,
    error,
    fetchClips,
    saveClip,
    deleteClip,
  };
}
