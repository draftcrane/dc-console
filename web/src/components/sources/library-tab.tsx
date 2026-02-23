"use client";

import { useState, useCallback, useRef } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { ProjectSourceList } from "./project-source-list";
import { DriveBrowser } from "./drive-browser";
import { SourcePicker } from "./source-picker";
import { SourcesSection } from "./sources-section";
import { EmptyState } from "./empty-state";
import type { DriveAccount } from "@/hooks/use-drive-accounts";

type ViewMode = "list" | "picker" | "browse";

/**
 * Library tab — three-mode redesign.
 *
 * List mode (default): ProjectSourceList + "Add Documents" button + "Your Sources" section
 * Picker mode: SourcePicker fills the panel ("Add documents from")
 * Browse mode: Full-height DriveBrowser fills the panel content area
 *
 * Vocabulary: Source = provider, Folder = directory, Document = file.
 */
export function LibraryTab() {
  const {
    sources,
    isLoadingSources,
    driveConnected,
    driveAccounts,
    connectDrive,
    uploadLocalFile,
  } = useSourcesContext();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine which connection to use for the Drive browser
  const safeIndex = Math.min(selectedAccountIndex, Math.max(driveAccounts.length - 1, 0));
  const activeAccount = driveAccounts[safeIndex] ?? null;
  const activeConnectionId = activeAccount?.id ?? null;
  const activeAccountEmail = activeAccount?.email ?? null;

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        await uploadLocalFile(file);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsUploading(false);
        setViewMode("list");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [uploadLocalFile],
  );

  const handleAddDocuments = useCallback(() => {
    // If exactly 1 source connected, skip picker and go straight to browse
    if (driveAccounts.length === 1) {
      setSelectedAccountIndex(0);
      setViewMode("browse");
    } else {
      // 0 or 2+ sources: show picker
      setViewMode("picker");
    }
  }, [driveAccounts.length]);

  const handleSelectAccount = useCallback(
    (account: DriveAccount) => {
      const index = driveAccounts.findIndex((a) => a.id === account.id);
      setSelectedAccountIndex(index >= 0 ? index : 0);
      setViewMode("browse");
    },
    [driveAccounts],
  );

  const handleConnectDrive = useCallback(() => {
    connectDrive();
  }, [connectDrive]);

  const handleUploadLocal = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Loading state
  if (isLoadingSources) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  // Hidden file input (always rendered for upload)
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".txt,.md,.pdf,.docx"
      onChange={handleUpload}
      className="hidden"
    />
  );

  // ── PICKER MODE ──
  if (viewMode === "picker") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}
        <SourcePicker
          driveAccounts={driveAccounts}
          onSelectAccount={handleSelectAccount}
          onConnectDrive={handleConnectDrive}
          onUploadLocal={handleUploadLocal}
          onCancel={() => setViewMode("list")}
        />
      </div>
    );
  }

  // ── BROWSE MODE ──
  if (viewMode === "browse" && activeConnectionId) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}

        {/* Back button + source picker for multi-account */}
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setViewMode("list")}
            className="text-xs text-gray-500 hover:text-gray-700 min-h-[32px] flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          {driveAccounts.length > 1 && (
            <>
              <div className="w-px h-4 bg-gray-200" />
              <label htmlFor="browse-account-picker" className="sr-only">
                Source
              </label>
              <select
                id="browse-account-picker"
                value={safeIndex}
                onChange={(e) => setSelectedAccountIndex(Number(e.target.value))}
                className="text-xs text-gray-700 bg-white border border-gray-200 rounded-md
                           px-2 py-1.5 min-h-[32px] max-w-[180px] truncate"
              >
                {driveAccounts.map((account, i) => (
                  <option key={account.id} value={i}>
                    {account.email}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <DriveBrowser
          connectionId={activeConnectionId}
          onClose={() => setViewMode("list")}
          onReconnect={() => connectDrive(activeAccountEmail ?? undefined)}
          rootLabel={activeAccountEmail ?? undefined}
        />
      </div>
    );
  }

  // ── LIST MODE ──

  // Empty state: no sources connected, no documents
  if (!driveConnected && sources.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}
        <EmptyState
          icon={
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          }
          message="Add documents to your library"
          description="Import from Google Drive or your device."
          action={{
            label: "Add Documents",
            onClick: handleAddDocuments,
          }}
        />
      </div>
    );
  }

  // Empty state: sources connected but no documents yet
  if (driveConnected && sources.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}
        <EmptyState
          icon={
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          }
          message="Add documents to your library"
          description="Select documents to add to this project."
          action={{
            label: "Add Documents",
            onClick: handleAddDocuments,
          }}
        />
        <SourcesSection onAddSource={() => setViewMode("picker")} />
      </div>
    );
  }

  // Normal state: documents exist
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {fileInput}

      <div className="flex-1 overflow-auto min-h-0">
        <ProjectSourceList />

        {/* Add Documents button */}
        <div className="px-3 py-2">
          <button
            onClick={handleAddDocuments}
            disabled={isUploading}
            className="h-9 px-3 text-xs text-blue-600 border border-blue-200 rounded-lg
                       hover:bg-blue-50 transition-colors min-h-[44px] flex items-center gap-1.5
                       disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {isUploading ? "Uploading..." : "Add Documents"}
          </button>
        </div>
      </div>

      {/* Your Sources section at bottom */}
      <SourcesSection onAddSource={() => setViewMode("picker")} />
    </div>
  );
}
