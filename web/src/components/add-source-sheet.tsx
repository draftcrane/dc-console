"use client";

import { useRef, useCallback } from "react";
import type { DriveAccount } from "@/hooks/use-drive-accounts";

interface AddSourceSheetProps {
  isOpen: boolean;
  accounts: DriveAccount[];
  isPickerLoading: boolean;
  onClose: () => void;
  onSelectDriveAccount: (connectionId: string) => void;
  onUploadLocal: (file: File) => void;
  onConnectAccount: () => void;
}

/**
 * AddSourceSheet - Bottom sheet for adding source materials.
 *
 * Shows:
 * - Connected Drive accounts as tappable rows (opens Picker for that account)
 * - "Upload from device" button for local files (.txt, .md)
 * - "Connect another Google account" option
 *
 * iPad-first: 44pt touch targets, full-width bottom sheet.
 */
export function AddSourceSheet({
  isOpen,
  accounts,
  isPickerLoading,
  onClose,
  onSelectDriveAccount,
  onUploadLocal,
  onConnectAccount,
}: AddSourceSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUploadLocal(file);
        onClose();
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [onUploadLocal, onClose],
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[70vh] overflow-auto">
        <div className="px-4 pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Add Source</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select files from Google Drive or upload from your device
          </p>
        </div>

        <div className="px-4 py-3 space-y-1">
          {/* Drive accounts */}
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                onSelectDriveAccount(account.id);
                onClose();
              }}
              disabled={isPickerLoading}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50
                         transition-colors min-h-[44px] text-left disabled:opacity-50"
            >
              <svg
                className="w-5 h-5 text-gray-500 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">{account.email}</div>
                <div className="text-xs text-gray-500">Google Drive</div>
              </div>
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

          {/* Separator if accounts exist */}
          {accounts.length > 0 && <div className="my-2 border-t border-gray-200" />}

          {/* Upload from device */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50
                       transition-colors min-h-[44px] text-left"
          >
            <svg
              className="w-5 h-5 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">Upload from device</div>
              <div className="text-xs text-gray-500">.txt and .md files, up to 5MB</div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Connect another account */}
          {accounts.length < 3 && (
            <button
              onClick={() => {
                onConnectAccount();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50
                         transition-colors min-h-[44px] text-left"
            >
              <svg
                className="w-5 h-5 text-gray-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">
                  Connect another Google account
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Safe area padding for bottom */}
        <div className="h-6" />
      </div>
    </>
  );
}
