"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface DriveBrowseItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";
const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export function useDriveBrowser() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<DriveBrowseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState("root");
  const [stack, setStack] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState<string | undefined>(undefined);

  const fetchFolder = useCallback(
    async (targetFolderId: string, targetConnectionId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const params = new URLSearchParams({ folderId: targetFolderId });
        if (targetConnectionId) {
          params.set("connectionId", targetConnectionId);
        }
        const response = await fetch(`${API_URL}/drive/browse?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to browse Google Drive");
        }

        const data = (await response.json()) as { files: DriveBrowseItem[] };
        setItems(data.files || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to browse Google Drive");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [getToken],
  );

  const openRoot = useCallback(
    async (targetConnectionId?: string) => {
      setConnectionId(targetConnectionId);
      setFolderId("root");
      setStack([]);
      await fetchFolder("root", targetConnectionId);
    },
    [fetchFolder],
  );

  const openFolder = useCallback(
    async (targetFolderId: string) => {
      setStack((prev) => [...prev, folderId]);
      setFolderId(targetFolderId);
      await fetchFolder(targetFolderId, connectionId);
    },
    [fetchFolder, folderId, connectionId],
  );

  const goBack = useCallback(async () => {
    if (stack.length === 0) return;
    const last = stack[stack.length - 1];
    const nextStack = stack.slice(0, -1);
    setStack(nextStack);
    setFolderId(last);
    await fetchFolder(last, connectionId);
  }, [stack, fetchFolder, connectionId]);

  const refresh = useCallback(async () => {
    await fetchFolder(folderId, connectionId);
  }, [fetchFolder, folderId, connectionId]);

  return {
    items,
    isLoading,
    error,
    folderId,
    canGoBack: stack.length > 0,
    openRoot,
    openFolder,
    goBack,
    refresh,
    connectionId,
    isDoc: (item: DriveBrowseItem) => item.mimeType === GOOGLE_DOC_MIME_TYPE,
    isFolder: (item: DriveBrowseItem) => item.mimeType === GOOGLE_FOLDER_MIME_TYPE,
  };
}
