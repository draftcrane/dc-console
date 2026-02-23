import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ExportPreference {
  id: string;
  projectId: string;
  userId: string;
  destinationType: "device" | "drive";
  driveConnectionId: string | null;
  driveFolderId: string | null;
  driveFolderPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportPreferenceInput {
  destinationType: "device" | "drive";
  driveConnectionId?: string;
  driveFolderId?: string;
  driveFolderPath?: string;
}

export function useExportPreferences(projectId: string) {
  const { getToken } = useAuth();
  const [preference, setPreference] = useState<ExportPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPreference = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/projects/${projectId}/export-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setPreference(null);
        return;
      }

      const data = (await response.json()) as { preference: ExportPreference | null };
      setPreference(data.preference);
    } catch {
      setPreference(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, getToken]);

  useEffect(() => {
    fetchPreference();
  }, [fetchPreference]);

  const save = useCallback(
    async (input: ExportPreferenceInput) => {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/projects/${projectId}/export-preferences`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (response.ok) {
        const data = (await response.json()) as { preference: ExportPreference };
        setPreference(data.preference);
      }
    },
    [projectId, getToken],
  );

  const clear = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const response = await fetch(`${API_URL}/projects/${projectId}/export-preferences`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      setPreference(null);
    }
  }, [projectId, getToken]);

  return { preference, isLoading, save, clear, refetch: fetchPreference };
}
