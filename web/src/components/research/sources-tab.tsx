"use client";

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel } from "./research-panel-provider";
import { SourceDetailView } from "./source-detail-view";
import { SourceCard } from "./source-card";
import { getSourceBadge } from "./source-helpers";
import { useSources, type SourceMaterial } from "@/hooks/use-sources";
import { useSourceSearch, type SourceSearchResult } from "@/hooks/use-source-search";
import { useToast } from "@/components/toast";
import { useProjectSourceConnections } from "@/hooks/use-project-source-connections";
import type { InsertResult } from "@/hooks/use-clip-insert";

// === Search Result Row ===

function SearchResultRow({ result, onTap }: { result: SourceSearchResult; onTap: () => void }) {
  return (
    <li>
      <button
        onClick={onTap}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors min-h-[56px]"
      >
        <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-blue-50 shrink-0">
          <svg
            className="w-4 h-4 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
          {result.snippet && (
            <p
              className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: result.snippet }}
            />
          )}
        </div>
      </button>
    </li>
  );
}

// === Content-Only Empty State ===

function ContentEmptyState({ onOpenSourceManager }: { onOpenSourceManager: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-8">
      <div className="text-center mb-6">
        <h3 className="text-base font-semibold text-foreground mb-1">No sources yet</h3>
        <p className="text-sm text-muted-foreground">
          Add research documents to search and reference them while writing.
        </p>
      </div>

      <button
        onClick={onOpenSourceManager}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-600
                   bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors min-h-[44px]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        Add Sources
      </button>
    </div>
  );
}

// === Sources Tab (Content Manager) ===

export interface SourcesTabProps {
  onInsertContent?: (text: string, sourceTitle: string) => InsertResult;
  canInsert?: boolean;
  activeChapterTitle?: string;
  onOpenSourceManager?: () => void;
}

/**
 * SourcesTab — Content-only surface for the Research panel.
 *
 * Search, browse, read, clip, and insert sources. No management actions.
 * Management (add, remove, link folders) lives in the Source Manager sheet.
 */
export function SourcesTab({
  onInsertContent,
  canInsert = false,
  activeChapterTitle,
  onOpenSourceManager,
}: SourcesTabProps) {
  const params = useParams();
  const projectId = params.projectId as string;
  const {
    sourcesView,
    activeSourceId,
    returnTab,
    scrollToText,
    viewSource,
    backToSourceList,
    returnToPreviousTab,
  } = useResearchPanel();

  const { showToast } = useToast();

  const { sources, isLoading, error, fetchSources, importAsChapter } = useSources(projectId);

  const { connections: projectConnections, isLoading: connectionsLoading } =
    useProjectSourceConnections(projectId);

  // Search
  const {
    query: searchQuery,
    results: searchResults,
    isSearching,
    isActive: searchIsActive,
    handleQueryChange,
    clearSearch,
  } = useSourceSearch(projectId);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derive active source from sources list and activeSourceId
  const activeSource = useMemo<SourceMaterial | null>(() => {
    if (!activeSourceId || sources.length === 0) return null;
    return sources.find((s) => s.id === activeSourceId) ?? null;
  }, [activeSourceId, sources]);

  // Fetch sources on mount
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Email lookup for source badges
  const emailByConnectionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const conn of projectConnections) {
      map.set(conn.driveConnectionId, conn.email);
    }
    return map;
  }, [projectConnections]);

  // Client-side recency sort
  const sortedSources = useMemo(
    () =>
      [...sources].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [sources],
  );

  const handleInsertIntoChapter = useCallback(
    (content: string, sourceTitle: string) => {
      if (onInsertContent) {
        const result = onInsertContent(content, sourceTitle);
        if (result === "inserted") {
          showToast("Inserted into chapter");
        } else if (result === "appended") {
          showToast("Appended to chapter");
        }
      }
    },
    [onInsertContent, showToast],
  );

  const handleImportAsChapter = useCallback(
    async (sourceId: string) => {
      const result = await importAsChapter(sourceId);
      if (result) {
        showToast(`Imported "${result.title}" as new chapter`);
      }
    },
    [importAsChapter, showToast],
  );

  // Back navigation from detail view
  const handleDetailBack = useCallback(() => {
    if (returnTab) {
      returnToPreviousTab();
    } else {
      backToSourceList();
    }
  }, [returnTab, returnToPreviousTab, backToSourceList]);

  const detailBackLabel =
    returnTab === "ask" ? "Back to Ask" : returnTab === "clips" ? "Back to Clips" : "Sources";

  // --- View Router ---

  if (sourcesView === "detail" && activeSourceId) {
    return (
      <SourceDetailView
        sourceId={activeSourceId}
        title={activeSource?.title ?? "Source"}
        projectId={projectId}
        onBack={handleDetailBack}
        backLabel={detailBackLabel}
        scrollToText={scrollToText ?? undefined}
        onInsertIntoChapter={onInsertContent ? handleInsertIntoChapter : undefined}
        canInsert={canInsert}
        activeChapterTitle={activeChapterTitle}
        onImportAsChapter={handleImportAsChapter}
        driveConnectionId={activeSource?.driveConnectionId ?? undefined}
        driveFileId={activeSource?.driveFileId ?? undefined}
      />
    );
  }

  // --- Flat Source List View ---

  const dataReady = !error && !(isLoading && sources.length === 0);
  const showEmptyState = dataReady && sources.length === 0 && !isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Search header — visible when sources exist */}
      {dataReady && !showEmptyState && (
        <div className="shrink-0 border-b border-border px-3 py-2 flex items-center gap-2">
          <div className="flex-1 relative">
            {/* Search icon or spinner */}
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              {isSearching ? (
                <svg
                  className="animate-spin h-3.5 w-3.5 text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
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
              ) : (
                <svg
                  className="h-3.5 w-3.5 text-muted-foreground"
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
              )}
            </div>
            <input
              ref={searchInputRef}
              type="search"
              role="searchbox"
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search sources..."
              className="w-full h-8 pl-8 pr-2 text-sm bg-gray-100 rounded-md border-0
                         placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  clearSearch();
                  searchInputRef.current?.blur();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto min-h-0 flex flex-col">
        {/* Loading state */}
        {(isLoading || connectionsLoading) && sources.length === 0 && (
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
              Loading sources...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={fetchSources} className="text-xs text-red-600 underline mt-1">
              Retry
            </button>
          </div>
        )}

        {/* Empty state — doorway to Source Manager */}
        {showEmptyState && onOpenSourceManager && (
          <ContentEmptyState onOpenSourceManager={onOpenSourceManager} />
        )}

        {/* Search results */}
        {dataReady && searchIsActive && (
          <div aria-live="polite">
            {searchResults.length === 0 && !isSearching && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No sources match &apos;{searchQuery}&apos;
                </p>
              </div>
            )}
            {searchResults.length > 0 && (
              <ul className="divide-y divide-border" role="list" aria-label="Search results">
                {searchResults.map((result) => (
                  <SearchResultRow
                    key={result.sourceId}
                    result={result}
                    onTap={() => viewSource(result.sourceId)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Document list (hidden when search is active) */}
        {dataReady && !searchIsActive && sortedSources.length > 0 && (
          <ul className="divide-y divide-border" role="list" aria-label="Source materials">
            {sortedSources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                sourceBadge={getSourceBadge(source, emailByConnectionId)}
                onTap={() => viewSource(source.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
