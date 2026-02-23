"use client";

import { useState, useCallback } from "react";
import { useSourcesContext } from "@/contexts/sources-context";

/**
 * SourcesSection — collapsible "Your Sources" section at the bottom of Library tab.
 *
 * Shows connected providers with disconnect capability.
 * Replaces AccountsSheet as the primary provider management path.
 *
 * - Collapsed by default when sources exist
 * - Expanded when no providers connected (guides first-run)
 * - "+ Add" opens source picker via callback
 * - Inline disconnect confirmation (no window.confirm)
 * - 44pt touch targets throughout
 */
interface SourcesSectionProps {
  /** Called when user taps "+ Add" to open the source picker */
  onAddSource: () => void;
}

export function SourcesSection({ onAddSource }: SourcesSectionProps) {
  const { driveAccounts, disconnectDrive, refetchDriveAccounts } = useSourcesContext();

  const [expanded, setExpanded] = useState(driveAccounts.length === 0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = useCallback(
    async (connectionId: string) => {
      setIsDisconnecting(true);
      try {
        await disconnectDrive(connectionId);
        await refetchDriveAccounts();
        setConfirmingId(null);
      } catch (err) {
        console.error("Failed to disconnect:", err);
      } finally {
        setIsDisconnecting(false);
      }
    },
    [disconnectDrive, refetchDriveAccounts],
  );

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full min-h-[44px] text-left"
      >
        <div className="flex items-center gap-1.5">
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-gray-500">Your Sources</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddSource();
          }}
          className="text-xs text-blue-600 hover:text-blue-700 min-h-[44px] min-w-[44px]
                     flex items-center justify-center"
          aria-label="Add source"
        >
          + Add
        </button>
      </button>

      {/* Content */}
      {expanded && (
        <div className="flex flex-col gap-1 pb-2">
          {driveAccounts.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 px-1">No sources connected.</p>
          ) : (
            driveAccounts.map((account) => (
              <div key={account.id}>
                <div className="flex items-center gap-2 px-1 min-h-[44px]">
                  {/* Google Drive icon */}
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                      className="text-blue-500"
                    />
                  </svg>
                  <span className="text-xs text-gray-700 truncate flex-1">{account.email}</span>

                  {confirmingId === account.id ? null : (
                    <button
                      onClick={() => setConfirmingId(account.id)}
                      className="text-xs text-gray-400 hover:text-red-600 transition-colors
                                 min-h-[44px] flex items-center shrink-0"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {/* Inline confirmation */}
                {confirmingId === account.id && (
                  <div className="px-1 py-2 bg-gray-50 rounded-lg mx-1 mb-1">
                    <p className="text-xs text-gray-600 mb-2">
                      Disconnect {account.email}? Documents from this source will be archived.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDisconnect(account.id)}
                        disabled={isDisconnecting}
                        className="text-xs font-medium text-red-600 hover:text-red-700
                                   min-h-[36px] px-2 disabled:opacity-50"
                      >
                        {isDisconnecting ? "Disconnecting..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        disabled={isDisconnecting}
                        className="text-xs text-gray-500 hover:text-gray-700
                                   min-h-[36px] px-2 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
