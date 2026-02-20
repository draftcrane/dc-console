"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useCallback, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ProjectSourceConnection {
  id: string;
  driveConnectionId: string;
  email: string;
  connectedAt: string;
  documentCount: number;
}

/**
 * Hook to manage Drive connections scoped to a specific project.
 * Replaces useDriveAccounts() in the main Sources tab view.
 * useDriveAccounts() should only be called in the Link Source sub-view.
 */
export function useProjectSourceConnections(projectId: string) {
  const { getToken } = useAuth();
  const [connections, setConnections] = useState<ProjectSourceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/source-connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg = (data as { error?: string } | null)?.error;
        throw new Error(msg || `Failed to fetch source connections (${response.status})`);
      }
      const data = await response.json();
      setConnections(data.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load source connections");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, projectId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const linkConnection = useCallback(
    async (driveConnectionId: string) => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${projectId}/source-connections`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ driveConnectionId }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            (data as { error?: string } | null)?.error || "Failed to link connection",
          );
        }
        await fetchConnections();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to link connection");
      }
    },
    [getToken, projectId, fetchConnections],
  );

  const unlinkConnection = useCallback(
    async (driveConnectionId: string) => {
      try {
        setError(null);
        const token = await getToken();
        const response = await fetch(
          `${API_URL}/projects/${projectId}/source-connections/${driveConnectionId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            (data as { error?: string } | null)?.error || "Failed to unlink connection",
          );
        }
        await fetchConnections();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to unlink connection");
      }
    },
    [getToken, projectId, fetchConnections],
  );

  return {
    connections,
    isLoading,
    error,
    fetchConnections,
    linkConnection,
    unlinkConnection,
  };
}
