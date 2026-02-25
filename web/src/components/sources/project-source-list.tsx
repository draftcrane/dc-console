"use client";

import { useCallback, useState, useRef } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { SourceItem } from "./source-item";
import { EmptyState } from "./empty-state";
import { useToast } from "@/components/toast";

/**
 * Project source list with search, view, analyze, and remove actions.
 * Part of the Library tab.
 */
export function ProjectSourceList() {
  const {
    sources,
    isLoadingSources,
    searchResults,
    isSearching,
    search,
    clearSearch,
    removeSource,
    restoreSource,
    openSourceReview,
    openSourceAnalysis,
  } = useSourcesContext();

  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.trim().length >= 2) {
        search(value);
      } else {
        clearSearch();
      }
    },
    [search, clearSearch],
  );

  const handleRemove = useCallback(
    async (sourceId: string, title: string) => {
      await removeSource(sourceId);

      // Show undo toast (5s window)
      showToast(`"${title}" removed`, 5000, {
        label: "Undo",
        onClick: async () => {
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
          await restoreSource(sourceId);
        },
      });
    },
    [removeSource, restoreSource, showToast],
  );

  const displaySources =
    searchResults !== null
      ? sources.filter((s) => searchResults.some((r) => r.sourceId === s.id))
      : sources;

  if (isLoadingSources) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-sm text-[var(--dc-color-text-muted)]">Loading sources...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Search bar */}
      {sources.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dc-color-text-placeholder)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full h-9 pl-8 pr-8 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-muted)]
                           min-h-[32px] min-w-[32px] flex items-center justify-center"
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
          {isSearching && (
            <p className="text-xs text-[var(--dc-color-text-placeholder)] mt-1 px-1">
              Searching...
            </p>
          )}
        </div>
      )}

      {/* Source list */}
      {displaySources.length === 0 ? (
        searchResults !== null ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            }
            message={`No sources match "${searchQuery}"`}
          />
        ) : null
      ) : (
        <div className="px-1">
          {displaySources.map((source) => (
            <SourceItem
              key={source.id}
              title={source.title}
              mimeType={source.mimeType}
              wordCount={source.wordCount}
              onClick={() => openSourceReview(source.id)}
              actions={
                <>
                  <button
                    onClick={() => openSourceAnalysis(source.id)}
                    className="p-1.5 text-[var(--dc-color-text-placeholder)] hover:text-blue-600 transition-colors
                               min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Analyze ${source.title}`}
                    title="Analyze with AI"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemove(source.id, source.title)}
                    className="p-1.5 text-[var(--dc-color-text-placeholder)] hover:text-red-600 transition-colors
                               min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Remove ${source.title}`}
                    title="Remove source"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
