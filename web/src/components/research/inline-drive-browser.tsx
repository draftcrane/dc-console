"use client";

import type { DriveBrowseItem } from "@/hooks/use-drive-browser";

// === Inline Drive Browser ===

export interface InlineDriveBrowserProps {
  folders: DriveBrowseItem[];
  docs: DriveBrowseItem[];
  isLoading: boolean;
  error: string | null;
  canGoBack: boolean;
  selectedIds: Set<string>;
  existingDriveFileIds: Set<string>;
  selectableSelectedCount: number;
  isAdding: boolean;
  /** Email shown in the header to identify which account is being browsed */
  providerEmail?: string;
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
export function InlineDriveBrowser({
  folders,
  docs,
  isLoading,
  error,
  canGoBack,
  selectedIds,
  existingDriveFileIds,
  selectableSelectedCount,
  isAdding,
  providerEmail,
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
        <span className="text-sm font-semibold text-foreground ml-auto truncate max-w-[180px]">
          {providerEmail ?? "Google Drive"}
        </span>
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
            {/* Folders — two-zone: checkbox to select, button to navigate */}
            {folders.map((folder) => (
              <li key={folder.id} className="flex items-center min-h-[44px]">
                {/* Checkbox: 44x44pt tap zone */}
                <label className="flex items-center justify-center w-11 h-11 shrink-0 ml-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(folder.id)}
                    onChange={() => onToggleSelect(folder.id)}
                    className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`Select all docs in ${folder.name}`}
                  />
                </label>

                {/* Navigate zone */}
                <button
                  onClick={() => onOpenFolder(folder.id)}
                  className="flex-1 flex items-center gap-3 px-3 py-3 hover:bg-gray-50
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
      {(docs.length > 0 || folders.length > 0) && (
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
export function DriveDocRow({ doc, isAlreadyAdded, isSelected, onToggle }: DriveDocRowProps) {
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
