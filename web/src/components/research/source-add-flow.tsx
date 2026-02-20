"use client";

import { useRef, useCallback, useState, useMemo, useEffect } from "react";
import { validateUploadFile } from "@/hooks/use-sources";
import { useDriveBrowser, type DriveBrowseItem } from "@/hooks/use-drive-browser";
import type { DriveAccount } from "@/hooks/use-drive-accounts";

/**
 * Internal sub-view state for the SourceAddFlow.
 * - "accounts": shows trust message, Drive accounts, upload from device
 * - "browsing": shows inline Drive folder browser with file selection
 */
type AddFlowView = "accounts" | "browsing";

interface SourceAddFlowProps {
  driveAccounts: DriveAccount[];
  /** Drive file IDs already in the project (for "Already added" state) */
  existingDriveFileIds: Set<string>;
  onBack: () => void;
  /** Called when Drive files have been selected and should be added as sources */
  onAddDriveFiles: (
    files: Array<{ driveFileId: string; title: string; mimeType: string }>,
    connectionId: string,
  ) => Promise<void>;
  onUploadLocal: (file: File) => Promise<void>;
  onConnectAccount: () => void;
}

/**
 * SourceAddFlow - Inline replacement view within Sources tab.
 *
 * Manages its own sub-navigation:
 * 1. Account selection view (with trust message, Drive accounts, local upload)
 * 2. Inline folder browser (when a Drive account is selected)
 *
 * Per design spec Section 5 (Flow 1) and Section 7 (SourceAddFlow):
 * - Trust message: "Your originals are never changed"
 * - Folder browser: folders navigable via tap, Google Docs selectable via checkbox
 * - "Already added" state for files already in the project
 * - "Add N Selected" sticky footer (48pt height)
 * - Back navigation at every level
 * - All touch targets minimum 44pt
 * - Checkboxes: 44x44pt tap area (visually 24x24px)
 */
export function SourceAddFlow({
  driveAccounts,
  existingDriveFileIds,
  onBack,
  onAddDriveFiles,
  onUploadLocal,
  onConnectAccount,
}: SourceAddFlowProps) {
  const [view, setView] = useState<AddFlowView>("accounts");
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    items: driveItems,
    isLoading: driveIsLoading,
    error: driveError,
    folderId: driveFolderId,
    canGoBack: driveCanGoBack,
    openRoot: driveOpenRoot,
    openFolder: driveOpenFolder,
    goBack: driveGoBack,
    refresh: driveRefresh,
    isDoc: driveIsDoc,
    isFolder: driveIsFolder,
  } = useDriveBrowser();

  // Clear selection when switching views
  useEffect(() => {
    if (view === "accounts") {
      setSelectedIds(new Set());
    }
  }, [view]);

  // Clear selection when navigating to a different folder
  useEffect(() => {
    setSelectedIds(new Set());
  }, [driveFolderId]);

  const handleSelectAccount = useCallback(
    async (connectionId: string) => {
      setActiveConnectionId(connectionId);
      setView("browsing");
      await driveOpenRoot(connectionId);
    },
    [driveOpenRoot],
  );

  const handleBackFromBrowser = useCallback(() => {
    if (driveCanGoBack) {
      driveGoBack();
    } else {
      setView("accounts");
      setActiveConnectionId(null);
    }
  }, [driveCanGoBack, driveGoBack]);

  const handleToggleSelect = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(async () => {
    if (!activeConnectionId || selectedIds.size === 0) return;

    const selectedDocs = driveItems
      .filter((item) => driveIsDoc(item) && selectedIds.has(item.id))
      .map((item) => ({
        driveFileId: item.id,
        title: item.name,
        mimeType: item.mimeType,
      }));

    if (selectedDocs.length === 0) return;

    setIsAdding(true);
    try {
      await onAddDriveFiles(selectedDocs, activeConnectionId);
    } finally {
      setIsAdding(false);
    }
  }, [activeConnectionId, selectedIds, driveItems, driveIsDoc, onAddDriveFiles]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const error = validateUploadFile(file);
      if (error) {
        setUploadError(error);
        e.target.value = "";
        return;
      }

      setUploadError(null);
      setIsUploading(true);

      try {
        await onUploadLocal(file);
      } finally {
        setIsUploading(false);
      }

      e.target.value = "";
    },
    [onUploadLocal],
  );

  // Separate folders and docs
  const folders = useMemo(
    () => driveItems.filter((item) => driveIsFolder(item)),
    [driveItems, driveIsFolder],
  );
  const docs = useMemo(
    () => driveItems.filter((item) => driveIsDoc(item)),
    [driveItems, driveIsDoc],
  );

  // Count of selectable (non-already-added) selected files
  const selectableSelectedCount = useMemo(() => {
    let count = 0;
    for (const id of selectedIds) {
      if (!existingDriveFileIds.has(id)) {
        count++;
      }
    }
    return count;
  }, [selectedIds, existingDriveFileIds]);

  if (view === "browsing") {
    return (
      <InlineDriveBrowser
        folders={folders}
        docs={docs}
        isLoading={driveIsLoading}
        error={driveError}
        canGoBack={driveCanGoBack}
        selectedIds={selectedIds}
        existingDriveFileIds={existingDriveFileIds}
        selectableSelectedCount={selectableSelectedCount}
        isAdding={isAdding}
        onBack={handleBackFromBrowser}
        onOpenFolder={driveOpenFolder}
        onToggleSelect={handleToggleSelect}
        onAddSelected={handleAddSelected}
        onRefresh={driveRefresh}
      />
    );
  }

  // Account selection view
  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="flex items-center gap-2 h-12 px-4 shrink-0 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700
                     min-h-[44px] px-1 transition-colors"
          aria-label="Back to sources"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Sources
        </button>
        <span className="text-sm font-semibold text-foreground ml-auto">Add Source</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {/* Trust message — subtle indicator, not an alert */}
        <div className="flex items-start gap-2 mb-4 px-1 py-2">
          <svg
            className="w-4 h-4 text-muted-foreground/70 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            DraftCrane reads your files to help you search and reference them. Your originals
            are never changed.
          </p>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{uploadError}</p>
            <button
              onClick={() => setUploadError(null)}
              className="text-xs text-red-600 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Drive accounts section */}
        {driveAccounts.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              From Google Drive
            </p>
            <div className="space-y-1">
              {driveAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleSelectAccount(account.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50
                             transition-colors min-h-[56px] text-left"
                >
                  <svg
                    className="w-5 h-5 text-gray-500 shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {account.email}
                    </div>
                    <div className="text-xs text-muted-foreground">Browse Google Drive</div>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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
            </div>
          </div>
        )}

        {/* Upload from device section */}
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            From Device
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50
                       transition-colors min-h-[56px] text-left disabled:opacity-50"
          >
            {isUploading ? (
              <svg
                className="animate-spin w-5 h-5 text-gray-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
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
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">
                {isUploading ? "Uploading..." : "Upload file"}
              </div>
              <div className="text-xs text-muted-foreground">.txt, .md, .docx, .pdf</div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload file from device"
          />
        </div>

        {/* Connect another account */}
        {driveAccounts.length < 3 && (
          <div>
            <button
              onClick={onConnectAccount}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50
                         transition-colors min-h-[44px] text-left"
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  Connect another Google account
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// === Inline Drive Browser ===

interface InlineDriveBrowserProps {
  folders: DriveBrowseItem[];
  docs: DriveBrowseItem[];
  isLoading: boolean;
  error: string | null;
  canGoBack: boolean;
  selectedIds: Set<string>;
  existingDriveFileIds: Set<string>;
  selectableSelectedCount: number;
  isAdding: boolean;
  onBack: () => void;
  onOpenFolder: (folderId: string) => void;
  onToggleSelect: (fileId: string) => void;
  onAddSelected: () => void;
  onRefresh: () => void;
}

/**
 * Inline folder browser rendered within the Sources tab (no sheet/modal).
 *
 * Per design spec Section 5, Flow 1:
 * - Shows folders (navigable via tap) and Google Docs (selectable via checkbox)
 * - Files already in project show "Already added" with disabled checkbox
 * - "Add N Selected" sticky footer: 48pt height, full width
 * - All touch targets minimum 44pt
 * - Checkboxes: 44x44pt tap area (visually 24x24px)
 * - [< Sources] back button for navigation
 */
function InlineDriveBrowser({
  folders,
  docs,
  isLoading,
  error,
  canGoBack,
  selectedIds,
  existingDriveFileIds,
  selectableSelectedCount,
  isAdding,
  onBack,
  onOpenFolder,
  onToggleSelect,
  onAddSelected,
  onRefresh,
}: InlineDriveBrowserProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 h-12 px-4 shrink-0 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700
                     min-h-[44px] px-1 transition-colors"
          aria-label={canGoBack ? "Back to parent folder" : "Back to sources"}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {canGoBack ? "Back" : "Sources"}
        </button>
        <span className="text-sm font-semibold text-foreground ml-auto">Google Drive</span>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Loading state */}
        {isLoading && (
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
              Loading...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">Could not access Google Drive. Please try again.</p>
            <button onClick={onRefresh} className="text-xs text-red-600 underline mt-1">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && folders.length === 0 && docs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              No Google Docs or folders found in this location.
            </p>
          </div>
        )}

        {/* File/folder list */}
        {!isLoading && !error && (folders.length > 0 || docs.length > 0) && (
          <ul className="divide-y divide-border" role="list" aria-label="Drive files and folders">
            {/* Folders */}
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  onClick={() => onOpenFolder(folder.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50
                             transition-colors min-h-[44px] text-left"
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
                  <span className="text-sm font-medium text-foreground truncate flex-1">
                    {folder.name}
                  </span>
                  <svg
                    className="w-4 h-4 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </li>
            ))}

            {/* Docs */}
            {docs.map((doc) => {
              const isAlreadyAdded = existingDriveFileIds.has(doc.id);
              const isSelected = selectedIds.has(doc.id);

              return (
                <li key={doc.id}>
                  <DriveDocRow
                    doc={doc}
                    isAlreadyAdded={isAlreadyAdded}
                    isSelected={isSelected}
                    onToggle={() => onToggleSelect(doc.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sticky footer: "Add N Selected" */}
      {docs.length > 0 && (
        <div
          className="shrink-0 border-t border-border px-4 flex items-center justify-between"
          style={{ height: "48px" }}
        >
          <span className="text-xs text-muted-foreground">
            {selectableSelectedCount > 0
              ? `${selectableSelectedCount} selected`
              : "Select files to add"}
          </span>
          <button
            onClick={onAddSelected}
            disabled={selectableSelectedCount === 0 || isAdding}
            className="h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg
                       hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding
              ? "Adding..."
              : selectableSelectedCount > 0
                ? `Add ${selectableSelectedCount} Selected`
                : "Add Selected"}
          </button>
        </div>
      )}
    </div>
  );
}

// === Drive Doc Row ===

interface DriveDocRowProps {
  doc: DriveBrowseItem;
  isAlreadyAdded: boolean;
  isSelected: boolean;
  onToggle: () => void;
}

/**
 * A single Google Doc row in the inline folder browser.
 *
 * Checkbox: 44x44pt tap area, visually 24x24px.
 * "Already added" files show a disabled checkbox with label.
 */
function DriveDocRow({ doc, isAlreadyAdded, isSelected, onToggle }: DriveDocRowProps) {
  return (
    <label
      className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-left
        ${isAlreadyAdded ? "opacity-60 cursor-default" : "hover:bg-gray-50 cursor-pointer"}`}
    >
      {/* Checkbox: 44x44pt tap area wrapping a 24x24px visual checkbox */}
      <span className="flex items-center justify-center w-11 h-11 shrink-0">
        <input
          type="checkbox"
          checked={isAlreadyAdded || isSelected}
          disabled={isAlreadyAdded}
          onChange={isAlreadyAdded ? undefined : onToggle}
          className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isAlreadyAdded ? `${doc.name} - already added` : `Select ${doc.name}`}
        />
      </span>

      {/* Doc icon */}
      <svg
        className="w-5 h-5 text-blue-500 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 3.5L18.5 8H14V3.5zM8 13h8v1.5H8V13zm0 3h8v1.5H8V16zm0-6h3v1.5H8V10z" />
      </svg>

      {/* Doc info */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">{doc.name}</div>
        {isAlreadyAdded ? (
          <div className="text-xs text-muted-foreground">Already added</div>
        ) : (
          <div className="text-xs text-muted-foreground">Google Doc</div>
        )}
      </div>
    </label>
  );
}
