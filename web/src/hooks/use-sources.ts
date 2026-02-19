"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";
import type { PickerFile } from "./use-google-picker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface SourceMaterial {
  id: string;
  projectId: string;
  sourceType: "drive" | "local";
  driveConnectionId: string | null;
  driveFileId: string | null;
  title: string;
  mimeType: string;
  originalFilename: string | null;
  driveModifiedTime: string | null;
  wordCount: number;
  cachedAt: string | null;
  status: "active" | "archived" | "error";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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

  /** Add Drive sources from Picker selection. Optional connectionId tracks which account. */
  const addSources = useCallback(
    async (files: PickerFile[], connectionId?: string) => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ files, connectionId }),
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

  /** Upload a local file (.txt, .md) as a source. */
  const uploadLocalFile = useCallback(
    async (file: File) => {
      try {
        setError(null);
        const token = await getToken();
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_URL}/projects/${projectId}/sources/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error((data as { error?: string } | null)?.error || "Failed to upload file");
        }
        // Refresh list after uploading
        await fetchSources();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload file");
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
    uploadLocalFile,
    removeSource,
    importAsChapter,
  };
}
