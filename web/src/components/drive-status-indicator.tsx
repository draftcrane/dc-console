"use client";

interface DriveStatusIndicatorProps {
  /** Whether Drive is connected */
  connected: boolean;
  /** Email of connected Drive account */
  email?: string;
  /** Handler for clicking when not connected */
  onConnect?: () => void;
  /** Handler for clicking when connected to view Drive files (US-007) */
  onViewFiles?: () => void;
}

/**
 * Compact Drive connection status indicator for the editor toolbar.
 *
 * Per PRD Section 8 (US-005):
 * - When Drive NOT connected: persistent indicator "Not connected to Google Drive.
 *   Your work is saved on this device only."
 * - When Drive IS connected: green checkmark with "Connected to Google Drive"
 *
 * This is a compact version for the toolbar; the full DriveBanner is shown
 * in the editor content area.
 */
export function DriveStatusIndicator({
  connected,
  email,
  onConnect,
  onViewFiles,
}: DriveStatusIndicatorProps) {
  if (connected) {
    // When onViewFiles is provided, make the indicator a clickable button (US-007)
    if (onViewFiles) {
      return (
        <button
          onClick={onViewFiles}
          className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 transition-colors min-h-[44px]"
          title={
            email
              ? `Connected to Google Drive as ${email}. Click to view files.`
              : "Connected to Google Drive. Click to view files."
          }
        >
          <svg
            className="w-3.5 h-3.5 text-green-600 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="hidden sm:inline truncate max-w-[120px]">Drive connected</span>
        </button>
      );
    }

    return (
      <div
        className="flex items-center gap-1.5 text-xs text-green-700"
        title={email ? `Connected to Google Drive as ${email}` : "Connected to Google Drive"}
      >
        <svg
          className="w-3.5 h-3.5 text-green-600 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <span className="hidden sm:inline truncate max-w-[120px]">Drive connected</span>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 transition-colors min-h-[44px]"
      title="Not connected to Google Drive. Your work is saved on this device only."
    >
      <svg
        className="w-3.5 h-3.5 text-amber-500 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
      </svg>
      <span className="hidden sm:inline">Drive not connected</span>
    </button>
  );
}

export default DriveStatusIndicator;
