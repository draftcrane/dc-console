"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface SourceMaterial {
  id: string;
  projectId: string;
  driveFileId: string;
  title: string;
  mimeType: string;
  driveModifiedTime: string | null;
  wordCount: number;
  cachedAt: string | null;
  status: "active" | "archived" | "error";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PickerFile {
  driveFileId: string;
  title: string;
  mimeType: string;
}

export function useSources(projectId: string) {
  const { getToken } = useAuth();
  const [sources, setSources] = useState<SourceMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch sources");
      const data = await response.json();
      setSources(data.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, projectId]);

  const addSources = useCallback(
    async (files: PickerFile[]) => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ files }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error((data as { error?: string } | null)?.error || "Failed to add sources");
        }
        // Refresh list after adding
        await fetchSources();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add sources");
      }
    },
    [getToken, projectId, fetchSources],
  );

  const removeSource = useCallback(
    async (sourceId: string) => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/sources/${sourceId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to remove source");
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove source");
      }
    },
    [getToken],
  );

  const importAsChapter = useCallback(
    async (sourceId: string): Promise<{ chapterId: string; title: string } | null> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/sources/${sourceId}/import-as-chapter`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to import source as chapter");
        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import");
        return null;
      }
    },
    [getToken],
  );

  return {
    sources,
    isLoading,
    error,
    fetchSources,
    addSources,
    removeSource,
    importAsChapter,
  };
}
