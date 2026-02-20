"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { ResearchClip } from "@/hooks/use-research-clips";
import { ClipCard } from "./clip-card";

interface Chapter {
  id: string;
  title: string;
}

interface ClipsTabProps {
  clips: ResearchClip[];
  isLoading: boolean;
  error: string | null;
  chapters: Chapter[];
  onFetchClips: (chapterId?: string) => Promise<void>;
  onDeleteClip: (clipId: string) => Promise<void>;
  onSourceTap?: (sourceId: string) => void;
}

/**
 * ClipsTab -- displays saved clips with chapter filter, search, and management.
 *
 * Features:
 * - Chapter filter dropdown: "All Chapters" + per-chapter options (only chapters with clips)
 * - Search field: client-side filtering by snippet text and source title
 * - ClipCard list, most recent first
 * - Empty state messaging
 * - Loading and error states
 */
export function ClipsTab({
  clips,
  isLoading,
  error,
  chapters,
  onFetchClips,
  onDeleteClip,
  onSourceTap,
}: ClipsTabProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch clips on mount
  useEffect(() => {
    onFetchClips();
  }, [onFetchClips]);

  // Re-fetch when chapter filter changes
  const handleChapterChange = useCallback(
    (chapterId: string) => {
      setSelectedChapterId(chapterId);
      // Empty string means "all chapters"
      onFetchClips(chapterId || undefined);
    },
    [onFetchClips],
  );

  // Chapters that have at least one clip tagged to them
  const chaptersWithClips = useMemo(() => {
    const chapterIds = new Set(clips.filter((c) => c.chapterId).map((c) => c.chapterId!));
    return chapters.filter((ch) => chapterIds.has(ch.id));
  }, [clips, chapters]);

  // Client-side search filtering
  const filteredClips = useMemo(() => {
    if (!searchQuery.trim()) return clips;
    const q = searchQuery.toLowerCase();
    return clips.filter(
      (clip) =>
        clip.snippetText.toLowerCase().includes(q) || clip.sourceTitle.toLowerCase().includes(q),
    );
  }, [clips, searchQuery]);

  // Loading state
  if (isLoading && clips.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading clips...</div>
      </div>
    );
  }

  // Error state
  if (error && clips.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            onClick={() => onFetchClips()}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            style={{
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (clips.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <p className="text-sm text-gray-500 text-center leading-relaxed max-w-[280px]">
          No clips yet. Save passages from AI results or select text in source documents to build
          your research board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-3 py-2 border-b border-gray-200 space-y-2 shrink-0">
        {/* Chapter filter */}
        <select
          value={selectedChapterId}
          onChange={(e) => handleChapterChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 bg-white text-gray-700"
          style={{ minHeight: 44 }}
          aria-label="Filter by chapter"
        >
          <option value="">All Chapters</option>
          {chaptersWithClips.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.title}
            </option>
          ))}
        </select>

        {/* Search field */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clips..."
            className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 bg-white text-gray-700 placeholder:text-gray-400"
            style={{ minHeight: 44 }}
            aria-label="Search clips"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {filteredClips.length === 0 && searchQuery ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500">No clips match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          filteredClips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} onDelete={onDeleteClip} onSourceTap={onSourceTap} />
          ))
        )}
      </div>
    </div>
  );
}
