"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Hook for downloading project backups and importing from backup files.
 *
 * - downloadBackup: Fetches a ZIP from the API, triggers browser download via blob URL.
 *   On iPad Safari, this triggers the share sheet (iCloud, Files, AirDrop).
 * - importBackup: POSTs a ZIP file to the import endpoint, returns the new project ID.
 */
export function useBackup() {
  const { getToken } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const downloadBackup = useCallback(
    async (projectId: string) => {
      setIsDownloading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          setError("Authentication required");
          return;
        }

        const response = await fetch(`${API_URL}/projects/${projectId}/backup`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 429) {
            setError("Please wait a moment before downloading again.");
            return;
          }
          const body = await response.json().catch(() => null);
          setError((body as { error?: string } | null)?.error || "Backup failed");
          return;
        }

        // Extract file name from Content-Disposition header
        const disposition = response.headers.get("Content-Disposition") || "";
        const fileNameMatch = disposition.match(/filename="(.+?)"/);
        const fileName = fileNameMatch?.[1] || "backup.zip";

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: "application/zip" });
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        link.type = "application/zip";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          document.body.removeChild(link);
        }, 5000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Backup failed");
      } finally {
        setIsDownloading(false);
      }
    },
    [getToken],
  );

  const importBackup = useCallback(
    async (file: File): Promise<string | null> => {
      setIsImporting(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          setError("Authentication required");
          return null;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_URL}/projects/import`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 429) {
            setError("Please wait a moment before importing again.");
            return null;
          }
          const body = await response.json().catch(() => null);
          setError((body as { error?: string } | null)?.error || "Import failed");
          return null;
        }

        const result = (await response.json()) as {
          projectId: string;
          title: string;
          chapterCount: number;
        };

        return result.projectId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
        return null;
      } finally {
        setIsImporting(false);
      }
    },
    [getToken],
  );

  return {
    downloadBackup,
    importBackup,
    isDownloading,
    isImporting,
    error,
    clearError,
  };
}
