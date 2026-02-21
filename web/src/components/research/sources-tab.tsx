"use client";

import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel } from "./research-panel-provider";
import { SourceAddFlow } from "./source-add-flow";
import { SourceDetailView } from "./source-detail-view";
import { useSources, type SourceMaterial } from "@/hooks/use-sources";
import { useSourceSearch, type SourceSearchResult } from "@/hooks/use-source-search";
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
  confirmingRemove,
  onStartRemove,
  onCancelRemove,
}: {
  source: SourceMaterial;
  sourceBadge: string;
  onTap: () => void;
  onRemove: () => void;
  confirmingRemove: boolean;
  onStartRemove: () => void;
  onCancelRemove: () => void;
}) {
  const isError = source.status === "error";
  const isArchived = source.status === "archived";

  return (
    <li className={`min-h-[56px] ${isArchived ? "opacity-60" : ""}`}>
      <div className="flex items-start">
        <button
          onClick={isError || isArchived ? undefined : onTap}
          className={`flex-1 text-left px-4 py-3 flex items-start gap-3 transition-colors min-w-0
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

        {/* Three-dot menu for active documents */}
        {!isError && !isArchived && (
          <button
            onClick={onStartRemove}
            className="flex items-center justify-center w-11 h-11 shrink-0 mr-1 mt-1.5
                       text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={`Options for ${source.title}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Inline remove confirmation for active documents */}
      {confirmingRemove && !isError && !isArchived && (
        <div className="flex items-center gap-2 py-1.5 px-4 bg-red-50 ml-4 mr-4 mb-2 rounded">
          <span className="text-xs text-red-700">Remove from project?</span>
          <button
            onClick={onRemove}
            className="text-xs font-medium text-red-600 hover:text-red-700
                       min-h-[32px] flex items-center transition-colors"
          >
            Yes
          </button>
          <button
            onClick={onCancelRemove}
            className="text-xs font-medium text-gray-600 hover:text-gray-700
                       min-h-[32px] flex items-center transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error/archived sources: inline remove button (no menu needed) */}
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

// === Empty State CTA ===

function EmptyStateCTA({
  onLinkFolder,
  onBrowseDrive,
  onUpload,
}: {
  onLinkFolder: () => void;
  onBrowseDrive: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-8">
      <div className="text-center mb-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Build Your Library</h3>
        <p className="text-sm text-muted-foreground">
          Add your research documents to search and reference them while writing.
        </p>
      </div>

      <div className="w-full max-w-[280px] space-y-2">
        <button
          onClick={onLinkFolder}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border
                     hover:bg-gray-50 transition-colors text-left min-h-[52px]"
        >
          <svg
            className="w-5 h-5 text-amber-500 shrink-0"
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
          <div>
            <p className="text-sm font-medium text-foreground">Link a Drive Folder</p>
            <p className="text-xs text-muted-foreground">Auto-sync Google Docs</p>
          </div>
        </button>

        <button
          onClick={onBrowseDrive}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border
                     hover:bg-gray-50 transition-colors text-left min-h-[52px]"
        >
          <svg
            className="w-5 h-5 text-blue-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-sm font-medium text-foreground">Browse Drive</p>
        </button>

        <button
          onClick={onUpload}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border
                     hover:bg-gray-50 transition-colors text-left min-h-[52px]"
        >
          <svg
            className="w-5 h-5 text-gray-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <p className="text-sm font-medium text-foreground">Upload from Device</p>
        </button>
      </div>
    </div>
  );
}

// === Collapsible Folders Footer ===

function FoldersFooter({
  linkedFolders,
  isSyncing,
  onUnlink,
  onLinkFolder,
}: {
  linkedFolders: Array<{
    id: string;
    folderName: string;
    email: string;
    documentCount: number;
    lastSyncedAt: string | null;
  }>;
  isSyncing: boolean;
  onUnlink: (folderId: string) => void;
  onLinkFolder: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (linkedFolders.length === 0) return null;

  // Find the most recent sync time across all folders
  const mostRecentSync = linkedFolders.reduce<string | null>((latest, f) => {
    if (!f.lastSyncedAt) return latest;
    if (!latest) return f.lastSyncedAt;
    return f.lastSyncedAt > latest ? f.lastSyncedAt : latest;
  }, null);

  return (
    <div className="border-t border-border mt-auto">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors min-h-[44px]"
        aria-expanded={expanded}
      >
        {isSyncing && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"
            title="Syncing folders..."
            aria-label="Syncing folders"
          />
        )}
        <span className="text-xs text-muted-foreground flex-1">
          {linkedFolders.length} folder{linkedFolders.length !== 1 ? "s" : ""}
          {mostRecentSync && <> &middot; Synced {relativeTime(mostRecentSync)}</>}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <ul className="divide-y divide-border" role="list" aria-label="Linked folders">
            {linkedFolders.map((folder) => (
              <LinkedFolderRow
                key={folder.id}
                folder={folder}
                onUnlink={() => onUnlink(folder.id)}
              />
            ))}
          </ul>
          <button
            onClick={onLinkFolder}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left
                       hover:bg-gray-50 transition-colors min-h-[44px] border-t border-border"
          >
            <span className="text-xs font-medium text-blue-600">+ Link a folder</span>
          </button>
        </div>
      )}
    </div>
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

  const {
    sources,
    isLoading,
    error,
    fetchSources,
    addSources,
    uploadLocalFile,
    removeSource,
    restoreSource,
    importAsChapter,
  } = useSources(projectId);

  const { connections: projectConnections, isLoading: connectionsLoading } =
    useProjectSourceConnections(projectId);

  const {
    linkedFolders,
    isLoading: foldersLoading,
    isSyncing,
    linkFolder,
    unlinkFolder,
  } = useLinkedFolders(projectId);

  // Search
  const {
    query: searchQuery,
    results: searchResults,
    isSearching,
    isActive: searchIsActive,
    handleQueryChange,
    clearSearch,
  } = useSourceSearch(projectId);

  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Remove confirmation state — one at a time via shared state
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

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
      const result = await importAsChapter(sourceId);
      if (result) {
        showToast(`Imported "${result.title}" as new chapter`);
      }
    },
    [importAsChapter, showToast],
  );

  const handleRemoveSource = useCallback(
    async (sourceId: string) => {
      setConfirmRemoveId(null);
      await removeSource(sourceId);
      showToast("Source removed", 5000, {
        label: "Undo",
        onClick: () => {
          restoreSource(sourceId);
        },
      });
    },
    [removeSource, restoreSource, showToast],
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

  // --- Flat Source List View ---

  const dataReady = !error && !(isLoading && sources.length === 0);
  const showEmptyState = dataReady && sources.length === 0 && !isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Search header — always visible when sources exist or loading is done */}
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
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

          {/* [+] button — hidden when search is focused (iPad keyboard) */}
          {!searchFocused && (
            <button
              onClick={() => startAddDocument()}
              className="h-8 w-8 flex items-center justify-center rounded-md bg-blue-600 text-white
                         hover:bg-blue-700 transition-colors shrink-0"
              aria-label="Add document"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto min-h-0 flex flex-col">
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

        {/* Empty state CTA */}
        {showEmptyState && (
          <EmptyStateCTA
            onLinkFolder={() => startLinkFolder()}
            onBrowseDrive={() => startAddDocument()}
            onUpload={() => startAddDocument()}
          />
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
                onRemove={() => handleRemoveSource(source.id)}
                confirmingRemove={confirmRemoveId === source.id}
                onStartRemove={() =>
                  setConfirmRemoveId(confirmRemoveId === source.id ? null : source.id)
                }
                onCancelRemove={() => setConfirmRemoveId(null)}
              />
            ))}
          </ul>
        )}

        {/* Collapsible folders footer — pushed to bottom */}
        {dataReady && !searchIsActive && !showEmptyState && (
          <FoldersFooter
            linkedFolders={linkedFolders}
            isSyncing={isSyncing}
            onUnlink={handleUnlinkFolder}
            onLinkFolder={() => startLinkFolder()}
          />
        )}
      </div>
    </div>
  );
}
