"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useResearchPanel } from "./research-panel-provider";
import { ClipCard } from "./clip-card";
import { useResearchClips, type ResearchClip } from "@/hooks/use-research-clips";

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
      <p className="text-base font-medium text-foreground mb-2">No clips saved yet</p>
      <p className="text-sm text-muted-foreground">
        Select text in a source document and tap &quot;Save to Clips&quot; to start collecting
        research snippets.
      </p>
    </div>
  );
}

// === Chapter Filter Dropdown ===

function ChapterFilter({
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
  // Only show chapters that have at least one tagged clip
  const chaptersWithClips = useMemo(() => {
    const chapterIdsWithClips = new Set(
      clips.filter((c) => c.chapterId !== null).map((c) => c.chapterId as string),
    );
    return chapters.filter((ch) => chapterIdsWithClips.has(ch.id));
  }, [chapters, clips]);

  // Don't render filter if no chapters have clips
  if (chaptersWithClips.length === 0) return null;

  return (
    <div className="px-4 py-2 border-b border-border shrink-0">
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
    </div>
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
export function ClipsTab() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { viewSource } = useResearchPanel();

  const { clips, isLoading, error, fetchClips, deleteClip } = useResearchClips(projectId);
  const { chapters } = useProjectChapters(projectId);

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // Fetch all clips on mount
  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Filter clips client-side based on selected chapter
  const filteredClips = useMemo(() => {
    if (!selectedChapterId) return clips;
    return clips.filter((c) => c.chapterId === selectedChapterId);
  }, [clips, selectedChapterId]);

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
      {/* Chapter filter */}
      <ChapterFilter
        chapters={chapters}
        clips={clips}
        selectedChapterId={selectedChapterId}
        onSelect={handleChapterFilterChange}
      />

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

        {/* Filtered empty state (clips exist but none match filter) */}
        {!isLoading && !error && clips.length > 0 && filteredClips.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <p className="text-sm text-muted-foreground">No clips tagged to this chapter.</p>
            <button
              onClick={() => setSelectedChapterId(null)}
              className="text-xs text-blue-600 hover:text-blue-700 mt-2"
            >
              Show all clips
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
                onInsert={() => {
                  // Insert action -- will be wired to editor in a future issue
                }}
                onDelete={() => handleDelete(clip.id)}
                onViewSource={handleViewSource}
                canInsert={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
