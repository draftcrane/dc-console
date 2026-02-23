import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// This is a subset of the Google Drive API File resource
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

interface UseDriveFilesParams {
  connectionId: string | null;
  folderId?: string;
  foldersOnly?: boolean;
}

export function useDriveFiles({
  connectionId,
  folderId = "root",
  foldersOnly = false,
}: UseDriveFilesParams) {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchFiles = useCallback(
    async (token: string | null, pageToken?: string) => {
      if (!connectionId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ folderId });
        if (foldersOnly) {
          params.set("foldersOnly", "true");
        }
        if (pageToken) {
          params.set("pageToken", pageToken);
        }

        const response = await fetch(
          `${API_URL}/drive/connection/${connectionId}/files?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const msg = (errorData as { error?: string } | null)?.error;

          // Surface actionable messages for common failure modes
          if (response.status === 422 && msg?.includes("expired")) {
            throw new Error("Drive connection expired. Reconnect your Google account.");
          }
          if (response.status === 409) {
            throw new Error("Multiple accounts connected. Select an account above.");
          }
          throw new Error(msg || `Failed to load files (${response.status})`);
        }

        const data = await response.json();
        setFiles((prev) => (pageToken ? [...prev, ...data.files] : data.files));
        setNextPageToken(data.nextPageToken || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    },
    [connectionId, folderId, foldersOnly],
  );

  useEffect(() => {
    const loadFiles = async () => {
      const token = await getToken();
      fetchFiles(token);
    };
    loadFiles();
  }, [getToken, fetchFiles]);

  const loadMore = async () => {
    if (!nextPageToken || isLoading) return;
    const token = await getToken();
    fetchFiles(token, nextPageToken);
  };

  return { files, isLoading, error, loadMore, hasMore: !!nextPageToken };
}
