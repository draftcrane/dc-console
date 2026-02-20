"use client";

import { useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel } from "./research-panel-provider";
import { QueryInput } from "./query-input";
import { ResultCard } from "./result-card";
import {
  useAIResearch,
  snippetKey,
  type ResearchSnippet,
  type ResearchQueryResult,
} from "@/hooks/use-ai-research";

// === Types ===

interface AskTabProps {
  onSaveClip?: (clip: {
    content: string;
    sourceId: string | null;
    sourceTitle: string;
    sourceLocation: string | null;
    chapterId?: string;
  }) => Promise<void>;
  onInsertSnippet?: (text: string, sourceTitle: string, sourceId: string | null) => void;
  canInsert?: boolean;
}

// === Suggested Queries ===

const SUGGESTED_QUERIES = [
  "What are the key themes across my sources?",
  "Find quotes about leadership and teamwork",
  "Summarize the main arguments in my research",
];

// === Skeleton Loader ===

function StreamingLoader({ sourceCount }: { sourceCount: number | null }) {
  return (
    <div className="px-4 py-3" aria-busy="true" aria-label="Searching sources">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
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
        <span>
          Searching across {sourceCount ?? "your"} source{sourceCount !== 1 ? "s" : ""}...
        </span>
      </div>
      {/* Skeleton cards */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border p-3 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-full mb-2" />
            <div className="h-3 bg-gray-200 rounded w-4/5 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
            <div className="h-2.5 bg-gray-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// === Empty State (Suggested Queries) ===

function EmptyState({ onSelectQuery }: { onSelectQuery: (query: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
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
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
      <p className="text-base font-medium text-foreground mb-2">Ask about your sources</p>
      <p className="text-sm text-muted-foreground mb-6">
        Search your research documents with natural language questions.
      </p>

      {/* Suggested queries */}
      <div className="w-full space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Try asking
        </p>
        {SUGGESTED_QUERIES.map((query) => (
          <button
            key={query}
            onClick={() => onSelectQuery(query)}
            className="w-full min-h-[44px] text-left px-4 py-2.5 rounded-lg border border-border
                       bg-white text-sm text-foreground hover:bg-gray-50 transition-colors"
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  );
}

// === No Sources State ===

function NoSourcesState({ onGoToSources }: { onGoToSources: () => void }) {
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
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
      <p className="text-base font-medium text-foreground mb-2">Add source documents first</p>
      <p className="text-sm text-muted-foreground mb-4">
        You need at least one source document before you can search across them.
      </p>
      <button
        onClick={onGoToSources}
        className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg
                   hover:bg-blue-700 transition-colors"
      >
        Go to Sources
      </button>
    </div>
  );
}

// === Error State ===

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-4 py-3">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700 mb-2">{message}</p>
        <button
          onClick={onRetry}
          className="h-9 px-3 text-sm font-medium text-red-600 bg-white border border-red-200
                     rounded-lg hover:bg-red-50 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// === No Results State ===

function NoResultsState() {
  return (
    <div className="px-4 py-3">
      <div className="rounded-lg border border-border bg-gray-50 p-4 text-center">
        <p className="text-sm text-foreground mb-1">No relevant results found</p>
        <p className="text-xs text-muted-foreground">
          Try rephrasing your question or using different keywords. Broader questions often work
          better.
        </p>
      </div>
    </div>
  );
}

// === Conversation Q&A Block ===

function ConversationBlock({
  query,
  result,
  onSaveToClips,
  onInsertSnippet,
  onViewSource,
  canInsert,
  savedKeys,
  sourceCount,
}: {
  query: string;
  result: ResearchQueryResult;
  onSaveToClips: (snippet: ResearchSnippet) => Promise<void>;
  onInsertSnippet: (text: string, sourceTitle: string, sourceId: string | null) => void;
  onViewSource: (sourceId: string) => void;
  canInsert: boolean;
  savedKeys: Set<string>;
  sourceCount: number | null;
}) {
  return (
    <div className="px-4 py-3" aria-live="polite">
      {/* User query */}
      <div className="mb-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">You</p>
        <p className="text-sm text-foreground">{query}</p>
      </div>

      {/* Streaming loader */}
      {result.isStreaming && result.snippets.length === 0 && (
        <StreamingLoader sourceCount={sourceCount} />
      )}

      {/* Results */}
      {result.snippets.length > 0 && (
        <div className="space-y-3">
          {result.isStreaming && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <svg className="h-3 w-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
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
              Found {result.snippets.length} result{result.snippets.length !== 1 ? "s" : ""} so
              far...
            </p>
          )}
          {!result.isStreaming && (
            <p className="text-xs text-muted-foreground">
              Found {result.resultCount} result{result.resultCount !== 1 ? "s" : ""}
              {result.processingTimeMs ? ` in ${(result.processingTimeMs / 1000).toFixed(1)}s` : ""}
            </p>
          )}
          {result.snippets.map((snippet, i) => (
            <ResultCard
              key={`${result.id}-${i}`}
              content={snippet.content}
              sourceTitle={snippet.sourceTitle}
              sourceId={snippet.sourceId}
              sourceLocation={snippet.sourceLocation}
              onSaveToClips={async () => onSaveToClips(snippet)}
              onInsert={() =>
                onInsertSnippet(snippet.content, snippet.sourceTitle, snippet.sourceId)
              }
              onViewSource={() => {
                if (snippet.sourceId) onViewSource(snippet.sourceId);
              }}
              isSaved={savedKeys.has(snippetKey(snippet))}
              canInsert={canInsert}
            />
          ))}
        </div>
      )}

      {/* No results */}
      {!result.isStreaming && !result.error && result.noResults && <NoResultsState />}

      {/* Error in specific result */}
      {result.error && !result.isStreaming && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{result.error}</p>
        </div>
      )}
    </div>
  );
}

// === Virtual Keyboard Handling ===

/**
 * Handle virtual keyboard on iOS/iPad.
 * Uses the visualViewport API to scroll conversation up when the keyboard appears.
 */
function useVirtualKeyboardHandler(scrollContainerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function handleResize() {
      const container = scrollContainerRef.current;
      if (!container) return;

      // When keyboard opens, viewport height shrinks.
      // Scroll to bottom of conversation to keep latest content visible.
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }

    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, [scrollContainerRef]);
}

// === Main AskTab Component ===

/**
 * AskTab - AI natural-language query tab with streaming results.
 *
 * Per design spec Sections 5 (Flow 4) and 7 (AskTab):
 * - Query input at bottom (iMessage/chat pattern)
 * - Empty state shows 3 suggested queries (tappable, auto-submit)
 * - Loading: skeleton loader with "Searching across N sources..."
 * - Results stream in as SSE events, appearing progressively
 * - Conversation history persists within session
 * - Error/no-results/no-sources states
 * - Virtual keyboard handling via visualViewport API
 */
export function AskTab({ onSaveClip, onInsertSnippet, canInsert = false }: AskTabProps) {
  const params = useParams();
  const projectId = params.projectId as string;
  const { setActiveTab, viewSource } = useResearchPanel();

  const research = useAIResearch({ projectId });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Virtual keyboard handling
  useVirtualKeyboardHandler(scrollContainerRef);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [research.conversation]);

  const handleSuggestedQuery = useCallback(
    (query: string) => {
      research.setQueryInput(query);
      research.submitQuery(query);
    },
    [research],
  );

  const handleGoToSources = useCallback(() => {
    setActiveTab("sources");
  }, [setActiveTab]);

  const handleSaveToClips = useCallback(
    async (snippet: ResearchSnippet) => {
      if (onSaveClip) {
        await onSaveClip({
          content: snippet.content,
          sourceId: snippet.sourceId,
          sourceTitle: snippet.sourceTitle,
          sourceLocation: snippet.sourceLocation,
        });
      } else {
        await research.saveToClips(snippet);
      }
    },
    [onSaveClip, research],
  );

  const handleInsertSnippet = useCallback(
    (text: string, sourceTitle: string, sourceId: string | null) => {
      if (onInsertSnippet) {
        onInsertSnippet(text, sourceTitle, sourceId);
      }
    },
    [onInsertSnippet],
  );

  const handleViewSource = useCallback(
    (sourceId: string) => {
      viewSource(sourceId, "ask");
    },
    [viewSource],
  );

  // No sources state
  if (research.noSources) {
    return (
      <div className="flex flex-col h-full">
        <NoSourcesState onGoToSources={handleGoToSources} />
      </div>
    );
  }

  const hasConversation = research.conversation.length > 0;
  const isStreaming = research.state === "streaming";
  const hasGlobalError = research.state === "error" && research.errorMessage && !hasConversation;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable conversation area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-0">
        {/* Empty state with suggested queries */}
        {!hasConversation && !isStreaming && !hasGlobalError && (
          <EmptyState onSelectQuery={handleSuggestedQuery} />
        )}

        {/* Global error (no conversation yet) */}
        {hasGlobalError && <ErrorState message={research.errorMessage!} onRetry={research.retry} />}

        {/* Conversation history */}
        {hasConversation && (
          <div className="divide-y divide-border">
            {research.conversation.map((entry) => (
              <ConversationBlock
                key={entry.id}
                query={entry.query}
                result={entry.result}
                onSaveToClips={handleSaveToClips}
                onInsertSnippet={handleInsertSnippet}
                onViewSource={handleViewSource}
                canInsert={canInsert}
                savedKeys={research.savedSnippetKeys}
                sourceCount={research.sourceCount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Query input at bottom */}
      <QueryInput
        placeholder="Ask about your sources..."
        value={research.queryInput}
        onChange={research.setQueryInput}
        onSubmit={() => research.submitQuery()}
        isLoading={isStreaming}
        disabled={research.noSources}
      />
    </div>
  );
}
