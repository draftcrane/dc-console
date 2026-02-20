"use client";

import { useState, useCallback } from "react";
import { SourceCitationLink } from "./source-citation-link";

export interface ResultCardProps {
  content: string;
  sourceTitle: string;
  sourceId: string | null;
  sourceLocation: string | null;
  onSaveToClips: () => Promise<void>;
  onInsert: () => void;
  onViewSource: (
    sourceId: string,
    returnTo: "ask" | "clips",
    sourceLocation?: string | null,
  ) => void;
  isSaved: boolean;
  canInsert: boolean;
}

/**
 * ResultCard - Displays a search result passage with source attribution and actions.
 *
 * Per design spec Section 7 (ResultCard):
 * - Passage text, source title (tappable SourceCitationLink), source location
 * - "Save to Clips" action (updates to checkmark "Saved")
 * - "Insert" action (inserts at editor cursor with footnote)
 * - 44pt minimum touch targets for action buttons
 * - Source title navigates to Source Detail View
 * - Text is selectable
 */
export function ResultCard({
  content,
  sourceTitle,
  sourceId,
  sourceLocation,
  onSaveToClips,
  onInsert,
  onViewSource,
  isSaved,
  canInsert,
}: ResultCardProps) {
  const [saving, setSaving] = useState(false);
  const [localSaved, setLocalSaved] = useState(isSaved);
  const [inserted, setInserted] = useState(false);

  const handleSave = useCallback(async () => {
    if (localSaved || saving) return;
    setSaving(true);
    try {
      await onSaveToClips();
      setLocalSaved(true);
    } finally {
      setSaving(false);
    }
  }, [localSaved, saving, onSaveToClips]);

  const handleInsert = useCallback(() => {
    if (!canInsert || inserted) return;
    onInsert();
    setInserted(true);
    // Revert "Inserted" label after 1.5s
    setTimeout(() => setInserted(false), 1500);
  }, [canInsert, inserted, onInsert]);

  // Derive saved state from prop or local state
  const showSaved = isSaved || localSaved;

  return (
    <div
      className="rounded-lg border border-border bg-white p-3 shadow-sm"
      data-testid="result-card"
    >
      {/* Passage text */}
      <blockquote className="mb-2 text-sm leading-relaxed text-foreground select-text">
        &ldquo;{content}&rdquo;
      </blockquote>

      {/* Source attribution - tappable citation link */}
      <div className="mb-3">
        <SourceCitationLink
          sourceTitle={sourceTitle}
          sourceId={sourceId}
          sourceLocation={sourceLocation}
          returnTo="ask"
          onNavigateToSource={onViewSource}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={showSaved || saving}
          className={`flex h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors
            ${
              showSaved
                ? "bg-green-50 text-green-700"
                : saving
                  ? "bg-gray-100 text-gray-400"
                  : "bg-gray-100 text-foreground hover:bg-gray-200"
            }`}
          aria-label={showSaved ? "Saved to clips" : "Save to clips"}
        >
          {showSaved ? (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Saved
            </>
          ) : saving ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
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
              Saving...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Save to Clips
            </>
          )}
        </button>

        <button
          onClick={handleInsert}
          disabled={!canInsert || inserted}
          className={`flex h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors
            ${
              inserted
                ? "bg-green-50 text-green-700"
                : canInsert
                  ? "bg-gray-100 text-foreground hover:bg-gray-200"
                  : "bg-gray-100 text-gray-400"
            }`}
          aria-label="Insert into chapter with footnote"
        >
          {inserted ? (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Inserted
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Insert
            </>
          )}
        </button>
      </div>
    </div>
  );
}
