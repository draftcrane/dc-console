"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface DriveAccount {
  id: string;
  email: string;
  connectedAt: string;
}

interface UseDriveAccountsOptions {
  /** Whether to fetch on mount. Defaults to true. */
  enabled?: boolean;
}

/**
 * Hook to manage multiple Google Drive account connections.
 * Replaces useDriveStatus with multi-account support.
 *
 * Per PRD Section 8 (US-005): Tokens are never sent to the frontend.
 * Only connection metadata (id, email, connectedAt) is returned.
 */
export function useDriveAccounts(options: UseDriveAccountsOptions = {}) {
  const { enabled = true } = options;
  const { getToken } = useAuth();
  const [accounts, setAccounts] = useState<DriveAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
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
        throw new Error("Failed to fetch Drive connections");
      }

      const data = await response.json();
      setAccounts(data.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (enabled) {
      fetchAccounts();
    }
  }, [enabled, fetchAccounts]);

  /** Initiate Google OAuth flow. Optional loginHint pre-selects the account. */
  const connect = useCallback(
    async (loginHint?: string) => {
      try {
        const token = await getToken();
        const url = loginHint
          ? `${API_URL}/drive/authorize?loginHint=${encodeURIComponent(loginHint)}`
          : `${API_URL}/drive/authorize`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to get authorization URL");
        }

        const { authorizationUrl } = await response.json();

        // Validate URL points to Google OAuth before redirecting
        if (
          typeof authorizationUrl !== "string" ||
          !authorizationUrl.startsWith("https://accounts.google.com/")
        ) {
          throw new Error("Invalid authorization URL");
        }

        window.location.href = authorizationUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect");
      }
    },
    [getToken],
  );

  /** Disconnect a specific Google Drive account by connection ID. */
  const disconnect = useCallback(
    async (connectionId: string) => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/drive/connection/${connectionId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to disconnect Google Drive");
        }

        // Refresh connections
        await fetchAccounts();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to disconnect");
        throw err;
      }
    },
    [getToken, fetchAccounts],
  );

  // Backward compatibility: synthesize connected/email from first account
  const connected = accounts.length > 0;
  const email = accounts[0]?.email;

  return {
    accounts,
    connected,
    email,
    isLoading,
    error,
    connect,
    disconnect,
    refetch: fetchAccounts,
  };
}
