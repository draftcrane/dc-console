"use client";

import { useRef, useCallback, useState } from "react";
import { validateUploadFile } from "@/hooks/use-sources";
import type { DriveAccount } from "@/hooks/use-drive-accounts";

interface SourceAddFlowProps {
  projectId: string;
  driveAccounts: DriveAccount[];
  onBack: () => void;
  onSelectDriveAccount: (connectionId: string) => void;
  onUploadLocal: (file: File) => void;
  onConnectAccount: () => void;
}

/**
 * SourceAddFlow - Inline replacement view within Sources tab.
 *
 * Shows:
 * - Trust message: "Your originals are never changed"
 * - Connected Drive accounts as tappable rows
 * - "Upload from device" button for local files (.txt, .md, .docx, .pdf)
 * - "Connect another Google account" option
 *
 * Per design spec Section 5, Flow 2:
 * - 56pt minimum row height, full-width tap targets
 * - accept attribute includes .txt, .md, .docx, .pdf and MIME types
 *
 * iPad-first: 44pt touch targets, full-width rows.
 */
export function SourceAddFlow({
  driveAccounts,
  onBack,
  onSelectDriveAccount,
  onUploadLocal,
  onConnectAccount,
}: SourceAddFlowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Client-side validation
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

      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [onUploadLocal],
  );

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
        {/* Trust message */}
        <div className="text-sm text-muted-foreground mb-4 p-3 bg-blue-50 rounded-lg">
          DraftCrane reads your files to help you search and reference them. Your originals are
          never changed.
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
                  onClick={() => onSelectDriveAccount(account.id)}
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
