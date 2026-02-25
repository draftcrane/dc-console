"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface SourceMaterial {
  id: string;
  projectId: string;
  driveFileId: string | null;
  title: string;
  mimeType: string;
  sourceType: string;
  wordCount: number;
  status: string;
  cachedAt: string | null;
  sortOrder: number;
}

export interface SourceContentResult {
  content: string;
  wordCount: number;
  cachedAt: string | null;
}

export interface SearchResult {
  sourceId: string;
  title: string;
  snippet: string;
  score: number;
}

export interface SourceConnection {
  id: string;
  driveConnectionId: string;
  email: string;
  connectedAt: string;
  documentCount: number;
}

export interface AddSourceInput {
  driveFileId: string;
  title: string;
  mimeType: string;
}

interface UseSourcesReturn {
  sources: SourceMaterial[];
  isLoading: boolean;
  error: string | null;
  // Content
  getContent: (sourceId: string) => Promise<SourceContentResult>;
  contentCache: Map<string, SourceContentResult>;
  // CRUD
  addDriveSources: (files: AddSourceInput[], connectionId?: string) => Promise<void>;
  uploadLocalFile: (file: File) => Promise<void>;
  removeSource: (sourceId: string) => Promise<void>;
  restoreSource: (sourceId: string) => Promise<void>;
  // Search
  searchResults: SearchResult[] | null;
  isSearching: boolean;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  // Connections
  connections: SourceConnection[];
  linkConnection: (driveConnectionId: string) => Promise<void>;
  unlinkConnection: (connectionId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * All source data operations combined in a single facade hook.
 * Handles: source list, content fetching, search, add, remove, restore, connections.
 */
export function useSources(projectId: string): UseSourcesReturn {
  const { getToken } = useAuth();
  const [sources, setSources] = useState<SourceMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [connections, setConnections] = useState<SourceConnection[]>([]);
  const contentCacheRef = useRef(new Map<string, SourceContentResult>());
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch sources list
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
      setSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, projectId]);

  // Fetch connections
  const fetchConnections = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/source-connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setConnections(data.connections || []);
    } catch {
      // Non-critical
    }
  }, [getToken, projectId]);

  useEffect(() => {
    fetchSources();
    fetchConnections();
  }, [fetchSources, fetchConnections]);

  // Get content with caching
  const getContent = useCallback(
    async (sourceId: string): Promise<SourceContentResult> => {
      const cached = contentCacheRef.current.get(sourceId);
      if (cached) return cached;

      const token = await getToken();
      const response = await fetch(`${API_URL}/sources/${sourceId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch source content");
      const data = (await response.json()) as SourceContentResult;
      contentCacheRef.current.set(sourceId, data);
      return data;
    },
    [getToken],
  );

  // Add Drive sources (optimistic update — no full refetch)
  const addDriveSources = useCallback(
    async (files: AddSourceInput[], connectionId?: string) => {
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
      const data = await response.json().catch(() => null);
      if (data?.sources && Array.isArray(data.sources)) {
        setSources((prev) => [...prev, ...data.sources]);
      } else {
        // Fallback: refetch if response didn't include sources
        await fetchSources();
      }
    },
    [getToken, projectId, fetchSources],
  );

  // Upload local file
  const uploadLocalFile = useCallback(
    async (file: File) => {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/projects/${projectId}/sources/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error((data as { error?: string } | null)?.error || "Failed to upload file");
      }
      await fetchSources();
    },
    [getToken, projectId, fetchSources],
  );

  // Remove source (optimistic update — no full refetch)
  const removeSource = useCallback(
    async (sourceId: string) => {
      // Optimistic: remove from local state immediately
      const previousSources = sources;
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      contentCacheRef.current.delete(sourceId);

      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/sources/${sourceId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          // Rollback on failure
          setSources(previousSources);
          throw new Error("Failed to remove source");
        }
      } catch (err) {
        // Rollback on network error
        setSources(previousSources);
        throw err;
      }
    },
    [getToken, sources],
  );

  // Restore source (undo remove)
  const restoreSource = useCallback(
    async (sourceId: string) => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/sources/${sourceId}/restore`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to restore source");
      await fetchSources();
    },
    [getToken, fetchSources],
  );

  // Search (debounced at 300ms)
  const search = useCallback(
    async (query: string) => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      if (!query || query.trim().length < 2) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      searchTimerRef.current = setTimeout(async () => {
        try {
          const token = await getToken();
          const params = new URLSearchParams({ q: query });
          const response = await fetch(
            `${API_URL}/projects/${projectId}/research/sources/search?${params}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!response.ok) throw new Error("Search failed");
          const data = await response.json();
          setSearchResults(data.results || []);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [getToken, projectId],
  );

  const clearSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    setSearchResults(null);
    setIsSearching(false);
  }, []);

  // Link connection
  const linkConnection = useCallback(
    async (driveConnectionId: string) => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/source-connections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ driveConnectionId }),
      });
      if (!response.ok) throw new Error("Failed to link connection");
      await fetchConnections();
    },
    [getToken, projectId, fetchConnections],
  );

  // Unlink connection
  const unlinkConnection = useCallback(
    async (connectionId: string) => {
      const token = await getToken();
      const response = await fetch(
        `${API_URL}/projects/${projectId}/source-connections/${connectionId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Failed to unlink connection");
      await fetchConnections();
      await fetchSources();
    },
    [getToken, projectId, fetchConnections, fetchSources],
  );

  return {
    sources,
    isLoading,
    error,
    getContent,
    contentCache: contentCacheRef.current,
    addDriveSources,
    uploadLocalFile,
    removeSource,
    restoreSource,
    searchResults,
    isSearching,
    search,
    clearSearch,
    connections,
    linkConnection,
    unlinkConnection,
    refetch: fetchSources,
  };
}
