"use client";

import { useState, useMemo } from "react";
import type { DriveAccount } from "@/hooks/use-drive-accounts";
import type { SourceMaterial } from "@/hooks/use-sources";

interface ConnectionsViewProps {
  driveAccounts: DriveAccount[];
  sources: SourceMaterial[];
  protectedConnectionIds: string[];
  onBack: () => void;
  onBrowseFiles: (connectionId: string) => void;
  onConnectAccount: () => void;
  onDisconnect: (connectionId: string) => Promise<void>;
}

/**
 * Connections management view — secondary surface for managing Drive accounts.
 *
 * Shows connected accounts with per-account document counts, disconnect actions,
 * and "Browse files" links that open the add flow pre-filtered to that account.
 */
export function ConnectionsView({
  driveAccounts,
  sources,
  protectedConnectionIds,
  onBack,
  onBrowseFiles,
  onConnectAccount,
  onDisconnect,
}: ConnectionsViewProps) {
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const docCountByConnection = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const s of sources) {
      const key = s.driveConnectionId ?? null;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [sources]);

  const deviceDocCount = docCountByConnection.get(null) ?? 0;

  const handleDisconnect = async (connectionId: string) => {
    setIsDisconnecting(true);
    try {
      await onDisconnect(connectionId);
      setConfirmDisconnectId(null);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 h-11 px-4 shrink-0 border-b border-border">
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
        <span className="ml-auto text-xs font-medium text-foreground">Connections</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Google Drive section */}
        <div className="px-4 pt-4 pb-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Google Drive
          </p>
        </div>

        {driveAccounts.length === 0 ? (
          <div className="px-4 py-3">
            <p className="text-sm text-muted-foreground">No accounts connected.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border" role="list" aria-label="Connected accounts">
            {driveAccounts.map((account) => {
              const docCount = docCountByConnection.get(account.id) ?? 0;
              const isProtected = protectedConnectionIds.includes(account.id);
              const isConfirming = confirmDisconnectId === account.id;

              return (
                <li key={account.id} className="px-4 py-3 min-h-[56px]">
                  <div className="flex items-start gap-3">
                    {/* Drive icon */}
                    <div className="h-9 w-9 flex items-center justify-center rounded-full bg-blue-50 shrink-0">
                      <svg
                        className="w-4 h-4 text-gray-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z" />
                      </svg>
                    </div>

                    {/* Account info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {account.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {docCount} document{docCount !== 1 ? "s" : ""}
                        {isProtected && (
                          <span className="ml-1.5 text-amber-600 font-medium">Backup account</span>
                        )}
                      </p>

                      {/* Actions row */}
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          onClick={() => onBrowseFiles(account.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700
                                     min-h-[32px] flex items-center transition-colors"
                        >
                          Browse files
                        </button>
                        {!isProtected && !isConfirming && (
                          <button
                            onClick={() => setConfirmDisconnectId(account.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-700
                                       min-h-[32px] flex items-center transition-colors"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>

                      {/* Inline disconnect confirmation */}
                      {isConfirming && (
                        <div className="flex items-center gap-2 mt-1.5 py-1 px-2 bg-red-50 rounded">
                          <span className="text-xs text-red-700">Confirm?</span>
                          <button
                            onClick={() => handleDisconnect(account.id)}
                            disabled={isDisconnecting}
                            className="text-xs font-medium text-red-600 hover:text-red-700
                                       min-h-[32px] flex items-center transition-colors
                                       disabled:opacity-50"
                          >
                            {isDisconnecting ? "..." : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmDisconnectId(null)}
                            disabled={isDisconnecting}
                            className="text-xs font-medium text-gray-600 hover:text-gray-700
                                       min-h-[32px] flex items-center transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* From Device section */}
        {deviceDocCount > 0 && (
          <>
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                From Device
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {deviceDocCount} document{deviceDocCount !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}

        {/* Connect Another */}
        {driveAccounts.length < 3 && (
          <div className="px-4 pt-4">
            <button
              onClick={onConnectAccount}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50
                         transition-colors min-h-[44px] text-left border border-dashed border-border"
            >
              <svg
                className="w-5 h-5 text-gray-400 shrink-0"
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
              <span className="text-sm font-medium text-foreground">
                Connect another Google account
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
