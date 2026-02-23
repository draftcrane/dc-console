"use client";

import { useState, useCallback, useRef } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { ProjectSourceList } from "./project-source-list";
import { DriveBrowser } from "./drive-browser";
import { EmptyState } from "./empty-state";

/**
 * Library tab — Project sources (default view) + on-demand Drive browser.
 *
 * Three empty states:
 * 1. No Drive connection: "Connect Google Drive" + Connect button
 * 2. Drive connected, no sources: Drive browser expanded by default
 * 3. Sources exist: source list with "Add from Drive" button
 *
 * Multi-account: when multiple Drive accounts are connected, shows an
 * account picker so the user can choose which account to browse.
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

  const [showDriveBrowser, setShowDriveBrowser] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine which connection to use for the Drive browser
  const safeIndex = Math.min(selectedAccountIndex, Math.max(driveAccounts.length - 1, 0));
  const activeConnectionId = driveAccounts[safeIndex]?.id ?? null;
  const activeAccountEmail = driveAccounts[safeIndex]?.email ?? null;

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
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [uploadLocalFile],
  );

  // Loading state
  if (isLoadingSources) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-sm text-gray-500">Loading sources...</p>
      </div>
    );
  }

  // Empty state 1: No Drive connection
  if (!driveConnected && sources.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        }
        message="Connect Google Drive to import your research"
        description="Add source materials from your Drive to reference while writing. Your files stay in your Drive."
        action={{
          label: "Connect Drive",
          onClick: () => connectDrive(),
        }}
      />
    );
  }

  // Account picker for multi-account users
  const accountPicker =
    driveAccounts.length > 1 ? (
      <div className="flex items-center gap-2">
        <label htmlFor="drive-account-picker" className="text-xs text-gray-500 shrink-0">
          Account:
        </label>
        <select
          id="drive-account-picker"
          value={safeIndex}
          onChange={(e) => setSelectedAccountIndex(Number(e.target.value))}
          className="text-xs text-gray-700 bg-white border border-gray-200 rounded-md
                     px-2 py-1.5 min-h-[36px] max-w-[200px] truncate"
        >
          {driveAccounts.map((account, i) => (
            <option key={account.id} value={i}>
              {account.email}
            </option>
          ))}
        </select>
      </div>
    ) : activeAccountEmail ? (
      <p className="text-xs text-gray-500 truncate">Browsing {activeAccountEmail}</p>
    ) : null;

  // Empty state 2: Drive connected, no sources
  if (driveConnected && sources.length === 0 && activeConnectionId) {
    return (
      <div className="flex flex-col gap-3 px-3 pt-2">
        <p className="text-sm text-gray-600">Browse your Drive to add sources to this project.</p>
        {accountPicker}
        <DriveBrowser
          connectionId={activeConnectionId}
          onClose={() => {}}
          onReconnect={() => connectDrive(activeAccountEmail ?? undefined)}
        />
      </div>
    );
  }

  // Normal state: Sources exist
  return (
    <div className="flex flex-col gap-2">
      <ProjectSourceList />

      {/* Add from Drive / Upload buttons */}
      <div className="px-3 flex items-center gap-2 pb-2">
        {driveConnected && activeConnectionId && (
          <>
            {showDriveBrowser ? (
              <div className="w-full flex flex-col gap-2">
                {accountPicker}
                <DriveBrowser
                  connectionId={activeConnectionId}
                  onClose={() => setShowDriveBrowser(false)}
                  onReconnect={() => connectDrive(activeAccountEmail ?? undefined)}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowDriveBrowser(true)}
                className="h-9 px-3 text-xs text-blue-600 border border-blue-200 rounded-lg
                           hover:bg-blue-50 transition-colors min-h-[44px] flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add from Drive
              </button>
            )}
          </>
        )}

        {!showDriveBrowser && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-9 px-3 text-xs text-gray-600 border border-gray-200 rounded-lg
                         hover:bg-gray-50 transition-colors min-h-[44px] flex items-center gap-1.5
                         disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              {isUploading ? "Uploading..." : "Upload File"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md"
              onChange={handleUpload}
              className="hidden"
            />
          </>
        )}
      </div>
    </div>
  );
}
