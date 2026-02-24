"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Lightweight hook: only the linkFolder action, no auto-fetch or auto-sync. */
export function useLinkFolder(projectId: string) {
  const { getToken } = useAuth();

  const linkFolder = useCallback(
    async (input: LinkFolderInput) => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/linked-folders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error((data as { error?: string } | null)?.error || "Failed to link folder");
      }
      return response.json();
    },
    [getToken, projectId],
  );

  return { linkFolder };
}

export interface LinkedFolder {
  id: string;
  projectId: string;
  driveConnectionId: string;
  driveFolderId: string;
  folderName: string;
  email: string;
  documentCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface LinkFolderInput {
  driveConnectionId: string;
  driveFolderId: string;
  folderName: string;
  exclusions?: Array<{ driveItemId: string; itemType: "folder" | "document"; itemName: string }>;
}

/**
 * Hook to manage linked folders for a project.
 * Auto-fetches on mount and auto-syncs stale folders once per panel open.
 */
export function useLinkedFolders(projectId: string) {
  const { getToken } = useAuth();
  const [linkedFolders, setLinkedFolders] = useState<LinkedFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSyncedRef = useRef(false);

  const fetchLinkedFolders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/linked-folders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg = (data as { error?: string } | null)?.error;
        throw new Error(msg || `Failed to fetch linked folders (${response.status})`);
      }
      const data = await response.json();
      setLinkedFolders(data.folders);
      return data.folders as LinkedFolder[];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load linked folders");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getToken, projectId]);

  const linkFolder = useCallback(
    async (input: LinkFolderInput) => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/linked-folders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error((data as { error?: string } | null)?.error || "Failed to link folder");
        }
        const result = await response.json();
        await fetchLinkedFolders();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to link folder");
        return null;
      }
    },
    [getToken, projectId, fetchLinkedFolders],
  );

  const unlinkFolder = useCallback(
    async (linkedFolderId: string) => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(
          `${API_URL}/projects/${projectId}/linked-folders/${linkedFolderId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error((data as { error?: string } | null)?.error || "Failed to unlink folder");
        }
        await fetchLinkedFolders();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to unlink folder");
      }
    },
    [getToken, projectId, fetchLinkedFolders],
  );

  const syncStale = useCallback(async () => {
    try {
      setIsSyncing(true);
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/linked-folders/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const result = await response.json();
      if (result.syncedFolders > 0) {
        await fetchLinkedFolders();
      }
      return result;
    } catch {
      // Non-critical — sync failures are silent
    } finally {
      setIsSyncing(false);
    }
  }, [getToken, projectId, fetchLinkedFolders]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchLinkedFolders();
  }, [fetchLinkedFolders]);

  // Auto-sync stale on mount (once per panel open, ref-guarded)
  useEffect(() => {
    if (hasSyncedRef.current) return;
    if (isLoading) return; // Wait for initial fetch

    // Check if any folder is stale (null or > 5 min old)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const hasStale = linkedFolders.some(
      (f) => !f.lastSyncedAt || new Date(f.lastSyncedAt).getTime() < fiveMinAgo,
    );

    if (hasStale) {
      hasSyncedRef.current = true;
      syncStale();
    } else if (linkedFolders.length > 0) {
      // All folders are fresh — mark as synced so we don't re-check
      hasSyncedRef.current = true;
    }
  }, [isLoading, linkedFolders, syncStale]);

  return {
    linkedFolders,
    isLoading,
    isSyncing,
    error,
    fetchLinkedFolders,
    linkFolder,
    unlinkFolder,
    syncStale,
  };
}
