"use client";

import type { SourceConnection } from "@/hooks/use-sources";

interface SourcePickerProps {
  /** Project-scoped Drive connections */
  connections: SourceConnection[];
  /** Called when user picks a project-linked connection to browse */
  onSelectConnection: (connection: SourceConnection) => void;
  /** Called when user wants to connect Google Drive (initiates OAuth directly) */
  onConnectDrive: () => void;
  /** Called when user wants to upload from this device */
  onUploadLocal: () => void;
  /** Called when user taps Cancel */
  onCancel: () => void;
}

/**
 * SourcePicker — inline panel for choosing where to add documents from.
 *
 * When project has linked connections: shows each linked account + "This device" + "Connect another source"
 * When project has NO connections: shows generic "Google Drive" + "This device" (no account emails)
 *
 * User-level account details are NEVER shown here. Clicking "Google Drive"
 * initiates OAuth directly — no intermediate screen with account emails.
 *
 * 44pt touch targets throughout. iPad-first.
 *
 * Vocabulary: Source = provider, Folder = directory, Document = file.
 */
export function SourcePicker({
  connections,
  onSelectConnection,
  onConnectDrive,
  onUploadLocal,
  onCancel,
}: SourcePickerProps) {
  const hasConnections = connections.length > 0;

  return (
    <div className="flex flex-col px-4 py-4 flex-1">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Add documents from</h3>

      <div className="flex flex-col gap-1">
        {hasConnections ? (
          <>
            {/* Project-linked Drive connections (show account emails) */}
            {connections.map((connection) => (
              <button
                key={connection.driveConnectionId}
                onClick={() => onSelectConnection(connection)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                           transition-colors min-h-[44px] w-full text-left"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                    className="text-blue-500"
                  />
                </svg>
                <span className="text-sm text-gray-900 truncate">{connection.email}</span>
              </button>
            ))}
          </>
        ) : (
          /* No project connections — show generic "Google Drive" (no emails, no account details) */
          <button
            onClick={onConnectDrive}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                       transition-colors min-h-[44px] w-full text-left"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                className="text-blue-500"
              />
            </svg>
            <span className="text-sm text-gray-900">Google Drive</span>
          </button>
        )}

        {/* This device */}
        <button
          onClick={onUploadLocal}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                     transition-colors min-h-[44px] w-full text-left"
        >
          <svg
            className="w-5 h-5 shrink-0 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-sm text-gray-900">This device</span>
        </button>

        {/* Connect another source (only when at least one already linked) */}
        {hasConnections && (
          <button
            onClick={onConnectDrive}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                       transition-colors min-h-[44px] w-full text-left"
          >
            <svg
              className="w-5 h-5 shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-sm text-gray-500">Connect another source</span>
          </button>
        )}
      </div>

      {/* Cancel */}
      <div className="mt-4">
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors min-h-[44px] px-3"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
