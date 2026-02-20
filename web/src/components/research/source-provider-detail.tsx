"use client";

import { useState } from "react";
import type { SourceMaterial } from "@/hooks/use-sources";

interface SourceProviderDetailProps {
  connectionId: string | null;
  email: string | null;
  sources: SourceMaterial[];
  isProtected: boolean;
  onViewSource: (sourceId: string) => void;
  onRemoveSource: (sourceId: string) => void;
  onAddMore: () => void;
  onDisconnect: (connectionId: string) => Promise<void>;
  onBack: () => void;
}

/**
 * Provider detail view — documents from a single source provider with management actions.
 *
 * Shows:
 * - Provider header (email, type, connection date)
 * - List of documents from this provider
 * - "Add More" action button
 * - "Disconnect Account" (hidden for protected/backup accounts and device uploads)
 */
export function SourceProviderDetail({
  connectionId,
  email,
  sources,
  isProtected,
  onViewSource,
  onRemoveSource,
  onAddMore,
  onDisconnect,
  onBack,
}: SourceProviderDetailProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const isDeviceProvider = connectionId === null;
  const providerLabel = isDeviceProvider ? "From This Device" : (email ?? "Google Drive");

  const handleDisconnect = async () => {
    if (!connectionId) return;
    setIsDisconnecting(true);
    try {
      await onDisconnect(connectionId);
      onBack();
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
      </div>

      {/* Provider info */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          {isDeviceProvider ? (
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 shrink-0">
              <svg
                className="w-5 h-5 text-gray-500"
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
            </div>
          ) : (
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-50 shrink-0">
              <svg
                className="w-5 h-5 text-gray-500"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{providerLabel}</p>
            <p className="text-xs text-muted-foreground">
              {isDeviceProvider ? "Uploaded files" : "Google Drive"}
              {isProtected && !isDeviceProvider && (
                <span className="ml-1.5 text-xs text-amber-600 font-medium">Backup account</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-auto min-h-0">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">No documents from this source yet.</p>
            <button
              onClick={onAddMore}
              className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg
                         hover:bg-blue-700 transition-colors"
            >
              {isDeviceProvider ? "Upload File" : "Browse Drive"}
            </button>
          </div>
        ) : (
          <>
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Documents ({sources.length})
              </p>
            </div>
            <ul className="divide-y divide-border" role="list" aria-label="Provider documents">
              {sources.map((source) => (
                <ProviderDocRow
                  key={source.id}
                  source={source}
                  onTap={() => onViewSource(source.id)}
                  onRemove={() => onRemoveSource(source.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        {/* Add More */}
        {sources.length > 0 && (
          <button
            onClick={onAddMore}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg
                       border border-border text-sm font-medium text-foreground
                       hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {isDeviceProvider ? "Upload Another File" : "Add More from This Drive"}
          </button>
        )}

        {/* Disconnect (only for Drive accounts that are not protected) */}
        {!isDeviceProvider && !isProtected && connectionId && (
          <>
            {showDisconnectConfirm ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 mb-2">
                  Disconnect {email}? {sources.length} research document
                  {sources.length !== 1 ? "s" : ""} from this account will be archived. Your Google
                  Drive files won&apos;t be affected.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="h-8 px-3 text-sm font-medium text-white bg-red-600 rounded-md
                               hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    disabled={isDisconnecting}
                    className="h-8 px-3 text-sm font-medium text-gray-700 rounded-md
                               hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="w-full h-10 flex items-center justify-center text-sm font-medium
                           text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Disconnect Account
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// === Provider Document Row ===

function ProviderDocRow({
  source,
  onTap,
  onRemove,
}: {
  source: SourceMaterial;
  onTap: () => void;
  onRemove: () => void;
}) {
  const isError = source.status === "error";
  const isArchived = source.status === "archived";

  return (
    <li className={`min-h-[56px] ${isArchived ? "opacity-60" : ""}`}>
      <button
        onClick={isError || isArchived ? undefined : onTap}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors
          ${isError || isArchived ? "" : "hover:bg-gray-50"}`}
        disabled={isError || isArchived}
      >
        {/* Doc icon */}
        <div
          className={`h-9 w-9 flex items-center justify-center rounded-lg shrink-0 ${
            isError ? "bg-red-50" : isArchived ? "bg-gray-100" : "bg-blue-50"
          }`}
        >
          <svg
            className={`w-4 h-4 ${isError ? "text-red-400" : isArchived ? "text-gray-400" : "text-blue-500"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{source.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {isError ? (
              <span className="text-xs text-red-500">Could not extract text</span>
            ) : isArchived ? (
              <span className="text-xs text-amber-600">Account disconnected</span>
            ) : source.cachedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {source.wordCount.toLocaleString()} words
              </span>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <svg
                  className="animate-spin h-3 w-3"
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
                Processing...
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Error/archived actions */}
      {(isError || isArchived) && (
        <div className="flex items-center gap-2 px-4 pb-2 ml-12">
          <button
            onClick={onRemove}
            className="h-8 px-2.5 text-xs font-medium text-red-500 rounded-md hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  );
}
