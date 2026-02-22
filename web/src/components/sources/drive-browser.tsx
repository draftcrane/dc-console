"use client";

import { useState, useCallback } from "react";
import { useDriveFiles, type DriveFile } from "@/hooks/use-drive-files";
import { useLinkedFolders } from "@/hooks/use-linked-folders";
import { useSourcesContext } from "@/contexts/sources-context";

interface DriveBrowserProps {
  connectionId: string;
  onClose: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SUPPORTED_MIMES = new Set([
  "application/vnd.google-apps.document",
  "text/plain",
  "text/markdown",
  "application/pdf",
]);

/**
 * Drive folder/file navigation for adding sources.
 * Single-level flat list per folder. Breadcrumb nav.
 */
export function DriveBrowser({ connectionId, onClose }: DriveBrowserProps) {
  const { addDriveSources, projectId } = useSourcesContext();
  const [currentFolder, setCurrentFolder] = useState("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, DriveFile>>(new Map());
  const [isAdding, setIsAdding] = useState(false);

  const { files, isLoading, error } = useDriveFiles({ connectionId, folderId: currentFolder });
  const { linkFolder } = useLinkedFolders(projectId);

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
      const files = Array.from(selectedFiles.values()).map((f) => ({
        driveFileId: f.id,
        title: f.name,
        mimeType: f.mimeType,
      }));
      await addDriveSources(files, connectionId);
      setSelectedFiles(new Map());
      onClose();
    } catch (err) {
      console.error("Failed to add sources:", err);
    } finally {
      setIsAdding(false);
    }
  }, [selectedFiles, addDriveSources, connectionId, onClose]);

  const handleLinkFolder = useCallback(async () => {
    const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || "Drive";
    await linkFolder({
      driveConnectionId: connectionId,
      driveFolderId: currentFolder,
      folderName: currentFolderName,
    });
  }, [linkFolder, connectionId, currentFolder, breadcrumbs]);

  // Separate folders from files
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const documents = files.filter(
    (f) => f.mimeType !== FOLDER_MIME && SUPPORTED_MIMES.has(f.mimeType),
  );

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Breadcrumb */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
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
      <div className="max-h-[300px] overflow-auto">
        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">Loading...</p>
        ) : error ? (
          <p className="px-3 py-6 text-center text-sm text-red-500">{error}</p>
        ) : folders.length === 0 && documents.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-400">No files found</p>
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
          </>
        )}
      </div>

      {/* Action bar */}
      <div className="px-3 py-2 border-t border-gray-200 flex items-center gap-2">
        {currentFolder !== "root" && (
          <button
            onClick={handleLinkFolder}
            className="text-xs text-blue-600 hover:text-blue-700 min-h-[44px] flex items-center"
            title="Auto-sync this folder"
          >
            Link folder
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="h-8 px-3 text-xs text-gray-600 border border-gray-200 rounded-lg
                     hover:bg-gray-50 min-h-[44px] flex items-center"
        >
          Cancel
        </button>
        <button
          onClick={handleAddSelected}
          disabled={selectedFiles.size === 0 || isAdding}
          className="h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg
                     hover:bg-blue-700 disabled:opacity-50 min-h-[44px] flex items-center"
        >
          {isAdding
            ? "Adding..."
            : `Add ${selectedFiles.size > 0 ? selectedFiles.size : ""} Selected`}
        </button>
      </div>
    </div>
  );
}
