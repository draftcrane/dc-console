"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Public API model for a research clip. */
export interface ResearchClip {
  id: string;
  projectId: string;
  sourceId: string | null;
  sourceTitle: string;
  content: string;
  sourceLocation: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  createdAt: string;
}

/** Input for creating a clip. */
export interface SaveClipInput {
  content: string;
  sourceTitle: string;
  sourceId?: string | null;
  sourceLocation?: string | null;
  chapterId?: string | null;
}

export interface UseResearchClipsReturn {
  /** All fetched clips */
  clips: ResearchClip[];
  /** Total count of clips (updated on fetch and after saves) */
  clipCount: number;
  /** Whether clips are loading */
  isLoading: boolean;
  /** Error message if any operation failed */
  error: string | null;
  /** Fetch clips for the project */
  fetchClips: (chapterId?: string) => Promise<void>;
  /** Save a new clip. Returns the clip and whether it was a duplicate. */
  saveClip: (input: SaveClipInput) => Promise<{ clip: ResearchClip; existed: boolean } | null>;
  /** Delete a clip by ID */
  deleteClip: (clipId: string) => Promise<boolean>;
  /** Set of content strings that have been saved (for "Saved" button state) */
  savedContents: Set<string>;
  /** Whether a specific save is in progress (keyed by content hash) */
  isSaving: boolean;
}

/**
 * Hook for managing research clips -- save, list, and track saved state.
 *
 * Provides:
 * - saveClip() with dedup detection (API returns existed=true for duplicates)
 * - fetchClips() for listing
 * - savedContents Set for "Save to Clips" -> "Saved" button state
 * - clipCount for badge display
 */
export function useResearchClips(projectId: string): UseResearchClipsReturn {
  const { getToken } = useAuth();
  const [clips, setClips] = useState<ResearchClip[]>([]);
  const [clipCount, setClipCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedContents, setSavedContents] = useState<Set<string>>(new Set());

  // Track content dedup key: content + sourceId
  const dedupKey = useCallback((content: string, sourceId?: string | null) => {
    return `${sourceId ?? "no-source"}::${content}`;
  }, []);

  // Ref to avoid stale closure in rapid saves
  const savedContentsRef = useRef(savedContents);
  savedContentsRef.current = savedContents;

  const fetchClips = useCallback(
    async (chapterId?: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        const url = new URL(`${API_URL}/projects/${projectId}/research/clips`);
        if (chapterId) {
          url.searchParams.set("chapterId", chapterId);
        }
        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to fetch clips");
        const data = (await response.json()) as { clips: ResearchClip[] };
        setClips(data.clips);
        setClipCount(data.clips.length);

        // Populate savedContents from existing clips
        const existing = new Set<string>();
        for (const clip of data.clips) {
          existing.add(dedupKey(clip.content, clip.sourceId));
        }
        setSavedContents(existing);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clips");
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, projectId, dedupKey],
  );

  const saveClip = useCallback(
    async (input: SaveClipInput): Promise<{ clip: ResearchClip; existed: boolean } | null> => {
      try {
        setIsSaving(true);
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

        const clip: ResearchClip = await response.json();
        const existed = response.status === 200; // 200 = dedup match, 201 = new

        // Track as saved
        const key = dedupKey(input.content, input.sourceId);
        setSavedContents((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });

        // Update count only if it was a new clip
        if (!existed) {
          setClipCount((prev) => prev + 1);
        }

        return { clip, existed };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save clip");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [getToken, projectId, dedupKey],
  );

  const deleteClip = useCallback(
    async (clipId: string): Promise<boolean> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/research/clips/${clipId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error("Failed to delete clip");
        }

        // Remove from local state
        setClips((prev) => prev.filter((c) => c.id !== clipId));
        setClipCount((prev) => Math.max(0, prev - 1));

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete clip");
        return false;
      }
    },
    [getToken],
  );

  return {
    clips,
    clipCount,
    isLoading,
    error,
    fetchClips,
    saveClip,
    deleteClip,
    savedContents,
    isSaving,
  };
}
