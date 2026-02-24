"use client";

import { useState, useCallback, useMemo } from "react";
import { useDriveFiles } from "@/hooks/use-drive-files";
import { useLinkFolder } from "@/hooks/use-linked-folders";
import { useSourcesContext } from "@/contexts/sources-context";
import { useSelectionState } from "@/hooks/use-selection-state";
import { TriStateCheckbox } from "./tri-state-checkbox";

interface DriveBrowserProps {
  connectionId: string;
  onClose: () => void;
  /** Called when the user wants to reconnect (re-authorize) the Drive account. */
  onReconnect?: () => void;
  /** Label for the root breadcrumb (defaults to account email or "My Drive"). */
  rootLabel?: string;
  /** Account email for the source-level row. */
  accountEmail?: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SUPPORTED_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/pdf",
]);

/**
 * DriveBrowser — full-height folder/file navigation with tri-state selection.
 *
 * Selection model: tri-state checkboxes on every row (source, folders, documents).
 * Uses an exclusion model — selecting a folder includes everything; exclusions are exceptions.
 * Selection persists across navigation (no clearing on folder enter/breadcrumb click).
 *
 * Commit logic:
 * - rootSelected → one linked folder with driveFolderId='root' + exclusions
 * - individual selectedFolders → one linked folder per folder + relevant exclusions
 * - individual selectedDocuments → addDriveSources path (no linked folder)
 */
export function DriveBrowser({
  connectionId,
  onClose,
  onReconnect,
  rootLabel,
  accountEmail,
}: DriveBrowserProps) {
  const { addDriveSources, projectId, refetchSources } = useSourcesContext();
  const [currentFolder, setCurrentFolder] = useState("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: rootLabel || "My Drive" },
  ]);
  const [isCommitting, setIsCommitting] = useState(false);

  const { files, isLoading, error, hasMore, loadMore } = useDriveFiles({
    connectionId,
    folderId: currentFolder,
  });
  const { linkFolder } = useLinkFolder(projectId);
  const selection = useSelectionState();

  // parentChain: the breadcrumb IDs (excluding the first 'root' since that's the source level)
  const parentChain = useMemo(() => breadcrumbs.slice(1).map((b) => b.id), [breadcrumbs]);

  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    // No selection clearing — selections persist across navigation
  }, []);

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setCurrentFolder(breadcrumbs[index].id);
      // No selection clearing
    },
    [breadcrumbs],
  );

  /** Unified commit handler — processes root, folder, and document selections. */
  const handleCommitSelection = useCallback(async () => {
    const { rootSelected, selectedFolders, selectedDocuments, exclusions } = selection.state;
    setIsCommitting(true);

    try {
      // Build exclusions array for API
      const buildExclusions = () =>
        Array.from(exclusions.entries()).map(([driveItemId, { name, type }]) => ({
          driveItemId,
          itemType: type,
          itemName: name,
        }));

      if (rootSelected) {
        // Root selected → one linked folder with driveFolderId='root'
        await linkFolder({
          driveConnectionId: connectionId,
          driveFolderId: "root",
          folderName: accountEmail || rootLabel || "My Drive",
          exclusions: exclusions.size > 0 ? buildExclusions() : undefined,
        });
        await refetchSources();
      } else {
        // Link individual folders
        for (const [folderId, folderName] of selectedFolders) {
          // Find exclusions that belong to this folder's subtree
          // For now, include all exclusions — the backend filters by linked_folder_id
          const folderExclusions = buildExclusions();
          await linkFolder({
            driveConnectionId: connectionId,
            driveFolderId: folderId,
            folderName,
            exclusions: folderExclusions.length > 0 ? folderExclusions : undefined,
          });
        }

        // Add individual documents (not covered by linked folders)
        if (selectedDocuments.size > 0) {
          const filesToAdd = Array.from(selectedDocuments.values()).map((f) => ({
            driveFileId: f.id,
            title: f.name,
            mimeType: f.mimeType,
          }));
          await addDriveSources(filesToAdd, connectionId);
        }

        if (selectedFolders.size > 0) {
          await refetchSources();
        }
      }

      onClose();
    } catch (err) {
      console.error("Failed to commit selection:", err);
    } finally {
      setIsCommitting(false);
    }
  }, [
    selection.state,
    linkFolder,
    connectionId,
    accountEmail,
    rootLabel,
    addDriveSources,
    refetchSources,
    onClose,
  ]);

  // Separate folders from supported documents
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const documents = files.filter(
    (f) => f.mimeType !== FOLDER_MIME && SUPPORTED_MIMES.has(f.mimeType),
  );
  const unsupportedFiles = files.filter(
    (f) => f.mimeType !== FOLDER_MIME && !SUPPORTED_MIMES.has(f.mimeType),
  );

  const isAtRoot = currentFolder === "root";

  // Context-aware empty state message
  const getEmptyMessage = (): { title: string; detail?: string } => {
    const hasUnsupported = unsupportedFiles.length > 0;
    if (isAtRoot) {
      if (hasUnsupported) {
        return {
          title: "No supported documents found",
          detail: "Supported: Google Docs, Word, PDF, and text files.",
        };
      }
      return { title: "No documents found" };
    }
    if (hasUnsupported) {
      return {
        title: "No supported documents in this folder",
        detail: "Supported: Google Docs, Word, PDF, and text files.",
      };
    }
    return { title: "This folder is empty" };
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Breadcrumbs (sticky header) */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto shrink-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-gray-300 text-xs">/</span>}
            <button
              onClick={() => navigateToBreadcrumb(i)}
              className={`text-xs min-h-[32px] px-1 rounded transition-colors ${
                i === breadcrumbs.length - 1
                  ? "font-medium text-gray-900"
                  : "text-blue-600 hover:text-blue-700"
              }`}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* File list (fills available space) */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Source-level row (only at root) */}
        {isAtRoot && (
          <div className="flex items-center border-b border-gray-100 bg-gray-50/50">
            <TriStateCheckbox
              state={selection.getSourceCheckboxState()}
              onChange={selection.toggleRoot}
              label={`Select all from ${accountEmail || "this source"}`}
            />
            <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
              <svg
                className="w-5 h-5 text-blue-500 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
              </svg>
              <span className="text-sm text-gray-900 truncate">
                {accountEmail || "Google Drive"}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">Loading...</p>
        ) : error ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  const f = currentFolder;
                  setCurrentFolder("");
                  requestAnimationFrame(() => setCurrentFolder(f));
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline min-h-[36px]"
              >
                Retry
              </button>
              {onReconnect && (
                <button
                  onClick={onReconnect}
                  className="text-xs text-blue-600 hover:text-blue-700 underline min-h-[36px]"
                >
                  Reconnect account
                </button>
              )}
            </div>
          </div>
        ) : folders.length === 0 && documents.length === 0 ? (
          (() => {
            const msg = getEmptyMessage();
            return (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-gray-400">{msg.title}</p>
                {msg.detail && <p className="text-xs text-gray-400 mt-1">{msg.detail}</p>}
              </div>
            );
          })()
        ) : (
          <>
            {/* Folders — two-zone layout: checkbox (left) + navigate button (right) */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center border-b border-gray-50 hover:bg-gray-50"
              >
                <TriStateCheckbox
                  state={selection.getCheckboxState(folder.id, "folder", parentChain)}
                  onChange={() => selection.toggleFolder(folder.id, folder.name, parentChain)}
                  label={`Select ${folder.name}`}
                />
                <button
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                  className="flex items-center gap-2 flex-1 min-w-0 pr-3 min-h-[44px] cursor-pointer"
                >
                  <svg
                    className="w-5 h-5 text-yellow-500 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                  </svg>
                  <span className="text-sm text-gray-900 truncate flex-1 text-left">
                    {folder.name}
                  </span>
                  <svg
                    className="w-4 h-4 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            ))}

            {/* Documents */}
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center border-b border-gray-50 hover:bg-gray-50"
              >
                <TriStateCheckbox
                  state={selection.getCheckboxState(doc.id, "document", parentChain)}
                  onChange={() => selection.toggleDocument(doc, parentChain)}
                  label={`Select ${doc.name}`}
                />
                <span className="text-sm text-gray-900 truncate flex-1 pr-3">{doc.name}</span>
              </div>
            ))}

            {/* Pagination */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="w-full px-3 py-3 text-xs text-blue-600 hover:bg-gray-50
                           min-h-[44px] border-t border-gray-100"
              >
                {isLoading ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Action bar (sticky footer) */}
      <div className="px-3 py-2 border-t border-gray-200 flex items-center gap-2 shrink-0">
        <button
          onClick={onClose}
          className="h-8 px-3 text-xs text-gray-600 border border-gray-200 rounded-lg
                     hover:bg-gray-50 min-h-[44px] flex items-center"
        >
          Cancel
        </button>

        <div className="flex-1" />

        {!selection.isEmpty && (
          <button
            onClick={handleCommitSelection}
            disabled={isCommitting}
            className="h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 min-h-[44px] flex items-center"
          >
            {isCommitting ? "Adding..." : selection.getButtonLabel()}
          </button>
        )}
      </div>
    </div>
  );
}
