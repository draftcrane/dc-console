"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback, useRef, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 300;

/** Minimum query length to trigger search */
const MIN_QUERY_LENGTH = 2;

export interface SourceSearchResult {
  sourceId: string;
  title: string;
  snippet: string;
}

export function useSourceSearch(projectId: string) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SourceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (q: string) => {
      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      if (q.trim().length < MIN_QUERY_LENGTH) {
        setResults([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setIsSearching(true);
        setSearchError(null);
        const token = await getToken();
        const encodedQuery = encodeURIComponent(q.trim());
        const response = await fetch(
          `${API_URL}/projects/${projectId}/research/sources/search?q=${encodedQuery}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error((data as { error?: string } | null)?.error || "Search failed");
        }

        const data = (await response.json()) as { results: SourceSearchResult[] };
        setResults(data.results);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return; // Silently ignore aborted requests
        }
        setSearchError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [getToken, projectId],
  );

  // Debounced search: triggers DEBOUNCE_MS after the last keystroke
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (newQuery.trim().length < MIN_QUERY_LENGTH) {
        setResults([]);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        executeSearch(newQuery);
      }, DEBOUNCE_MS);
    },
    [executeSearch],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearchError(null);
    setIsSearching(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    results,
    isSearching,
    searchError,
    isActive: query.trim().length >= MIN_QUERY_LENGTH,
    handleQueryChange,
    clearSearch,
  };
}
