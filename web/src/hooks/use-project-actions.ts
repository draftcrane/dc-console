"use client";

import { useState, useCallback, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  wordCount: number;
  chapterCount: number;
  updatedAt: string;
}

interface UseProjectActionsOptions {
  getToken: () => Promise<string | null>;
}

/**
 * Encapsulates project-level actions: list, rename, duplicate.
 * Used by both the editor (ProjectSwitcher, settings menu) and dashboard.
 */
export function useProjectActions({ getToken }: UseProjectActionsOptions) {
  // Project list
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Rename
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Duplicate
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = (await response.json()) as { projects: ProjectSummary[] };
        setProjects(data.projects);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [getToken]);

  // Fetch project list on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const openRenameDialog = useCallback(() => setRenameDialogOpen(true), []);
  const closeRenameDialog = useCallback(() => setRenameDialogOpen(false), []);

  const renameProject = useCallback(
    async (targetProjectId: string, newTitle: string): Promise<boolean> => {
      setIsRenaming(true);
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${targetProjectId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!response.ok) {
          return false;
        }

        // Update local project list
        setProjects((prev) =>
          prev.map((p) => (p.id === targetProjectId ? { ...p, title: newTitle } : p)),
        );

        return true;
      } catch (err) {
        console.error("Failed to rename project:", err);
        return false;
      } finally {
        setIsRenaming(false);
      }
    },
    [getToken],
  );

  const openDuplicateDialog = useCallback(() => setDuplicateDialogOpen(true), []);
  const closeDuplicateDialog = useCallback(() => setDuplicateDialogOpen(false), []);

  const duplicateProject = useCallback(
    async (targetProjectId: string): Promise<string | null> => {
      setIsDuplicating(true);
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/projects/${targetProjectId}/duplicate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 422) {
            const body = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            console.error("Duplicate failed:", body?.error);
          }
          return null;
        }

        const result = (await response.json()) as { id: string };

        // Refresh project list so new copy appears
        await fetchProjects();

        return result.id;
      } catch (err) {
        console.error("Failed to duplicate project:", err);
        return null;
      } finally {
        setIsDuplicating(false);
      }
    },
    [getToken, fetchProjects],
  );

  return {
    projects,
    isLoadingProjects,
    fetchProjects,

    renameDialogOpen,
    openRenameDialog,
    closeRenameDialog,
    renameProject,
    isRenaming,

    duplicateDialogOpen,
    openDuplicateDialog,
    closeDuplicateDialog,
    duplicateProject,
    isDuplicating,
  };
}
