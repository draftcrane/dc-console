"use client";

import { useState } from "react";
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
 * Source Type Picker — first step of the Source Add Flow.
 *
 * Shows available source types (Google Drive, Local Files).
 * Google Drive behavior depends on connection count:
 *   0 connections → initiates OAuth
 *   1 connection → auto-selects and goes to browse
 *   2+ connections → expands inline account list
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
  const [expanded, setExpanded] = useState(false);

  const handleDriveClick = () => {
    if (connections.length === 0) {
      onConnectDrive();
    } else if (connections.length === 1) {
      onSelectConnection(connections[0]);
    } else {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <div className="flex flex-col px-4 py-4 flex-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={onCancel}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
          aria-label="Go back"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-medium text-gray-900">Add Source</h3>
      </div>

      {/* Trust message */}
      <p className="text-xs text-gray-400 mb-4 px-1">Your originals are never changed.</p>

      {/* Source type rows */}
      <div className="flex flex-col gap-1">
        {/* Google Drive */}
        <button
          onClick={handleDriveClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                     transition-colors min-h-[56px] w-full text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                className="text-blue-500"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900 block">Google Drive</span>
            <span className="text-xs text-gray-500 block">Browse and add documents from your Drive</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded && connections.length >= 2 ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Inline account list for 2+ connections */}
        {expanded && connections.length >= 2 && (
          <div className="ml-6 bg-gray-50 rounded-lg overflow-hidden">
            {connections.map((connection) => (
              <button
                key={connection.driveConnectionId}
                onClick={() => onSelectConnection(connection)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100
                           transition-colors min-h-[44px] w-full text-left"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                    className="text-blue-500"
                  />
                </svg>
                <span className="text-sm text-gray-700 truncate flex-1">{connection.email}</span>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
            <button
              onClick={onConnectDrive}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100
                         transition-colors min-h-[44px] w-full text-left border-t border-gray-200"
            >
              <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm text-gray-500">Connect another account</span>
            </button>
          </div>
        )}

        {/* Local Files */}
        <button
          onClick={onUploadLocal}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                     transition-colors min-h-[56px] w-full text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900 block">Local Files</span>
            <span className="text-xs text-gray-500 block">Upload documents from this device</span>
          </div>
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Cancel */}
      <div className="mt-auto pt-4">
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
