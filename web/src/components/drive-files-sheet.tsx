"use client";

import { useEffect, useRef, useCallback } from "react";
import type { DriveFileItem } from "@/hooks/use-drive-files";

interface DriveFilesSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** List of files to display */
  files: DriveFileItem[];
  /** Whether files are currently loading */
  isLoading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Called to refresh the file list */
  onRefresh: () => void;
  /** Optional: Called when the user clicks the "Connect Project to Google Drive" button */
  onConnectDrive?: () => void;
  /** Optional: Called when the user adds source docs/folders from Drive */
  onAddSources?: () => void;
  /** Optional: Called to open the Sources panel */
  onViewSources?: () => void;
  /** Whether current project is already connected to a Drive folder */
  isProjectConnected?: boolean;
}

/**
 * Categorize a Drive file as "chapter", "export", or "folder" based on mime type and name.
 */
function getFileCategory(file: DriveFileItem): "chapter" | "export" | "folder" | "other" {
  if (file.mimeType === "application/vnd.google-apps.folder") {
    return "folder";
  }
  if (
    file.mimeType === "application/pdf" ||
    file.mimeType === "application/epub+zip" ||
    file.name.endsWith(".pdf") ||
    file.name.endsWith(".epub")
  ) {
    return "export";
  }
  if (file.mimeType === "text/html" || file.name.endsWith(".html") || file.name.endsWith(".htm")) {
    return "chapter";
  }
  return "other";
}

/**
 * Format a date string for display. Returns a relative or short date.
 */
function formatDate(dateStr?: string): string {
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

/**
 * DriveFilesSheet - Slide-over panel showing DraftCrane-created files in the Book Folder.
 *
 * Per PRD Section 8 (US-007):
 * - Read-only listing of DraftCrane-created files
 * - Shows chapter HTML files and export files
 * - Under drive.file scope, only DraftCrane-created files are visible
 * - Accessible from the editor toolbar
 *
 * iPad-first: 44pt touch targets, full-height slide-over panel.
 */
export function DriveFilesSheet({
  isOpen,
  files,
  isLoading,
  error,
  onClose,
  onRefresh,
  onConnectDrive,
  onAddSources,
  onViewSources,
  isProjectConnected = false,
}: DriveFilesSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Trap focus inside the panel when open
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Drive files"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
            </svg>
            <h2 className="text-base font-semibold text-gray-900">Drive Files</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100
                         transition-colors disabled:opacity-50"
              aria-label="Refresh file list"
            >
              <svg
                className={`w-4 h-4 text-gray-500 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100
                         transition-colors"
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading && files.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-sm text-gray-500">
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
                Loading files...
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!isLoading && !error && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <svg
                className="w-12 h-12 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <p className="text-sm text-gray-500">No files yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Files will appear here as you save chapters and export your book.
              </p>
              {!isProjectConnected && onConnectDrive && (
                <button
                  type="button"
                  onClick={onConnectDrive}
                  className="mt-4 inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <svg
                    className="-ml-1 mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14H9v-3H8v-2h1V8h2v3h1v2h-1v3zm6-5h-3v-2h3V9h-3V7h-2v10h2v-3h1v-2h-1z" />
                  </svg>
                  Connect Project to Google Drive
                </button>
              )}
              {isProjectConnected && onAddSources && (
                <>
                  <button
                    type="button"
                    onClick={onAddSources}
                    className="mt-4 inline-flex items-center rounded-md border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    <svg
                      className="-ml-1 mr-2 h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Source Documents
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    Select Google Docs or folders to link as sources for this project.
                  </p>
                  {onViewSources && (
                    <button
                      type="button"
                      onClick={onViewSources}
                      className="mt-2 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2"
                    >
                      Manage Sources
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {files.length > 0 && (
            <ul className="divide-y divide-gray-100" role="list">
              {files.map((file) => (
                <FileRow key={file.id} file={file} />
              ))}
            </ul>
          )}
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <p className="text-xs text-gray-400">Only files created by DraftCrane are shown.</p>
        </div>
      </div>
    </div>
  );
}

/** Individual file row in the list */
function FileRow({ file }: { file: DriveFileItem }) {
  const category = getFileCategory(file);

  return (
    <li className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
      <FileIcon category={category} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400 capitalize">{category}</span>
          {file.modifiedTime && (
            <>
              <span className="text-xs text-gray-300" aria-hidden="true">
                --
              </span>
              <span className="text-xs text-gray-400">{formatDate(file.modifiedTime)}</span>
            </>
          )}
        </div>
      </div>
      {file.webViewLink && (
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100
                     transition-colors shrink-0"
          aria-label={`Open ${file.name} in Google Drive`}
          title="Open in Google Drive"
        >
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
    </li>
  );
}

/** Icon for a file based on its category */
function FileIcon({ category }: { category: "chapter" | "export" | "folder" | "other" }) {
  if (category === "folder") {
    return (
      <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-blue-50 shrink-0">
        <svg
          className="w-4.5 h-4.5 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </div>
    );
  }

  if (category === "export") {
    return (
      <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-purple-50 shrink-0">
        <svg
          className="w-4.5 h-4.5 text-purple-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>
    );
  }

  if (category === "chapter") {
    return (
      <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-green-50 shrink-0">
        <svg
          className="w-4.5 h-4.5 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
    );
  }

  // "other" category
  return (
    <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 shrink-0">
      <svg
        className="w-4.5 h-4.5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

export default DriveFilesSheet;
