"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface DriveStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

interface UseDriveStatusOptions {
  /** Whether to fetch on mount. Defaults to true. */
  enabled?: boolean;
}

/**
 * Hook to fetch and manage Google Drive connection status.
 * Per PRD Section 8 (US-005): Tokens are never sent to the frontend.
 * Only connection metadata (connected, email) is returned.
 */
export function useDriveStatus(options: UseDriveStatusOptions = {}) {
  const { enabled = true } = options;
  const { getToken } = useAuth();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      const response = await fetch(`${API_URL}/drive/connection`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Drive connection status");
      }

      const data: DriveStatus = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (enabled) {
      fetchStatus();
    }
  }, [enabled, fetchStatus]);

  /** Initiate the Google OAuth flow by redirecting to the authorization URL. */
  const connect = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/drive/authorize`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get authorization URL");
      }

      const { authorizationUrl } = await response.json();

      // Validate URL points to Google OAuth before redirecting (open redirect prevention)
      if (
        typeof authorizationUrl !== "string" ||
        !authorizationUrl.startsWith("https://accounts.google.com/")
      ) {
        throw new Error("Invalid authorization URL");
      }

      // Redirect to Google OAuth - redirect-based flow per PRD (Safari popup blocker mitigation)
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [getToken]);

  /** Disconnect Google Drive by calling DELETE /drive/connection and refreshing status. */
  const disconnect = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/drive/connection`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect Google Drive");
      }

      // Refresh status to reflect disconnected state
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      throw err;
    }
  }, [getToken, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    connect,
    disconnect,
    refetch: fetchStatus,
  };
}
