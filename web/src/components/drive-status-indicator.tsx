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
  /** Whether the current project has a Drive folder connected */
  isProjectConnected?: boolean;
}

/**
 * Compact Drive connection status indicator for the editor toolbar.
 *
 * - When Drive NOT connected: neutral invite to connect (muted styling).
 *   Drive is optional — not connecting is a valid choice, not a degraded state.
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
  isProjectConnected,
}: DriveStatusIndicatorProps) {
  if (connected) {
    if (isProjectConnected) {
      return (
        <button
          onClick={onViewFiles}
          className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 transition-colors min-h-[44px]"
          title={
            email
              ? `Project linked to Google Drive as ${email}. Click to view files.`
              : "Project linked to Google Drive. Click to view files."
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
          <span className="hidden sm:inline truncate max-w-[120px]">Project Linked</span>
        </button>
      );
    } else {
      return (
        <button
          onClick={onViewFiles}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
          title="Connect this project to Google Drive"
        >
          <svg
            className="w-3.5 h-3.5 text-muted-foreground shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="hidden sm:inline">Connect Project</span>
        </button>
      );
    }
  }

  return (
    <button
      onClick={onConnect}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
      title="Connect Google Drive to back up your chapters"
    >
      <svg
        className="w-3.5 h-3.5 text-muted-foreground shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <span className="hidden sm:inline">Connect Drive</span>
    </button>
  );
}

export default DriveStatusIndicator;
