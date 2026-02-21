"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel } from "./research-panel-provider";
import { SourceAddFlow } from "./source-add-flow";
import { SourceDetailView } from "./source-detail-view";
import { useSources, type SourceMaterial } from "@/hooks/use-sources";
import { useToast } from "@/components/toast";
import { useLinkedFolders, type LinkFolderInput } from "@/hooks/use-linked-folders";
import { useProjectSourceConnections } from "@/hooks/use-project-source-connections";
import type { InsertResult } from "@/hooks/use-clip-insert";

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

// === Relative time helper ===

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never synced";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                {sourceBadge}
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

// === Linked Folder Row ===

function LinkedFolderRow({
  folder,
  onUnlink,
}: {
  folder: {
    id: string;
    folderName: string;
    email: string;
    documentCount: number;
    lastSyncedAt: string | null;
  };
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
        {/* Folder icon */}
        <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-amber-50 shrink-0">
          <svg
            className="w-4 h-4 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            />
          </svg>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{folder.folderName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {folder.documentCount} doc{folder.documentCount !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-300" aria-hidden="true">
              &middot;
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {abbreviateEmail(folder.email, false)}
            </span>
            <span className="text-xs text-gray-300" aria-hidden="true">
              &middot;
            </span>
            <span className="text-xs text-muted-foreground">
              {relativeTime(folder.lastSyncedAt)}
            </span>
          </div>
        </div>

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
        <div className="flex items-center gap-2 mt-1.5 py-1 px-2 bg-amber-50 rounded ml-11">
          <span className="text-xs text-amber-700">Unlink folder? Documents will remain.</span>
          <button
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="text-xs font-medium text-amber-600 hover:text-amber-700
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

export interface SourcesTabProps {
  onInsertContent?: (text: string, sourceTitle: string) => InsertResult;
  canInsert?: boolean;
  activeChapterTitle?: string;
}

export function SourcesTab({
  onInsertContent,
  canInsert = false,
  activeChapterTitle,
}: SourcesTabProps) {
  const params = useParams();
  const projectId = params.projectId as string;
  const {
    sourcesView,
    activeSourceId,
    activeConnectionId,
    addMode,
    returnTab,
    scrollToText,
    startAddDocument,
    startLinkFolder,
    viewSource,
    backToSourceList,
    returnToPreviousTab,
    finishFlow,
  } = useResearchPanel();

  const { showToast } = useToast();

  const { sources, isLoading, error, fetchSources, addSources, uploadLocalFile, removeSource } =
    useSources(projectId);

  const { connections: projectConnections, isLoading: connectionsLoading } =
    useProjectSourceConnections(projectId);

  const {
    linkedFolders,
    isLoading: foldersLoading,
    isSyncing,
    linkFolder,
    unlinkFolder,
  } = useLinkedFolders(projectId);

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
      const result = await addSources(pickerFiles, connectionId);
      if (result?.expandedCounts) {
        const { docsInserted, selectedFolders } = result.expandedCounts;
        showToast(
          `Added ${docsInserted} doc${docsInserted !== 1 ? "s" : ""} from ${selectedFolders} folder${selectedFolders !== 1 ? "s" : ""}`,
        );
      }
      finishFlow();
    },
    [addSources, finishFlow, showToast],
  );

  const handleLinkFolder = useCallback(
    async (folderId: string, folderName: string, connectionId: string) => {
      const input: LinkFolderInput = {
        driveConnectionId: connectionId,
        driveFolderId: folderId,
        folderName,
      };
      const result = await linkFolder(input);
      if (result) {
        const newDocs = result.sync?.newDocs ?? 0;
        showToast(`Linked "${folderName}" — ${newDocs} doc${newDocs !== 1 ? "s" : ""} added`);
        // Refresh sources since sync added new documents
        fetchSources();
      }
      finishFlow();
    },
    [linkFolder, finishFlow, showToast, fetchSources],
  );

  const handleUnlinkFolder = useCallback(
    async (linkedFolderId: string) => {
      await unlinkFolder(linkedFolderId);
    },
    [unlinkFolder],
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
      // Use the import-as-chapter API endpoint
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/sources/${sourceId}/import-as-chapter`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${await (window as unknown as { Clerk?: { session?: { getToken?: () => Promise<string> } } }).Clerk?.session?.getToken?.()}`,
            },
          },
        );
        if (response.ok) {
          showToast("Imported as new chapter");
        }
      } catch {
        showToast("Failed to import as chapter");
      }
    },
    [showToast],
  );

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
        mode={addMode === "link-folder" ? "link-folder" : "add-documents"}
        driveAccounts={linkedDriveAccounts}
        existingDriveFileIds={existingDriveFileIds}
        preSelectedConnectionId={activeConnectionId}
        onBack={backToSourceList}
        onAddDriveFiles={handleAddDriveFiles}
        onUploadLocal={handleUploadLocal}
        onLinkFolder={handleLinkFolder}
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
        onInsertIntoChapter={onInsertContent ? handleInsertIntoChapter : undefined}
        canInsert={canInsert}
        activeChapterTitle={activeChapterTitle}
        onImportAsChapter={handleImportAsChapter}
      />
    );
  }

  // --- Two-Section List View ---

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Loading state */}
        {(isLoading || connectionsLoading || foldersLoading) && sources.length === 0 && (
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
            {/* LINKED FOLDERS section */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Linked Folders
                    {linkedFolders.length > 0 && (
                      <span className="ml-1 font-normal">({linkedFolders.length})</span>
                    )}
                  </span>
                  {/* Sync indicator */}
                  {isSyncing && (
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
                      title="Syncing folders..."
                      aria-label="Syncing folders"
                    />
                  )}
                </div>
                <button
                  onClick={() => startLinkFolder()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700
                             min-h-[32px] flex items-center transition-colors"
                >
                  + Link
                </button>
              </div>
            </div>

            {linkedFolders.length === 0 && !foldersLoading && (
              <div className="px-4 py-2">
                <p className="text-sm text-muted-foreground">
                  No folders linked yet. Link a Drive folder to auto-sync its documents.
                </p>
              </div>
            )}

            {linkedFolders.length > 0 && (
              <ul className="divide-y divide-border" role="list" aria-label="Linked folders">
                {linkedFolders.map((folder) => (
                  <LinkedFolderRow
                    key={folder.id}
                    folder={folder}
                    onUnlink={() => handleUnlinkFolder(folder.id)}
                  />
                ))}
              </ul>
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
