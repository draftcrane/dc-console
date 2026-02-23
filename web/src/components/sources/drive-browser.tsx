"use client";

import { useState, useCallback } from "react";
import { useDriveFiles, type DriveFile } from "@/hooks/use-drive-files";
import { useLinkFolder } from "@/hooks/use-linked-folders";
import { useSourcesContext } from "@/contexts/sources-context";

interface DriveBrowserProps {
  connectionId: string;
  onClose: () => void;
  /** Called when the user wants to reconnect (re-authorize) the Drive account. */
  onReconnect?: () => void;
  /** Label for the root breadcrumb (defaults to account email or "My Drive"). */
  rootLabel?: string;
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
 * DriveBrowser — full-height folder/file navigation for adding documents.
 *
 * Fills the panel content area via flex layout. Breadcrumbs stick to top,
 * action bar sticks to bottom, file list fills everything in between.
 *
 * Action bar is contextual and mutually exclusive:
 * - Documents selected: Cancel + "Add N Documents"
 * - In subfolder, nothing selected: Cancel + "Link This Folder"
 * - At root, nothing selected: Cancel only
 */
export function DriveBrowser({ connectionId, onClose, onReconnect, rootLabel }: DriveBrowserProps) {
  const { addDriveSources, projectId, refetchSources } = useSourcesContext();
  const [currentFolder, setCurrentFolder] = useState("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: rootLabel || "My Drive" },
  ]);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, DriveFile>>(new Map());
  const [isAdding, setIsAdding] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const { files, isLoading, error, hasMore, loadMore } = useDriveFiles({
    connectionId,
    folderId: currentFolder,
  });
  const { linkFolder } = useLinkFolder(projectId);

  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setSelectedFiles(new Map());
  }, []);

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setCurrentFolder(breadcrumbs[index].id);
      setSelectedFiles(new Map());
    },
    [breadcrumbs],
  );

  const toggleFile = useCallback((file: DriveFile) => {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.set(file.id, file);
      }
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    setIsAdding(true);
    try {
      const filesToAdd = Array.from(selectedFiles.values()).map((f) => ({
        driveFileId: f.id,
        title: f.name,
        mimeType: f.mimeType,
      }));
      await addDriveSources(filesToAdd, connectionId);
      setSelectedFiles(new Map());
      onClose();
    } catch (err) {
      console.error("Failed to add documents:", err);
    } finally {
      setIsAdding(false);
    }
  }, [selectedFiles, addDriveSources, connectionId, onClose]);

  const handleLinkFolder = useCallback(async () => {
    const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || "Drive";
    setIsLinking(true);
    try {
      await linkFolder({
        driveConnectionId: connectionId,
        driveFolderId: currentFolder,
        folderName: currentFolderName,
      });
      await refetchSources();
      onClose();
    } catch (err) {
      console.error("Failed to link folder:", err);
    } finally {
      setIsLinking(false);
    }
  }, [linkFolder, connectionId, currentFolder, breadcrumbs, refetchSources, onClose]);

  // Separate folders from supported documents
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const documents = files.filter(
    (f) => f.mimeType !== FOLDER_MIME && SUPPORTED_MIMES.has(f.mimeType),
  );
  // Check for unsupported files (non-folder, non-supported) to differentiate empty states
  const unsupportedFiles = files.filter(
    (f) => f.mimeType !== FOLDER_MIME && !SUPPORTED_MIMES.has(f.mimeType),
  );

  const isAtRoot = currentFolder === "root";
  const isInSubfolder = !isAtRoot;
  const hasSelection = selectedFiles.size > 0;

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
    // In subfolder
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
            {/* Folders */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50
                           min-h-[44px] border-b border-gray-50"
              >
                <svg
                  className="w-5 h-5 text-yellow-500 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                </svg>
                <span className="text-sm text-gray-900 truncate">{folder.name}</span>
                <svg
                  className="w-4 h-4 text-gray-400 shrink-0 ml-auto"
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
              </div>
            ))}

            {/* Documents */}
            {documents.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50
                           min-h-[44px] border-b border-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(doc.id)}
                  onChange={() => toggleFile(doc)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-900 truncate flex-1">{doc.name}</span>
              </label>
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

      {/* Action bar (sticky footer, contextual, mutually exclusive) */}
      <div className="px-3 py-2 border-t border-gray-200 flex items-center gap-2 shrink-0">
        <button
          onClick={onClose}
          className="h-8 px-3 text-xs text-gray-600 border border-gray-200 rounded-lg
                     hover:bg-gray-50 min-h-[44px] flex items-center"
        >
          Cancel
        </button>

        <div className="flex-1" />

        {/* Documents selected: "Add N Documents" */}
        {hasSelection && (
          <button
            onClick={handleAddSelected}
            disabled={isAdding}
            className="h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 min-h-[44px] flex items-center"
          >
            {isAdding
              ? "Adding..."
              : `Add ${selectedFiles.size} Document${selectedFiles.size !== 1 ? "s" : ""}`}
          </button>
        )}

        {/* In subfolder, nothing selected: "Link This Folder" */}
        {!hasSelection && isInSubfolder && folders.length + documents.length > 0 && (
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={handleLinkFolder}
              disabled={isLinking}
              className="h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 min-h-[44px] flex items-center"
            >
              {isLinking ? "Linking..." : "Link This Folder"}
            </button>
            <span className="text-[10px] text-gray-400 leading-tight max-w-[180px] text-right">
              All documents in this folder will be added and kept in sync.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
