"use client";

import { useEffect, useCallback, useMemo, useState, type MouseEvent } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel } from "./research-panel-provider";
import { SourceAddFlow } from "./source-add-flow";
import { SourceDetailView } from "./source-detail-view";
import { useSources, type SourceMaterial } from "@/hooks/use-sources";
import { useDriveAccounts } from "@/hooks/use-drive-accounts";
import {
  useProjectSourceConnections,
  type ProjectSourceConnection,
} from "@/hooks/use-project-source-connections";

// === Source Badge Helpers ===

function getSourceBadge(source: SourceMaterial, emailByConnectionId: Map<string, string>): string {
  if (source.sourceType === "local") return "Device";
  if (!source.driveConnectionId) return "Account disconnected";
  const email = emailByConnectionId.get(source.driveConnectionId);
  if (!email) return "Account disconnected";
  const singleAccount = emailByConnectionId.size <= 1;
  return abbreviateEmail(email, singleAccount);
}

function abbreviateEmail(email: string, singleAccount: boolean): string {
  if (singleAccount) return "Drive";
  const [local] = email.split("@");
  if (!local) return email;
  return local.length > 14 ? local.slice(0, 12) + "..." : local;
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

// === Connection Row (SOURCES section) ===

function ConnectionRow({
  connection,
  onTap,
  onUnlink,
}: {
  connection: ProjectSourceConnection;
  onTap: () => void;
  onUnlink: () => void;
}) {
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      onUnlink();
    } finally {
      setIsUnlinking(false);
      setConfirmUnlink(false);
    }
  };

  return (
    <li className="px-4 py-2.5 min-h-[48px]">
      <div className="flex items-center gap-3">
        {/* Drive icon */}
        <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-50 shrink-0">
          <svg
            className="w-3.5 h-3.5 text-gray-500"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
          </svg>
        </div>

        {/* Info — tappable to browse */}
        <button
          onClick={onTap}
          className="min-w-0 flex-1 text-left hover:bg-gray-50 -mx-1 px-1 rounded transition-colors"
        >
          <p className="text-sm font-medium text-foreground truncate">{connection.email}</p>
          <p className="text-xs text-muted-foreground">
            {connection.documentCount} document{connection.documentCount !== 1 ? "s" : ""}
          </p>
        </button>

        {/* Unlink button */}
        {!confirmUnlink && (
          <button
            onClick={() => setConfirmUnlink(true)}
            className="text-xs font-medium text-red-500 hover:text-red-600
                       min-h-[32px] px-2 flex items-center transition-colors shrink-0"
          >
            Unlink
          </button>
        )}
      </div>

      {/* Inline unlink confirmation */}
      {confirmUnlink && (
        <div className="flex items-center gap-2 mt-1.5 py-1 px-2 bg-red-50 rounded ml-11">
          <span className="text-xs text-red-700">Unlink and archive documents?</span>
          <button
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="text-xs font-medium text-red-600 hover:text-red-700
                       min-h-[32px] flex items-center transition-colors disabled:opacity-50"
          >
            {isUnlinking ? "..." : "Yes"}
          </button>
          <button
            onClick={() => setConfirmUnlink(false)}
            disabled={isUnlinking}
            className="text-xs font-medium text-gray-600 hover:text-gray-700
                       min-h-[32px] flex items-center transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

// === Sources Tab ===

export function SourcesTab() {
  const params = useParams();
  const projectId = params.projectId as string;
  const {
    sourcesView,
    activeSourceId,
    activeConnectionId,
    returnTab,
    scrollToText,
    startAddDocument,
    viewSource,
    backToSourceList,
    returnToPreviousTab,
    finishFlow,
  } = useResearchPanel();

  const { sources, isLoading, error, fetchSources, addSources, uploadLocalFile, removeSource } =
    useSources(projectId);

  const {
    connections: projectConnections,
    isLoading: connectionsLoading,
    unlinkConnection,
  } = useProjectSourceConnections(projectId);

  // Drive connect function for "+ Link" button (starts OAuth flow)
  const { connect: connectDrive } = useDriveAccounts();

  // Collapsible SOURCES section
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`dc_sources_collapsed:${projectId}`);
      // Hydration-safe: must read localStorage in effect, not in useState initializer
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from external store (localStorage)
      if (stored === "true") setSourcesCollapsed(true);
    } catch {
      /* private browsing */
    }
  }, [projectId]);

  const toggleSourcesCollapsed = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setSourcesCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(`dc_sources_collapsed:${projectId}`, String(next));
        } catch {
          /* private browsing */
        }
        return next;
      });
    },
    [projectId],
  );

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

  // Email lookup for source badges — from project connections only
  const emailByConnectionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const conn of projectConnections) {
      map.set(conn.driveConnectionId, conn.email);
    }
    return map;
  }, [projectConnections]);

  // Intentional client-side recency sort — overrides API's sort_order ASC
  const sortedSources = useMemo(
    () =>
      [...sources].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [sources],
  );

  // Drive accounts for add flow — only project-linked accounts
  const linkedDriveAccounts = useMemo(
    () =>
      projectConnections.map((c) => ({
        id: c.driveConnectionId,
        email: c.email,
        connectedAt: c.connectedAt,
      })),
    [projectConnections],
  );

  const handleUploadLocal = useCallback(
    async (file: File) => {
      await uploadLocalFile(file);
      finishFlow();
    },
    [uploadLocalFile, finishFlow],
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
      finishFlow();
    },
    [addSources, finishFlow],
  );

  const handleUnlinkConnection = useCallback(
    async (driveConnectionId: string) => {
      await unlinkConnection(driveConnectionId);
      // Refresh sources since documents were archived
      fetchSources();
    },
    [unlinkConnection, fetchSources],
  );

  /**
   * "+ Link" handler: sets sessionStorage flag and starts OAuth.
   * After OAuth completes, the success page auto-links the connection
   * to this project and redirects back to the editor.
   */
  const handleLinkSource = useCallback(() => {
    sessionStorage.setItem("dc_pending_source_link", projectId);
    connectDrive();
  }, [projectId, connectDrive]);

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

  if (sourcesView === "add-document") {
    return (
      <SourceAddFlow
        driveAccounts={linkedDriveAccounts}
        existingDriveFileIds={existingDriveFileIds}
        preSelectedConnectionId={activeConnectionId}
        onBack={backToSourceList}
        onAddDriveFiles={handleAddDriveFiles}
        onUploadLocal={handleUploadLocal}
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

  // --- Two-Section List View (always visible) ---

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
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

        {/* Two-section layout — always shown */}
        {!error && !(isLoading && sources.length === 0) && (
          <>
            {/* SOURCES section (collapsible) */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleSourcesCollapsed}
                  className="flex items-center gap-1.5 min-h-[32px] group"
                  aria-expanded={!sourcesCollapsed}
                  aria-controls="sources-section"
                >
                  <svg
                    className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${
                      sourcesCollapsed ? "rotate-0" : "rotate-90"
                    }`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                  </svg>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                    Sources
                    {projectConnections.length > 0 && (
                      <span className="ml-1 font-normal">({projectConnections.length})</span>
                    )}
                  </span>
                </button>
                <button
                  onClick={handleLinkSource}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700
                             min-h-[32px] flex items-center transition-colors"
                >
                  + Link
                </button>
              </div>
            </div>

            {!sourcesCollapsed && (
              <div id="sources-section">
                {projectConnections.length === 0 && !connectionsLoading && (
                  <div className="px-4 py-2">
                    <p className="text-sm text-muted-foreground">No sources linked yet.</p>
                  </div>
                )}

                {projectConnections.length > 0 && (
                  <ul className="divide-y divide-border" role="list" aria-label="Linked sources">
                    {projectConnections.map((conn) => (
                      <ConnectionRow
                        key={conn.id}
                        connection={conn}
                        onTap={() => startAddDocument(conn.driveConnectionId)}
                        onUnlink={() => handleUnlinkConnection(conn.driveConnectionId)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Divider between sections */}
            <div className="border-t border-border mt-2" />

            {/* DOCUMENTS section */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Documents
                  {sources.length > 0 && (
                    <span className="ml-1.5 font-normal">({sources.length})</span>
                  )}
                </p>
                <button
                  onClick={() => startAddDocument()}
                  className="h-7 px-2.5 flex items-center gap-1 rounded-md bg-blue-600 text-white text-xs font-medium
                             hover:bg-blue-700 transition-colors"
                  aria-label="Add document"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add
                </button>
              </div>
            </div>

            {sources.length === 0 && !isLoading && (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No documents yet. Upload from device or browse your linked sources.
                </p>
              </div>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}
