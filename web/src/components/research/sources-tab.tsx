"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel } from "./research-panel-provider";
import { SourceAddFlow } from "./source-add-flow";
import { useSources, type SourceMaterial } from "@/hooks/use-sources";
import { useDriveAccounts } from "@/hooks/use-drive-accounts";

// === Relative Time Formatter ===

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

// === Source Card ===

function SourceCard({
  source,
  onTap,
  onRemove,
}: {
  source: SourceMaterial;
  onTap: () => void;
  onRemove: () => void;
}) {
  const isError = source.status === "error";
  const isArchived = source.status === "archived";

  return (
    <li className={`min-h-[56px] ${isArchived ? "opacity-60" : ""}`}>
      <button
        onClick={isError || isArchived ? undefined : onTap}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors
          ${isError || isArchived ? "" : "hover:bg-gray-50"}`}
        disabled={isError || isArchived}
      >
        {/* Doc icon */}
        <div
          className={`h-9 w-9 flex items-center justify-center rounded-lg shrink-0 ${
            isError ? "bg-red-50" : isArchived ? "bg-gray-100" : "bg-blue-50"
          }`}
        >
          <svg
            className={`w-4 h-4 ${isError ? "text-red-400" : isArchived ? "text-gray-400" : "text-blue-500"}`}
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{source.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {isError ? (
              <span className="text-xs text-red-500">Could not extract text</span>
            ) : isArchived ? (
              <span className="text-xs text-amber-600">Account disconnected</span>
            ) : source.cachedAt ? (
              <>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {source.wordCount.toLocaleString()} words
                </span>
                <span className="text-xs text-gray-300" aria-hidden="true">
                  |
                </span>
                <span className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(source.cachedAt)}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <svg
                  className="animate-spin h-3 w-3"
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
                Processing...
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Error actions */}
      {(isError || isArchived) && (
        <div className="flex items-center gap-2 px-4 pb-2 ml-12">
          <button
            onClick={onRemove}
            className="h-8 px-2.5 text-xs font-medium text-red-500 rounded-md hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

// === Sources Tab Empty State ===

function SourcesEmptyState({ onAdd }: { onAdd: () => void }) {
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
      <p className="text-base font-medium text-foreground mb-2">No sources yet</p>
      <p className="text-sm text-muted-foreground mb-4">
        Add your Google Docs, PDFs, or other research files to search and reference them while you
        write.
      </p>
      <button
        onClick={onAdd}
        className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg
                   hover:bg-blue-700 transition-colors"
      >
        Add Source
      </button>
    </div>
  );
}

// === Sources Tab ===

export function SourcesTab() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { sourcesView, startAddFlow, backToSourceList, finishAdd } = useResearchPanel();

  const { sources, isLoading, error, fetchSources, addSources, uploadLocalFile, removeSource } =
    useSources(projectId);

  const { accounts: driveAccounts, connect: connectDrive } = useDriveAccounts();

  // Fetch sources on mount
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Build a set of Drive file IDs already in the project for "Already added" detection
  const existingDriveFileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const source of sources) {
      if (source.driveFileId) {
        ids.add(source.driveFileId);
      }
    }
    return ids;
  }, [sources]);

  const handleUploadLocal = useCallback(
    async (file: File) => {
      await uploadLocalFile(file);
      finishAdd();
    },
    [uploadLocalFile, finishAdd],
  );

  const handleAddDriveFiles = useCallback(
    (
      files: Array<{ driveFileId: string; title: string; mimeType: string }>,
      connectionId: string,
    ) => {
      // Map to PickerFile format expected by addSources
      const pickerFiles = files.map((f) => ({
        driveFileId: f.driveFileId,
        title: f.title,
        mimeType: f.mimeType,
      }));
      addSources(pickerFiles, connectionId);
      finishAdd();
    },
    [addSources, finishAdd],
  );

  const handleConnectAccount = useCallback(() => {
    connectDrive();
  }, [connectDrive]);

  // Render add flow view
  if (sourcesView === "add") {
    return (
      <SourceAddFlow
        projectId={projectId}
        driveAccounts={driveAccounts}
        existingDriveFileIds={existingDriveFileIds}
        onBack={backToSourceList}
        onAddDriveFiles={handleAddDriveFiles}
        onUploadLocal={handleUploadLocal}
        onConnectAccount={handleConnectAccount}
      />
    );
  }

  // Source list view
  return (
    <div className="flex flex-col h-full">
      {/* Header with Add button */}
      <div className="flex items-center justify-between h-11 px-4 shrink-0 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {sources.length > 0 ? `${sources.length} source${sources.length === 1 ? "" : "s"}` : ""}
        </span>
        <button
          onClick={startAddFlow}
          className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium
                     hover:bg-blue-700 transition-colors"
          aria-label="Add source"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Loading state */}
        {isLoading && sources.length === 0 && (
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

        {/* Empty state */}
        {!isLoading && !error && sources.length === 0 && <SourcesEmptyState onAdd={startAddFlow} />}

        {/* Source list */}
        {sources.length > 0 && (
          <ul className="divide-y divide-border" role="list" aria-label="Source materials">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onTap={() => {
                  // Source detail view will be implemented in a future issue
                }}
                onRemove={() => removeSource(source.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
