"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import { useSources, type SourceMaterial } from "@/hooks/use-sources";
import { useLinkedFolders, type LinkFolderInput } from "@/hooks/use-linked-folders";
import { useProjectSourceConnections } from "@/hooks/use-project-source-connections";
import { useToast } from "@/components/toast";
import { SourceCard } from "@/components/research/source-card";
import { SourceAddFlow } from "@/components/research/source-add-flow";
import {
  getSourceBadge,
  abbreviateEmail,
  relativeTime,
} from "@/components/research/source-helpers";

// === Types ===

type SheetView = "list" | "add-documents" | "link-folder";

interface SourceManagerSheetProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
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

// === Three-Dot Menu Button ===

function ThreeDotMenuButton({
  source,
  onStartRemove,
}: {
  source: SourceMaterial;
  onStartRemove: () => void;
}) {
  const isError = source.status === "error";
  const isArchived = source.status === "archived";

  if (isError || isArchived) return null;

  return (
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
  );
}

// === Remove Confirmation Row ===

function RemoveConfirmation({
  source,
  onRemove,
}: {
  source: SourceMaterial;
  onRemove: () => void;
}) {
  const isError = source.status === "error";
  const isArchived = source.status === "archived";

  // Error/archived sources: inline remove button (no confirmation)
  if (isError || isArchived) {
    return (
      <div className="flex items-center gap-2 px-4 pb-2 ml-12">
        <button
          onClick={onRemove}
          className="h-8 px-2.5 text-xs font-medium text-red-500 rounded-md hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      </div>
    );
  }

  return null;
}

// === Source Manager Sheet ===

/**
 * SourceManagerSheet — Right-slide management surface for source library.
 *
 * Set-and-forget management: add, remove, link folders, unlink folders.
 * Accessed from Settings gear menu → "Manage Sources".
 * Uses the same slide-over pattern as AccountsSheet.
 */
export function SourceManagerSheet({ isOpen, projectId, onClose }: SourceManagerSheetProps) {
  const { showToast } = useToast();

  // Sheet-local view state — reset by handleClose (not by effect) to avoid lint warning
  const [view, setView] = useState<SheetView>("list");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Reset state when sheet closes via onClose callback
  const handleClose = useCallback(() => {
    setView("list");
    setConfirmRemoveId(null);
    onClose();
  }, [onClose]);

  // --- Hooks ---

  const {
    sources,
    isLoading,
    error,
    fetchSources,
    addSources,
    uploadLocalFile,
    removeSource,
    restoreSource,
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

  // Fetch sources when sheet opens
  useEffect(() => {
    if (isOpen) {
      fetchSources();
    }
  }, [isOpen, fetchSources]);

  // --- Derived data ---

  const emailByConnectionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const conn of projectConnections) {
      map.set(conn.driveConnectionId, conn.email);
    }
    return map;
  }, [projectConnections]);

  const sortedSources = useMemo(
    () =>
      [...sources].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [sources],
  );

  const existingDriveFileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const source of sources) {
      if (source.driveFileId) {
        ids.add(source.driveFileId);
      }
    }
    return ids;
  }, [sources]);

  const linkedDriveAccounts = useMemo(
    () =>
      projectConnections.map((c) => ({
        id: c.driveConnectionId,
        email: c.email,
        connectedAt: c.connectedAt,
      })),
    [projectConnections],
  );

  // --- Handlers ---

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

  const handleUnlinkFolder = useCallback(
    async (linkedFolderId: string) => {
      await unlinkFolder(linkedFolderId);
    },
    [unlinkFolder],
  );

  const handleUploadLocal = useCallback(
    async (file: File) => {
      await uploadLocalFile(file);
      setView("list");
    },
    [uploadLocalFile],
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
      setView("list");
    },
    [addSources, showToast],
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
      setView("list");
    },
    [linkFolder, showToast, fetchSources],
  );

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  // --- Add Flow Views ---

  if (view === "add-documents" || view === "link-folder") {
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20 z-50" onClick={handleClose} aria-hidden="true" />

        {/* Panel */}
        <div
          className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col"
          role="dialog"
          aria-label="Source Manager"
        >
          <SourceAddFlow
            mode={view === "link-folder" ? "link-folder" : "add-documents"}
            driveAccounts={linkedDriveAccounts}
            existingDriveFileIds={existingDriveFileIds}
            onBack={() => setView("list")}
            onAddDriveFiles={handleAddDriveFiles}
            onUploadLocal={handleUploadLocal}
            onLinkFolder={handleLinkFolder}
          />
        </div>
      </>
    );
  }

  // --- List View ---

  const dataReady = !error && !(isLoading && sources.length === 0);
  const showEmptyState =
    dataReady && sources.length === 0 && linkedFolders.length === 0 && !isLoading;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-50" onClick={handleClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col"
        role="dialog"
        aria-label="Source Manager"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Source Manager</h2>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

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

          {/* Empty state CTA */}
          {showEmptyState && (
            <EmptyStateCTA
              onLinkFolder={() => setView("link-folder")}
              onBrowseDrive={() => setView("add-documents")}
              onUpload={() => setView("add-documents")}
            />
          )}

          {/* Linked folders section */}
          {dataReady && linkedFolders.length > 0 && (
            <div className="border-b border-gray-200">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Linked Folders
                </span>
                {isSyncing && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
                    title="Syncing folders..."
                    aria-label="Syncing folders"
                  />
                )}
              </div>
              <ul className="divide-y divide-border" role="list" aria-label="Linked folders">
                {linkedFolders.map((folder) => (
                  <LinkedFolderRow
                    key={folder.id}
                    folder={folder}
                    onUnlink={() => handleUnlinkFolder(folder.id)}
                  />
                ))}
              </ul>
              <button
                onClick={() => setView("link-folder")}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left
                           hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                <span className="text-xs font-medium text-blue-600">+ Link a folder</span>
              </button>
            </div>
          )}

          {/* Documents section */}
          {dataReady && sortedSources.length > 0 && (
            <div>
              <div className="px-4 py-2.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Documents
                </span>
              </div>
              <ul className="divide-y divide-border" role="list" aria-label="Source documents">
                {sortedSources.map((source) => (
                  <div key={source.id}>
                    <SourceCard
                      source={source}
                      sourceBadge={getSourceBadge(source, emailByConnectionId)}
                      onTap={() => {
                        /* no-op in management view — no detail navigation */
                      }}
                      actionSlot={
                        <ThreeDotMenuButton
                          source={source}
                          onStartRemove={() =>
                            setConfirmRemoveId(confirmRemoveId === source.id ? null : source.id)
                          }
                        />
                      }
                    />
                    {/* Inline remove confirmation */}
                    {confirmRemoveId === source.id &&
                      source.status !== "error" &&
                      source.status !== "archived" && (
                        <div className="flex items-center gap-2 py-1.5 px-4 bg-red-50 ml-4 mr-4 mb-2 rounded">
                          <span className="text-xs text-red-700">Remove from project?</span>
                          <button
                            onClick={() => handleRemoveSource(source.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-700
                                       min-h-[32px] flex items-center transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="text-xs font-medium text-gray-600 hover:text-gray-700
                                       min-h-[32px] flex items-center transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    {/* Error/archived quick remove */}
                    <RemoveConfirmation
                      source={source}
                      onRemove={() => handleRemoveSource(source.id)}
                    />
                  </div>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer: Add Documents button (always visible when not empty) */}
        {dataReady && !showEmptyState && (
          <div className="px-4 py-3 border-t border-gray-200 shrink-0">
            <button
              onClick={() => setView("add-documents")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                         text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100
                         rounded-lg transition-colors min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Documents
            </button>
          </div>
        )}
      </div>
    </>
  );
}
