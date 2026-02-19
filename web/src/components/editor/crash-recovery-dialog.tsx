"use client";

import type { RecoveryPrompt } from "@/hooks/use-auto-save";

interface CrashRecoveryDialogProps {
  recovery: RecoveryPrompt;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * CrashRecoveryDialog - Prompts user to restore unsaved content from IndexedDB.
 *
 * Per US-015 acceptance criteria:
 * - On editor mount, compare IndexedDB content with Drive content
 * - If IndexedDB is newer, prompt user to restore
 */
export function CrashRecoveryDialog({ recovery, onAccept, onDismiss }: CrashRecoveryDialogProps) {
  const timeAgo = formatTimeAgo(recovery.localUpdatedAt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      aria-describedby="recovery-description"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h2 id="recovery-title" className="text-lg font-semibold text-gray-900 mb-2">
          Unsaved Changes Found
        </h2>
        <p id="recovery-description" className="text-sm text-gray-600 mb-6">
          We found unsaved changes from {timeAgo}. This may have been caused by a browser crash or
          unexpected closure. Would you like to restore your work?
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                       hover:bg-gray-200 transition-colors min-h-[44px]"
          >
            Discard
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
                       hover:bg-blue-700 transition-colors min-h-[44px]"
            autoFocus
          >
            Restore Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default CrashRecoveryDialog;
