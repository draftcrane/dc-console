"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface CacheEntry {
  data: { content: string; format: "html" | "text" };
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function countWords(text: string): number {
  const stripped = text.replace(/\s+/g, " ").trim();
  if (!stripped) return 0;
  return stripped.split(" ").length;
}

/**
 * useDriveContent — fetch document content directly from Drive via the API.
 * Caches responses in a module-level Map with 5-minute TTL.
 * Computes word count client-side from the returned content.
 */
export function useDriveContent(connectionId: string, fileId: string) {
  const { getToken } = useAuth();
  const [content, setContent] = useState<string | null>(null);
  const [format, setFormat] = useState<"html" | "text">("text");
  const [wordCount, setWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${connectionId}:${fileId}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setContent(cached.data.content);
      setFormat(cached.data.format);
      const text =
        cached.data.format === "html" ? stripHtml(cached.data.content) : cached.data.content;
      setWordCount(countWords(text));
      setIsLoading(false);
      return;
    }

    // Evict stale entry
    if (cached) cache.delete(cacheKey);

    const fetchContent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        const response = await fetch(
          `${API_URL}/drive/connection/${connectionId}/files/${fileId}/content`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const msg = (errorData as { error?: string } | null)?.error;
          throw new Error(msg || `Failed to load content (${response.status})`);
        }
        const data: { content: string; format: "html" | "text" } = await response.json();
        if (cancelled) return;

        cache.set(cacheKey, { data, timestamp: Date.now() });
        setContent(data.content);
        setFormat(data.format);
        const text = data.format === "html" ? stripHtml(data.content) : data.content;
        setWordCount(countWords(text));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load content");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchContent();
    return () => {
      cancelled = true;
    };
  }, [connectionId, fileId, getToken]);

  return { content, format, wordCount, isLoading, error };
}
