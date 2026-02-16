"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface DriveFolderResult {
  id: string;
  name: string;
  webViewLink: string;
  alreadyExisted: boolean;
}

/**
 * Hook to create a Google Drive folder for a project.
 * Per PRD Section 8 (US-006): Auto-creates folder named after project title.
 *
 * Usage:
 *   const { createFolder, folder, isCreating, error } = useDriveFolder();
 *   await createFolder(projectId);
 */
export function useDriveFolder() {
  const { getToken } = useAuth();
  const [folder, setFolder] = useState<DriveFolderResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFolder = useCallback(
    async (projectId: string): Promise<DriveFolderResult | null> => {
      try {
        setIsCreating(true);
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/drive/folders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ projectId }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Failed to create Drive folder");
        }

        const result: DriveFolderResult = await response.json();
        setFolder(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create Drive folder";
        setError(message);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [getToken],
  );

  const reset = useCallback(() => {
    setFolder(null);
    setError(null);
    setIsCreating(false);
  }, []);

  return {
    createFolder,
    folder,
    isCreating,
    error,
    reset,
  };
}
