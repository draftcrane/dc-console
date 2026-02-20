"use client";

import { useEffect } from "react";
import { useSourceContent } from "@/hooks/use-source-content";
import { SourceContentRenderer } from "./source-content-renderer";

interface SourceDetailViewProps {
  sourceId: string;
  title: string;
  onBack: () => void;
  /** Custom back label for cross-tab navigation (e.g. "Back to Ask", "Back to Clips") */
  backLabel?: string;
}

/**
 * Source Detail View - inline replacement within the Sources tab.
 *
 * Shows source document content with always-visible search.
 * The back button label is customizable for cross-tab navigation:
 * - "Sources" (default) when navigating within the Sources tab
 * - "Back to Ask" when arriving from the Ask tab
 * - "Back to Clips" when arriving from the Clips tab
 */
export function SourceDetailView({ sourceId, title, onBack, backLabel }: SourceDetailViewProps) {
  const { content, wordCount, isLoading, error, fetchContent, reset } = useSourceContent();

  useEffect(() => {
    fetchContent(sourceId);
    return () => reset();
  }, [sourceId, fetchContent, reset]);

  const displayBackLabel = backLabel ?? "Sources";

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button and title */}
      <div className="flex items-center gap-2 h-11 px-4 shrink-0 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700
                     transition-colors shrink-0 min-h-[44px]"
          aria-label={backLabel ? backLabel : "Back to sources list"}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>{displayBackLabel}</span>
        </button>

        <div className="flex-1 min-w-0 ml-1">
          <p className="text-sm font-medium text-foreground truncate">{title}</p>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Loading state */}
        {isLoading && (
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
              Loading document...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => fetchContent(sourceId)}
              className="text-xs text-red-600 underline mt-1"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loaded content */}
        {!isLoading && !error && content && (
          <SourceContentRenderer content={content} searchEnabled={true} />
        )}

        {/* Empty content (loaded but no content) */}
        {!isLoading && !error && !content && wordCount === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <p className="text-sm text-muted-foreground">
              No content available for this source yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
