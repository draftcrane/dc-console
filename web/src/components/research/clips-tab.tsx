"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useResearchPanel } from "./research-panel-provider";
import { ClipCard } from "./clip-card";
import { useResearchClips, type ResearchClip } from "@/hooks/use-research-clips";
import type { InsertResult } from "@/hooks/use-clip-insert";
import { useToast } from "@/components/toast";

// === Types ===

interface Chapter {
  id: string;
  title: string;
  sortOrder: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// === Hooks ===

/**
 * Fetch project chapters for the filter dropdown.
 * Lightweight hook that only fetches chapter metadata.
 */
function useProjectChapters(projectId: string) {
  const { getToken } = useAuth();
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/chapters`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { chapters: Chapter[] };
        if (!cancelled) {
          setChapters(data.chapters.sort((a, b) => a.sortOrder - b.sortOrder));
        }
      } catch {
        // Silent failure -- chapters filter is optional UX enhancement
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [getToken, projectId]);

  return { chapters };
}

// === Empty State ===

function ClipsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <svg
        className="w-12 h-12 text-muted-foreground mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      <p className="text-base font-medium text-foreground mb-2">No clips yet</p>
      <p className="text-sm text-muted-foreground">
        Save passages from AI results or select text in source documents to build your research
        board.
      </p>
    </div>
  );
}

// === Chapter Filter Dropdown ===

function ChapterFilterInline({
  chapters,
  clips,
  selectedChapterId,
  onSelect,
}: {
  chapters: Chapter[];
  clips: ResearchClip[];
  selectedChapterId: string | null;
  onSelect: (chapterId: string | null) => void;
}) {
  const chaptersWithClips = useMemo(() => {
    const chapterIdsWithClips = new Set(
      clips.filter((c) => c.chapterId !== null).map((c) => c.chapterId as string),
    );
    return chapters.filter((ch) => chapterIdsWithClips.has(ch.id));
  }, [chapters, clips]);

  if (chaptersWithClips.length === 0) return null;

  return (
    <select
      value={selectedChapterId ?? "all"}
      onChange={(e) => onSelect(e.target.value === "all" ? null : e.target.value)}
      className="w-full h-9 px-2 text-sm bg-white border border-border rounded-lg
                 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Filter clips by chapter"
    >
      <option value="all">All clips</option>
      {chaptersWithClips.map((ch) => (
        <option key={ch.id} value={ch.id}>
          {ch.title}
        </option>
      ))}
    </select>
  );
}

// === Clips Tab ===

/**
 * Clips tab - displays saved research clips with chapter filtering.
 *
 * Features:
 * - Fetches and displays all clips on mount
 * - Chapter filter dropdown (shows only chapters with tagged clips)
 * - ClipCard with Insert/Delete actions and source citation navigation
 * - Empty state when no clips exist
 */
interface ClipsTabProps {
  onInsertClip: (text: string, sourceTitle: string) => InsertResult;
  canInsert: boolean;
}

export function ClipsTab({ onInsertClip, canInsert }: ClipsTabProps) {
  const params = useParams();
  const projectId = params.projectId as string;
  const { viewSource } = useResearchPanel();
  const { showToast } = useToast();

  const { clips, isLoading, error, fetchClips, deleteClip } = useResearchClips(projectId);
  const { chapters } = useProjectChapters(projectId);

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all clips on mount
  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Filter clips client-side based on selected chapter and search query
  const filteredClips = useMemo(() => {
    let result = clips;
    if (selectedChapterId) {
      result = result.filter((c) => c.chapterId === selectedChapterId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) => c.content.toLowerCase().includes(q) || c.sourceTitle.toLowerCase().includes(q),
      );
    }
    return result;
  }, [clips, selectedChapterId, searchQuery]);

  const handleInsert = useCallback(
    (text: string, sourceTitle: string) => {
      const result = onInsertClip(text, sourceTitle);
      if (result === "inserted") {
        showToast("Inserted with footnote");
      } else if (result === "appended") {
        showToast("Inserted at end of chapter");
      }
    },
    [onInsertClip, showToast],
  );

  const handleDelete = useCallback(
    async (clipId: string) => {
      await deleteClip(clipId);
    },
    [deleteClip],
  );

  const handleViewSource = useCallback(
    (sourceId: string, returnTo: "ask" | "clips", sourceLocation?: string | null) => {
      viewSource(sourceId, returnTo, sourceLocation ?? undefined);
    },
    [viewSource],
  );

  const handleChapterFilterChange = useCallback((chapterId: string | null) => {
    setSelectedChapterId(chapterId);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search + Chapter filter toolbar */}
      {clips.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-border shrink-0 space-y-2">
          {/* Search input */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
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
              className="w-full h-9 pl-9 pr-8 text-sm bg-white border border-border rounded-lg
                         text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search clips"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Chapter filter inline (only if chapters have clips) */}
          <ChapterFilterInline
            chapters={chapters}
            clips={clips}
            selectedChapterId={selectedChapterId}
            onSelect={handleChapterFilterChange}
          />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Loading state */}
        {isLoading && clips.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading clips...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => fetchClips()} className="text-xs text-red-600 underline mt-1">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && clips.length === 0 && <ClipsEmptyState />}

        {/* Filtered empty state (clips exist but none match filter/search) */}
        {!isLoading && !error && clips.length > 0 && filteredClips.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery.trim()
                ? "No clips match your search."
                : "No clips tagged to this chapter."}
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedChapterId(null);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 mt-2"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Clip list */}
        {filteredClips.length > 0 && (
          <div className="p-4 space-y-3" role="list" aria-label="Research clips">
            {filteredClips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onInsert={() => handleInsert(clip.content, clip.sourceTitle)}
                onDelete={() => handleDelete(clip.id)}
                onViewSource={handleViewSource}
                canInsert={canInsert}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
