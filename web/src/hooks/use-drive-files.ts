"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** File metadata returned from the Drive API */
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

/**
 * Hook to fetch files in a Google Drive Book Folder.
 * Per PRD Section 8 (US-007): Read-only listing of DraftCrane-created files.
 * Under drive.file scope, only DraftCrane-created files are visible (automatic from Google).
 */
export function useDriveFiles() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(
    async (folderId: string): Promise<DriveFileItem[]> => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/drive/folders/${folderId}/children`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || "Failed to fetch Drive files");
        }

        const data = (await response.json()) as { files: DriveFileItem[] };
        setFiles(data.files);
        return data.files;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch Drive files";
        setError(message);
        setFiles([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getToken],
  );

  const reset = useCallback(() => {
    setFiles([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    fetchFiles,
    files,
    isLoading,
    error,
    reset,
  };
}
