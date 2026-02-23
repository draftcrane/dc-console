"use client";

import { useState, useCallback, useMemo } from "react";
import { useDriveAccounts, type DriveAccount } from "@/hooks/use-drive-accounts";
import { useSourcesContext } from "@/contexts/sources-context";

const SOURCE_LINK_KEY = "dc_pending_source_link";

interface ConnectSourceSheetProps {
  /** Called when sheet should close */
  onClose: () => void;
}

/**
 * ConnectSourceSheet — the ONLY place user-level Drive accounts are fetched
 * and displayed, solely for linking to the current project.
 *
 * Shows:
 * 1. User-level accounts not yet linked to this project → "Link" button
 * 2. "Connect new account" → initiates OAuth with projectId in sessionStorage
 * 3. "Manage accounts" section for full OAuth revocation
 *
 * Vocabulary: Source = provider, Document = file.
 */
export function ConnectSourceSheet({ onClose }: ConnectSourceSheetProps) {
  const {
    connections,
    linkConnection,
    connectDrive,
    disconnectDrive,
    refetchDriveAccounts,
    projectId,
  } = useSourcesContext();

  // Fetch user-level accounts locally — NOT from context
  const { accounts: userAccounts, isLoading, refetch: refetchAccounts } = useDriveAccounts();

  const [isLinking, setIsLinking] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Filter out accounts already linked to this project
  const linkedDriveConnectionIds = useMemo(
    () => new Set(connections.map((c) => c.driveConnectionId)),
    [connections],
  );

  const availableAccounts = useMemo(
    () => userAccounts.filter((a) => !linkedDriveConnectionIds.has(a.id)),
    [userAccounts, linkedDriveConnectionIds],
  );

  const handleLink = useCallback(
    async (account: DriveAccount) => {
      setIsLinking(account.id);
      try {
        await linkConnection(account.id);
        // If this was the last available account, close the sheet
        if (availableAccounts.length <= 1) {
          onClose();
        }
      } catch (err) {
        console.error("Failed to link connection:", err);
      } finally {
        setIsLinking(null);
      }
    },
    [linkConnection, availableAccounts.length, onClose],
  );

  const handleConnectNew = useCallback(() => {
    // Store projectId for auto-link after OAuth return (sessionStorage)
    try {
      sessionStorage.setItem(SOURCE_LINK_KEY, projectId);
    } catch {
      // sessionStorage unavailable — pid fallback in OAuth state handles this
    }
    // Also pass projectId to backend for encoding in OAuth state (iPad Safari fallback)
    connectDrive(undefined, projectId);
  }, [connectDrive, projectId]);

  const handleRevoke = useCallback(
    async (connectionId: string) => {
      setIsRevoking(true);
      try {
        await disconnectDrive(connectionId);
        await refetchDriveAccounts();
        await refetchAccounts();
        setConfirmRevokeId(null);
      } catch (err) {
        console.error("Failed to revoke:", err);
      } finally {
        setIsRevoking(false);
      }
    },
    [disconnectDrive, refetchDriveAccounts, refetchAccounts],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col px-4 py-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Connect a source</h3>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px]
                       flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-4 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Connect a source</h3>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px]
                     flex items-center justify-center"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {!showManage ? (
        <>
          {/* Available accounts to link */}
          {availableAccounts.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">
                Link a Google Drive account to this book:
              </p>
              <div className="flex flex-col gap-1">
                {availableAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => handleLink(account)}
                    disabled={isLinking === account.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                               transition-colors min-h-[44px] w-full text-left
                               disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path
                        d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                        className="text-blue-500"
                      />
                    </svg>
                    <span className="text-sm text-gray-900 truncate flex-1">{account.email}</span>
                    <span className="text-xs text-blue-600 font-medium shrink-0">
                      {isLinking === account.id ? "Linking..." : "Link"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Connect new account */}
          <button
            onClick={handleConnectNew}
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
            <span className="text-sm text-gray-700">Connect new Google Drive account</span>
          </button>

          {/* Manage accounts link */}
          {userAccounts.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowManage(true)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors
                           min-h-[44px] px-1"
              >
                Manage accounts
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manage accounts view — full OAuth revocation */}
          <button
            onClick={() => {
              setShowManage(false);
              setConfirmRevokeId(null);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 min-h-[44px] flex items-center gap-1 mb-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          <p className="text-xs text-gray-500 mb-2">
            Revoking access removes the account from all books and deletes stored tokens.
          </p>

          <div className="flex flex-col gap-1">
            {userAccounts.map((account) => (
              <div key={account.id}>
                <div className="flex items-center gap-2 px-1 min-h-[44px]">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                      className="text-blue-500"
                    />
                  </svg>
                  <span className="text-xs text-gray-700 truncate flex-1">{account.email}</span>

                  {confirmRevokeId !== account.id && (
                    <button
                      onClick={() => setConfirmRevokeId(account.id)}
                      className="text-xs text-gray-400 hover:text-red-600 transition-colors
                                 min-h-[44px] flex items-center shrink-0"
                    >
                      Revoke access
                    </button>
                  )}
                </div>

                {/* Inline confirmation */}
                {confirmRevokeId === account.id && (
                  <div className="px-1 py-2 bg-gray-50 rounded-lg mx-1 mb-1">
                    <p className="text-xs text-gray-600 mb-2">
                      Revoke access for {account.email}? Documents from this source will be archived
                      in all books.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRevoke(account.id)}
                        disabled={isRevoking}
                        className="text-xs font-medium text-red-600 hover:text-red-700
                                   min-h-[36px] px-2 disabled:opacity-50"
                      >
                        {isRevoking ? "Revoking..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmRevokeId(null)}
                        disabled={isRevoking}
                        className="text-xs text-gray-500 hover:text-gray-700
                                   min-h-[36px] px-2 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {userAccounts.length === 0 && (
            <p className="text-xs text-gray-400 py-2 px-1">No accounts connected.</p>
          )}
        </>
      )}
    </div>
  );
}
