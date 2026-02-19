"use client";

import { useEffect } from "react";
import type { DriveAccount } from "@/hooks/use-drive-accounts";

interface AccountsSheetProps {
  isOpen: boolean;
  accounts: DriveAccount[];
  onClose: () => void;
  onConnectAccount: () => void;
  onDisconnectAccount: (connectionId: string) => void;
}

/**
 * AccountsSheet - Slide-over panel for managing connected Google accounts.
 *
 * Shows connected accounts with email + connected date.
 * Allows disconnecting individual accounts and connecting new ones.
 * Accessible from Settings menu.
 *
 * iPad-first: 44pt touch targets, right-slide panel at z-50.
 */
export function AccountsSheet({
  isOpen,
  accounts,
  onClose,
  onConnectAccount,
  onDisconnectAccount,
}: AccountsSheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-50" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-50
                   flex flex-col"
        role="dialog"
        aria-label="Google Accounts"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Google Accounts</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-4">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No Google accounts connected</p>
              <button
                onClick={onConnectAccount}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                           hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                Connect Google Account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {account.email}
                    </div>
                    <div className="text-xs text-gray-500">
                      Connected {formatDate(account.connectedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Disconnect ${account.email}? Sources from this account will be archived.`,
                      );
                      if (confirmed) {
                        onDisconnectAccount(account.id);
                      }
                    }}
                    className="ml-3 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md
                               transition-colors min-h-[44px] shrink-0"
                    aria-label={`Disconnect ${account.email}`}
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Add Account */}
        {accounts.length > 0 && accounts.length < 3 && (
          <div className="px-4 py-3 border-t border-gray-200 shrink-0">
            <button
              onClick={onConnectAccount}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                         text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100
                         rounded-lg transition-colors min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Account
            </button>
          </div>
        )}
      </div>
    </>
  );
}
