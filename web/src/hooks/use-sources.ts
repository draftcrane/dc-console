"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface PickerFile {
  driveFileId: string;
  title: string;
  mimeType: string;
}

/** Allowed local file extensions */
const ALLOWED_EXTENSIONS = [".txt", ".md", ".docx", ".pdf"];
/** Max file size: 5MB for text, 20MB for binary */
const MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_BINARY_FILE_SIZE = 20 * 1024 * 1024;

/** Validate a file before upload. Returns error message or null if valid. */
export function validateUploadFile(file: File): string | null {
  const ext =
    file.name.lastIndexOf(".") >= 0
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file format. Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported.`;
  }
  const maxSize = ext === ".txt" || ext === ".md" ? MAX_TEXT_FILE_SIZE : MAX_BINARY_FILE_SIZE;
  if (file.size > maxSize) {
    return `File too large (max ${maxSize / 1024 / 1024}MB)`;
  }
  return null;
}

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

export interface AddSourcesResult {
  sources: SourceMaterial[];
  expandedCounts?: {
    selectedFolders: number;
    docsDiscovered: number;
    docsInserted: number;
  };
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
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg = (data as { error?: string } | null)?.error;
        throw new Error(msg || `Failed to fetch sources (${response.status})`);
      }
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
    async (files: PickerFile[], connectionId?: string): Promise<AddSourcesResult | null> => {
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
        const result: AddSourcesResult = await response.json();
        // Refresh list after adding
        await fetchSources();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add sources");
        return null;
      }
    },
    [getToken, projectId, fetchSources],
  );

  /** Upload a local file (.txt, .md, .docx, .pdf) as a source. */
  const uploadLocalFile = useCallback(
    async (file: File) => {
      try {
        setError(null);

        // Client-side validation
        const validationError = validateUploadFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }

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

  const restoreSource = useCallback(
    async (sourceId: string): Promise<boolean> => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/sources/${sourceId}/restore`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to restore source");
        await fetchSources();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to restore source");
        return false;
      }
    },
    [getToken, fetchSources],
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
    restoreSource,
    importAsChapter,
  };
}
