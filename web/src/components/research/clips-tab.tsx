"use client";

import { useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ClipCard } from "./clip-card";
import { useResearchPanel } from "./research-panel-provider";
import { useResearchClips } from "@/hooks/use-research-clips";
import { useToast } from "@/components/toast";
import type { InsertResult } from "@/hooks/use-clip-insert";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ClipsTabProps {
  /** Insert a clip into the editor as blockquote + footnote */
  onInsertClip: (text: string, sourceTitle: string) => InsertResult;
  /** Whether the editor has a cursor / active chapter for insertion */
  canInsert: boolean;
  /** Called after a clip is deleted so parent can refresh badge count */
  onClipsChanged: () => void;
}

/**
 * ClipsTab - Displays saved research clips with insert and delete actions.
 *
 * Per design-spec.md Section 7:
 * - Lists all saved clips for the project
 * - Each clip has Insert and Delete buttons
 * - Insert adds blockquote + footnote at editor cursor position
 * - Shows toast feedback on insert and delete
 * - Empty state when no clips saved
 */
export function ClipsTab({ onInsertClip, canInsert, onClipsChanged }: ClipsTabProps) {
  const params = useParams();
  const projectId = params.projectId as string;
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const { viewSource } = useResearchPanel();

  const { clips, isLoading, error, fetchClips } = useResearchClips(projectId);

  // Fetch clips when tab mounts
  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

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
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/research/clips/${clipId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          fetchClips();
          onClipsChanged();
          showToast("Clip deleted");
        }
      } catch {
        showToast("Failed to delete clip");
      }
    },
    [getToken, projectId, fetchClips, onClipsChanged, showToast],
  );

  const handleViewSource = useCallback(
    (sourceId: string, returnTo: "ask" | "clips", sourceLocation?: string | null) => {
      viewSource(sourceId, returnTo, sourceLocation ?? undefined);
    },
    [viewSource],
  );

  // Loading state
  if (isLoading && clips.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <button
          onClick={() => fetchClips()}
          className="h-9 px-3 text-sm font-medium text-blue-600 bg-white border border-blue-200
                     rounded-lg hover:bg-blue-50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (clips.length === 0) {
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
            d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
          />
        </svg>
        <p className="text-base font-medium text-foreground mb-2">No clips saved yet</p>
        <p className="text-sm text-muted-foreground">
          Select text in a source document or save results from the Ask tab to create clips.
        </p>
      </div>
    );
  }

  // Clips list
  return (
    <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
      <p className="text-xs text-muted-foreground">
        {clips.length} clip{clips.length !== 1 ? "s" : ""}
      </p>
      {clips.map((clip) => (
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
  );
}
