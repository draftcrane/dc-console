"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

interface DriveBannerProps {
  /** Whether Drive is connected */
  connected: boolean;
  /** Email of connected Drive account */
  email?: string;
  /** Whether banner can be dismissed */
  dismissible?: boolean;
}

/**
 * Drive Connection Banner
 *
 * Per PRD Section 7 (Step 4):
 * - When Drive not connected: gentle banner "Connect your Google Drive to keep your book safe."
 * - Button: "Connect Google Drive"
 * - Link: "Maybe later"
 * - When connected: confirmation with folder name, green checkmark, "View in Google Drive" link
 *
 * Per PRD Section 8 (US-005):
 * - "Maybe later" option available
 * - When not connected, persistent indicator shows degraded state
 */
export function DriveBanner({ connected, email, dismissible = true }: DriveBannerProps) {
  const { getToken } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  if (isDismissed && dismissible) {
    return null;
  }

  // Connected state - show success banner
  if (connected) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          {/* Green checkmark */}
          <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">
              Google Drive connected
            </p>
            {email && (
              <p className="text-sm text-green-700 truncate">
                Connected as {email}
              </p>
            )}
          </div>

          {/* View in Drive link */}
          <a
            href="https://drive.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-green-700 hover:text-green-900 underline shrink-0"
          >
            View in Drive
          </a>
        </div>
      </div>
    );
  }

  // Not connected state - show warning banner
  async function handleConnect() {
    setIsConnecting(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/drive/authorize`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get authorization URL");
      }

      const { url } = await response.json();
      // Redirect to Google OAuth - redirect-based flow per PRD (Safari popup blocker mitigation)
      window.location.href = url;
    } catch (err) {
      console.error("Failed to connect Drive:", err);
      setIsConnecting(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {/* Warning icon */}
        <div className="shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">
            Connect your Google Drive to keep your book safe
          </p>
          <p className="text-sm text-amber-700 mt-1">
            Your work is saved on this device only. Connect Drive to save your chapters in your own cloud account.
          </p>

          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                         bg-amber-600 text-white rounded-lg
                         hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors min-h-[44px]"
            >
              {isConnecting ? (
                "Connecting..."
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Connect Google Drive
                </>
              )}
            </button>

            {dismissible && (
              <button
                onClick={() => setIsDismissed(true)}
                className="text-sm text-amber-700 hover:text-amber-900 underline"
              >
                Maybe later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriveBanner;
