"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ProjectData } from "@/types/editor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface UseEditorProjectOptions {
  projectId: string;
  getToken: () => Promise<string | null>;
}

interface UseEditorProjectReturn {
  projectData: ProjectData | null;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData | null>>;
  activeChapterId: string | null;
  setActiveChapterId: (id: string | null) => void;
  isLoading: boolean;
  error: string | null;
  fetchProjectData: () => Promise<void>;
  handleProjectConnected: (driveFolderId: string) => Promise<void>;
  handleProjectDisconnected: () => Promise<void>;
}

/**
 * Manages project data fetching, active chapter selection, and Drive connection callbacks.
 *
 * Extracted from EditorPage to reduce the orchestrator's responsibility surface.
 */
export function useEditorProject({
  projectId,
  getToken,
}: UseEditorProjectOptions): UseEditorProjectReturn {
  const router = useRouter();

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to track activeChapterId to avoid re-creating fetchProjectData
  // every time activeChapterId changes (which would cause an infinite loop
  // via the useEffect that triggers fetchProjectData).
  const activeChapterIdRef = useRef(activeChapterId);
  useEffect(() => {
    activeChapterIdRef.current = activeChapterId;
  }, [activeChapterId]);

  const fetchProjectData = useCallback(async () => {
    try {
      const token = await getToken();

      const projectResponse = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!projectResponse.ok) {
        if (projectResponse.status === 404) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Failed to load project");
      }

      const data: ProjectData = await projectResponse.json();
      setProjectData(data);

      if (data.chapters.length > 0 && !activeChapterIdRef.current) {
        const sortedChapters = [...data.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
        setActiveChapterId(sortedChapters[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, projectId, router]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleProjectConnected = useCallback(
    async (driveFolderId: string) => {
      // Optimistically reflect connection in the current view.
      // Note: driveConnectionId is not available from the connect-drive API response,
      // so it will be populated when fetchProjectData() completes below.
      setProjectData((prev) => (prev ? { ...prev, driveFolderId } : prev));
      // Then refresh canonical server state (populates driveConnectionId).
      await fetchProjectData();
    },
    [fetchProjectData],
  );

  const handleProjectDisconnected = useCallback(async () => {
    setProjectData((prev) =>
      prev ? { ...prev, driveFolderId: null, driveConnectionId: null } : prev,
    );
    await fetchProjectData();
  }, [fetchProjectData]);

  return {
    projectData,
    setProjectData,
    activeChapterId,
    setActiveChapterId,
    isLoading,
    error,
    fetchProjectData,
    handleProjectConnected,
    handleProjectDisconnected,
  };
}
