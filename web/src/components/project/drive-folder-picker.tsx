"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useDriveFiles, type DriveFile } from "@/hooks/use-drive-files";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface DriveFolderPickerProps {
  connectionId: string;
  initialFolderId?: string;
  initialFolderName?: string;
  onSelect: (folderId: string, folderPath: string) => void;
  onCancel: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

/**
 * DriveFolderPicker — folder-only browser for selecting an export destination.
 *
 * Reuses the useDriveFiles hook with foldersOnly=true to show only folders.
 * Breadcrumb navigation (same pattern as DriveBrowser).
 * "Create New Folder" and "Select This Folder" actions.
 */
export function DriveFolderPicker({
  connectionId,
  initialFolderId,
  initialFolderName,
  onSelect,
  onCancel,
}: DriveFolderPickerProps) {
  const { getToken } = useAuth();
  const [currentFolder, setCurrentFolder] = useState(initialFolderId || "root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(() => {
    const crumbs: BreadcrumbItem[] = [{ id: "root", name: "My Drive" }];
    if (initialFolderId && initialFolderId !== "root" && initialFolderName) {
      crumbs.push({ id: initialFolderId, name: initialFolderName });
    }
    return crumbs;
  });
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);

  const { files, isLoading, error, hasMore, loadMore } = useDriveFiles({
    connectionId,
    folderId: currentFolder,
    foldersOnly: true,
  });

  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setShowCreateInput(false);
  }, []);

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setCurrentFolder(breadcrumbs[index].id);
      setShowCreateInput(false);
    },
    [breadcrumbs],
  );

  const handleSelectFolder = useCallback(() => {
    const path = breadcrumbs.map((b) => b.name).join(" / ");
    onSelect(currentFolder, path);
  }, [currentFolder, breadcrumbs, onSelect]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    setIsCreating(true);
    try {
      const token = await getToken();
      if (!token) return;

      // Use the Drive API to create a folder — POST to browse endpoint won't work,
      // we need to create via the Drive files API. Use the existing folder creation
      // through a simple fetch to our API.
      const response = await fetch(`${API_URL}/drive/connection/${connectionId}/folders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentFolderId: currentFolder,
        }),
      });

      if (response.ok) {
        const folder = (await response.json()) as { id: string; name: string };
        navigateToFolder(folder.id, folder.name);
        setNewFolderName("");
        setShowCreateInput(false);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsCreating(false);
    }
  }, [newFolderName, currentFolder, connectionId, getToken, navigateToFolder]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
        <button
          onClick={onCancel}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          aria-label="Back"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-900">Choose Folder</span>
      </div>

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

      {/* Folder list */}
      <div className="flex-1 overflow-auto min-h-0">
        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">Loading...</p>
        ) : error ? (
          <p className="px-3 py-6 text-center text-sm text-red-600">{error}</p>
        ) : files.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-400">No folders found</p>
        ) : (
          <>
            {files.map((folder: DriveFile) => (
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

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="w-full px-3 py-3 text-xs text-blue-600 hover:bg-gray-50
                           min-h-[44px] border-t border-gray-100"
              >
                Load more
              </button>
            )}
          </>
        )}

        {/* Create new folder */}
        {!isLoading && !error && (
          <div className="px-3 py-2 border-t border-gray-100">
            {showCreateInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") setShowCreateInput(false);
                  }}
                  placeholder="Folder name"
                  className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5
                             focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
                  autoFocus
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={isCreating || !newFolderName.trim()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700
                             disabled:opacity-50 min-h-[36px] px-2"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateInput(false);
                    setNewFolderName("");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 min-h-[36px] px-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateInput(true)}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700
                           min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create New Folder
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-3 py-2 border-t border-gray-200 shrink-0">
        <button
          onClick={handleSelectFolder}
          className="w-full h-10 text-sm font-medium text-white bg-blue-600 rounded-lg
                     hover:bg-blue-700 min-h-[44px] flex items-center justify-center"
        >
          Select This Folder
        </button>
      </div>
    </div>
  );
}
