"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  /** Required for delete features; omit when used on dashboard */
  projectId?: string;
}

/**
 * Encapsulates project-level actions: list, rename, duplicate, delete.
 *
 * Used by the editor page to centralise state that was previously inline.
 */
export function useProjectActions({ getToken, projectId }: UseProjectActionsOptions) {
  const router = useRouter();

  // Project list
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Rename
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Duplicate
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Delete (US-023)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setProjectsError(body?.error || "Failed to load projects");
        return;
      }

      const data = (await response.json()) as { projects: ProjectSummary[] };
      setProjects(data.projects);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      setProjectsError("Failed to load projects");
    } finally {
      setIsLoadingProjects(false);
    }
  }, [getToken]);

  // Fetch project list on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // --- Rename ---
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

  // --- Duplicate ---
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

  // --- Delete (US-023) ---
  const openDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);
  const closeDeleteDialog = useCallback(() => setDeleteDialogOpen(false), []);

  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      // Check if user has other projects to determine redirect target
      const meResponse = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (meResponse.ok) {
        const meData = (await meResponse.json()) as { projects: { id: string }[] };
        if (meData.projects.length > 0) {
          router.push("/dashboard");
        } else {
          router.push("/setup");
        }
      } else {
        // Fallback: redirect to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
      setDeleteDialogOpen(false);
    }
  }, [getToken, projectId, router]);

  return {
    projects,
    isLoadingProjects,
    projectsError,
    clearProjectsError: () => setProjectsError(null),
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

    deleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    handleDeleteProject,
  };
}
