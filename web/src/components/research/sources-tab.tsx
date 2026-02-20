"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel } from "./research-panel-provider";
import { SourceAddFlow } from "./source-add-flow";
import { SourceDetailView } from "./source-detail-view";
import { ConnectionsView } from "./connections-view";
import { useSources, type SourceMaterial } from "@/hooks/use-sources";
import { useDriveAccounts } from "@/hooks/use-drive-accounts";

// === Source Badge Helpers ===

function getSourceBadge(source: SourceMaterial, emailByConnectionId: Map<string, string>): string {
  if (source.sourceType === "local") return "From device";
  if (!source.driveConnectionId) return "Account disconnected";
  const email = emailByConnectionId.get(source.driveConnectionId);
  if (!email) return "Account disconnected";
  const singleAccount = emailByConnectionId.size <= 1;
  return abbreviateEmail(email, singleAccount);
}

function abbreviateEmail(email: string, singleAccount: boolean): string {
  // Single account: just show "Drive" (no disambiguation needed)
  if (singleAccount) return "Drive";
  // Multiple accounts: show local part only, truncated.
  // Domain adds no value for disambiguation — users know their accounts by username.
  const [local] = email.split("@");
  if (!local) return email;
  return local.length > 14 ? local.slice(0, 12) + "..." : local;
  // CSS `truncate` with max-w on the badge span provides a safety net.
}

// === Source Card ===

function SourceCard({
  source,
  sourceBadge,
  onTap,
  onRemove,
}: {
  source: SourceMaterial;
  sourceBadge: string;
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
                  &middot;
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {sourceBadge}
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
                <span className="text-gray-300 ml-0.5" aria-hidden="true">
                  &middot;
                </span>
                <span className="truncate max-w-[120px]">{sourceBadge}</span>
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

function SourcesEmptyState({
  onConnectDrive,
  onUploadFile,
}: {
  onConnectDrive: () => void;
  onUploadFile: () => void;
}) {
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
      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        <button
          onClick={onConnectDrive}
          className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-700 transition-colors"
        >
          Connect Google Drive
        </button>
        <button
          onClick={onUploadFile}
          className="h-10 px-4 text-sm font-medium text-foreground rounded-lg border border-border
                     hover:bg-gray-50 transition-colors"
        >
          Upload File
        </button>
      </div>
    </div>
  );
}

// === Sources Tab ===

export function SourcesTab({
  protectedConnectionIds = [],
}: {
  /** Connection IDs that cannot be disconnected from within the Sources tab (e.g. backup accounts) */
  protectedConnectionIds?: string[];
}) {
  const params = useParams();
  const projectId = params.projectId as string;
  const {
    sourcesView,
    activeSourceId,
    activeConnectionId,
    returnTab,
    scrollToText,
    startAddFlow,
    viewSource,
    viewConnections,
    backToSourceList,
    returnToPreviousTab,
    finishAdd,
  } = useResearchPanel();

  const { sources, isLoading, error, fetchSources, addSources, uploadLocalFile, removeSource } =
    useSources(projectId);

  const {
    accounts: driveAccounts,
    connect: connectDrive,
    disconnect: disconnectDrive,
  } = useDriveAccounts();

  // Derive active source from sources list and activeSourceId (no state needed)
  const activeSource = useMemo<SourceMaterial | null>(() => {
    if (!activeSourceId || sources.length === 0) return null;
    return sources.find((s) => s.id === activeSourceId) ?? null;
  }, [activeSourceId, sources]);

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

  // Email lookup for source badges
  const emailByConnectionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of driveAccounts) {
      map.set(account.id, account.email);
    }
    return map;
  }, [driveAccounts]);

  // Intentional client-side recency sort — overrides API's sort_order ASC
  // so the library shows most-recently-added first (content management UX).
  const sortedSources = useMemo(
    () =>
      [...sources].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [sources],
  );

  const handleUploadLocal = useCallback(
    async (file: File) => {
      await uploadLocalFile(file);
      finishAdd();
    },
    [uploadLocalFile, finishAdd],
  );

  const handleAddDriveFiles = useCallback(
    async (
      files: Array<{ driveFileId: string; title: string; mimeType: string }>,
      connectionId: string,
    ) => {
      const pickerFiles = files.map((f) => ({
        driveFileId: f.driveFileId,
        title: f.title,
        mimeType: f.mimeType,
      }));
      await addSources(pickerFiles, connectionId);
      finishAdd();
    },
    [addSources, finishAdd],
  );

  const handleConnectAccount = useCallback(() => {
    connectDrive();
  }, [connectDrive]);

  // Compute back label for source detail view based on returnTab
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

  if (sourcesView === "add") {
    return (
      <SourceAddFlow
        driveAccounts={driveAccounts}
        existingDriveFileIds={existingDriveFileIds}
        protectedConnectionIds={protectedConnectionIds}
        preSelectedConnectionId={activeConnectionId}
        onBack={backToSourceList}
        onAddDriveFiles={handleAddDriveFiles}
        onUploadLocal={handleUploadLocal}
        onConnectAccount={handleConnectAccount}
      />
    );
  }

  if (sourcesView === "detail" && activeSourceId) {
    return (
      <SourceDetailView
        sourceId={activeSourceId}
        title={activeSource?.title ?? "Source"}
        projectId={projectId}
        onBack={handleDetailBack}
        backLabel={detailBackLabel}
        scrollToText={scrollToText ?? undefined}
      />
    );
  }

  if (sourcesView === "connections") {
    return (
      <ConnectionsView
        driveAccounts={driveAccounts}
        sources={sources}
        protectedConnectionIds={protectedConnectionIds}
        onBack={backToSourceList}
        onBrowseFiles={(connectionId) => startAddFlow(connectionId)}
        onConnectAccount={handleConnectAccount}
        onDisconnect={disconnectDrive}
      />
    );
  }

  // --- Flat Document Library ---
  return (
    <div className="flex flex-col h-full">
      {/* Header with Add button */}
      <div className="flex items-center justify-between h-11 px-4 shrink-0 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {sources.length > 0 ? `${sources.length} source${sources.length === 1 ? "" : "s"}` : ""}
        </span>
        <button
          onClick={() => startAddFlow()}
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

        {/* Empty: no accounts AND no sources */}
        {!isLoading && !error && sources.length === 0 && driveAccounts.length === 0 && (
          <SourcesEmptyState
            onConnectDrive={handleConnectAccount}
            onUploadFile={() => startAddFlow()}
          />
        )}

        {/* Empty: accounts connected but no docs */}
        {!isLoading && !error && sources.length === 0 && driveAccounts.length > 0 && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <p className="text-base font-medium text-foreground mb-2">No research documents yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Browse your connected accounts or upload files to get started.
            </p>
            <button
              onClick={() => startAddFlow()}
              className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg
                         hover:bg-blue-700 transition-colors"
            >
              + Add Documents
            </button>
          </div>
        )}

        {/* Flat document list */}
        {sortedSources.length > 0 && (
          <ul className="divide-y divide-border" role="list" aria-label="Source materials">
            {sortedSources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                sourceBadge={getSourceBadge(source, emailByConnectionId)}
                onTap={() => viewSource(source.id)}
                onRemove={() => removeSource(source.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer info bar — connection status + Manage link */}
      {(driveAccounts.length > 0 || sources.some((s) => s.sourceType !== "local")) && (
        <div
          className="shrink-0 border-t border-border px-4 py-2.5
                      flex items-center justify-between"
        >
          <span className="text-xs text-muted-foreground">
            {driveAccounts.length} account{driveAccounts.length !== 1 ? "s" : ""} connected
          </span>
          <button
            onClick={viewConnections}
            className="text-xs font-medium text-blue-600 hover:text-blue-700
                       min-h-[44px] flex items-center"
          >
            Manage
          </button>
        </div>
      )}
    </div>
  );
}
