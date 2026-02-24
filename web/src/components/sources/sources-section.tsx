"use client";

import { useState, useCallback } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import type { SourceConnection } from "@/hooks/use-sources";

/**
 * SourcesSection - always-visible connections section in the Sources tab.
 *
 * Shows project-scoped connections with Browse + Remove actions.
 * No collapsible behavior - connections are permanent anchors in the
 * Source Manager model.
 *
 * "Remove" unlinks from this book - it does NOT revoke the OAuth token.
 *
 * Vocabulary: Source = provider, Document = file.
 */
interface SourcesSectionProps {
  /** Called when user taps "Browse" on a connection */
  onBrowseConnection: (connection: SourceConnection) => void;
  /** Called when user taps "+ Connect a Source" */
  onAddSource: () => void;
}

export function SourcesSection({ onBrowseConnection, onAddSource }: SourcesSectionProps) {
  const { connections, unlinkConnection } = useSourcesContext();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleUnlink = useCallback(
    async (connectionId: string) => {
      setIsUnlinking(true);
      try {
        await unlinkConnection(connectionId);
        setConfirmingId(null);
      } catch (err) {
        console.error("Failed to remove source:", err);
      } finally {
        setIsUnlinking(false);
      }
    },
    [unlinkConnection],
  );

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      {/* Section label */}
      <div className="flex items-center gap-2 min-h-[32px] mb-1">
        <div className="flex-1 flex items-center gap-2">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase shrink-0">
            Connections
          </span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>
      </div>

      {/* Connection rows */}
      <div className="flex flex-col gap-1">
        {connections.length === 0 ? (
          <p className="text-xs text-gray-400 py-2 px-1">No sources connected to this book.</p>
        ) : (
          connections.map((connection) => (
            <div key={connection.id}>
              <div className="flex items-center gap-2 px-1 min-h-[44px]">
                {/* Google Drive icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
                    className="text-blue-500"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-700 truncate block">{connection.email}</span>
                  {connection.documentCount > 0 && (
                    <span className="text-[10px] text-gray-400">
                      {connection.documentCount} document{connection.documentCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Browse button */}
                <button
                  onClick={() => onBrowseConnection(connection)}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors
                               min-h-[44px] px-2 flex items-center shrink-0"
                >
                  Browse
                </button>

                {/* Remove button */}
                {confirmingId !== connection.id && (
                  <button
                    onClick={() => setConfirmingId(connection.id)}
                    className="text-xs text-gray-400 hover:text-red-600 transition-colors
                                 min-h-[44px] flex items-center shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Inline confirmation */}
              {confirmingId === connection.id && (
                <div className="px-1 py-2 bg-gray-50 rounded-lg mx-1 mb-1">
                  <p className="text-xs text-gray-600 mb-2">
                    Remove {connection.email} from this book? Documents from this source will be
                    archived.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUnlink(connection.id)}
                      disabled={isUnlinking}
                      className="text-xs font-medium text-red-600 hover:text-red-700
                                   min-h-[36px] px-2 disabled:opacity-50"
                    >
                      {isUnlinking ? "Removing..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={isUnlinking}
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

      {/* Connect a Source button */}
      <button
        onClick={onAddSource}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700
                   transition-colors min-h-[44px] px-1 mt-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Connect a Source
      </button>
    </div>
  );
}
