"use client";

import { useState } from "react";

interface DisconnectDriveDialogProps {
  /** The Google Drive email to display in the confirmation message */
  email?: string;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when the user confirms disconnection */
  onConfirm: () => Promise<void>;
  /** Called when the user cancels */
  onCancel: () => void;
}

/**
 * DisconnectDriveDialog - Confirmation dialog for disconnecting Google Drive.
 *
 * Per US-008 acceptance criteria:
 * - Confirmation dialog before disconnecting
 * - Reassures user that Drive files remain untouched (no deletion)
 * - After disconnect, save indicator changes to device-only mode
 * - User can reconnect anytime
 * - iPad-first: 44pt minimum touch targets
 */
export function DisconnectDriveDialog({
  email,
  isOpen,
  onConfirm,
  onCancel,
}: DisconnectDriveDialogProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  if (!isOpen) return null;

  async function handleConfirm() {
    setIsDisconnecting(true);
    try {
      await onConfirm();
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disconnect-drive-title"
      aria-describedby="disconnect-drive-description"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-6 w-6 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2
          id="disconnect-drive-title"
          className="text-lg font-semibold text-gray-900 mb-2 text-center"
        >
          Disconnect Google Drive
        </h2>

        <p id="disconnect-drive-description" className="text-sm text-gray-600 mb-2 text-center">
          {email
            ? `Disconnect your Google Drive account (${email})?`
            : "Disconnect your Google Drive account?"}
        </p>

        <p className="text-sm text-gray-500 mb-2 text-center">
          Your files in Google Drive will not be deleted or modified.
        </p>

        <p className="text-sm text-gray-500 mb-6 text-center">
          After disconnecting, your work will be saved on this device only. You can reconnect
          anytime.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDisconnecting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                       hover:bg-gray-200 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDisconnecting}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg
                       hover:bg-amber-700 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DisconnectDriveDialog;
