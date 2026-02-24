"use client";

import { useState, useCallback } from "react";
import { useDriveFiles, type DriveFile } from "@/hooks/use-drive-files";

interface DriveBrowserProps {
  connectionId: string;
  onReconnect?: () => void;
  rootLabel?: string;
  accountEmail?: string;
  onDocumentTap: (file: DriveFile) => void;
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
 * DriveBrowser — pure folder/file browser. No selection, no linking.
 *
 * Folder tap → navigate into folder.
 * Document tap → calls onDocumentTap (parent handles peek/preview).
 */
export function DriveBrowser({
  connectionId,
  onReconnect,
  rootLabel,
  onDocumentTap,
}: DriveBrowserProps) {
  const [currentFolder, setCurrentFolder] = useState("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: rootLabel || "My Drive" },
  ]);

  const { files, isLoading, error, hasMore, loadMore } = useDriveFiles({
    connectionId,
    folderId: currentFolder,
  });

  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
  }, []);

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setCurrentFolder(breadcrumbs[index].id);
    },
    [breadcrumbs],
  );

  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const documents = files.filter(
    (f) => f.mimeType !== FOLDER_MIME && SUPPORTED_MIMES.has(f.mimeType),
  );
  const unsupportedFiles = files.filter(
    (f) => f.mimeType !== FOLDER_MIME && !SUPPORTED_MIMES.has(f.mimeType),
  );

  const isAtRoot = currentFolder === "root";

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
      {/* Breadcrumbs */}
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

      {/* File list */}
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
              <button
                key={folder.id}
                onClick={() => navigateToFolder(folder.id, folder.name)}
                className="flex items-center gap-2 w-full px-3 min-h-[44px] border-b border-gray-50
                           hover:bg-gray-50 cursor-pointer"
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
            ))}

            {/* Documents */}
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onDocumentTap(doc)}
                className="flex items-center gap-2 w-full px-3 min-h-[44px] border-b border-gray-50
                           hover:bg-gray-50 cursor-pointer"
              >
                <svg
                  className="w-5 h-5 text-blue-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-sm text-gray-900 truncate flex-1 text-left">{doc.name}</span>
              </button>
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
    </div>
  );
}
