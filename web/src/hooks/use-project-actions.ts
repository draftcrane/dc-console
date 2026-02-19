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
  /** Required for delete/Drive features; omit when used on dashboard */
  projectId?: string;
  /** Drive file-listing hook's fetchFiles fn */
  fetchDriveFiles?: (folderId: string) => void;
  /** Drive file-listing hook's reset fn */
  resetDriveFiles?: () => void;
  /** Drive status hook's connect fn */
  connectDrive?: () => void;
  /** Current project's driveFolderId (for opening Drive files sheet) */
  driveFolderId?: string | null;
}

/**
 * Encapsulates project-level actions: list, rename, duplicate, delete,
 * Drive files sheet, and disconnect Drive dialog state.
 *
 * Used by the editor page to centralise state that was previously inline.
 */
export function useProjectActions({
  getToken,
  projectId,
  fetchDriveFiles,
  resetDriveFiles,
  connectDrive,
  driveFolderId,
}: UseProjectActionsOptions) {
  const router = useRouter();

  // Project list
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Rename
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Duplicate
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Delete (US-023)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Drive files sheet (US-007)
  const [driveFilesOpen, setDriveFilesOpen] = useState(false);

  // Connect Project to Drive
  const [isConnectingDrive, setIsConnectingDrive] = useState(false); // NEW STATE

  // Disconnect Drive dialog (US-008)
  const [disconnectDriveDialogOpen, setDisconnectDriveDialogOpen] = useState(false);

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

  // --- Drive files sheet (US-007) ---
  const openDriveFiles = useCallback(() => {
    setDriveFilesOpen(true); // Always open the sheet
    if (driveFolderId && fetchDriveFiles) {
      fetchDriveFiles(driveFolderId); // Only fetch files if connected
    }
  }, [driveFolderId, fetchDriveFiles]);

  const closeDriveFiles = useCallback(() => {
    setDriveFilesOpen(false);
    resetDriveFiles?.();
  }, [resetDriveFiles]);

  const refreshDriveFiles = useCallback(() => {
    if (!driveFolderId || !fetchDriveFiles) return;
    fetchDriveFiles(driveFolderId);
  }, [driveFolderId, fetchDriveFiles]);

  /**
   * Connect Drive with project context (US-006).
   * Stores the project ID in sessionStorage so the Drive success page
   * can auto-create the book folder after OAuth completes.
   */
  const connectDriveWithProject = useCallback(() => {
    if (!projectId) return;
    sessionStorage.setItem("dc_pending_drive_project", projectId);
    connectDrive?.();
  }, [projectId, connectDrive]);

  // --- Disconnect Drive dialog (US-008) ---
  const openDisconnectDriveDialog = useCallback(() => setDisconnectDriveDialogOpen(true), []);
  const closeDisconnectDriveDialog = useCallback(() => setDisconnectDriveDialogOpen(false), []);

  // Connect Project to Drive
  const onConnectProjectToDrive = useCallback(async () => {
    if (!projectId || !fetchDriveFiles) return;
    setIsConnectingDrive(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/connect-drive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to connect project to Google Drive");
      }

      const result = await response.json();
      const newDriveFolderId = result.driveFolderId;

      // Refresh the Drive files list using the newly created folder ID
      if (newDriveFolderId) {
        fetchDriveFiles(newDriveFolderId);
      } else {
        console.warn("connect-drive API did not return driveFolderId");
      }
    } catch (err) {
      console.error("Failed to connect project to Drive:", err);
    } finally {
      setIsConnectingDrive(false);
    }
  }, [getToken, projectId, fetchDriveFiles]);

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

    deleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    handleDeleteProject,

    driveFilesOpen,
    openDriveFiles,
    closeDriveFiles,
    refreshDriveFiles,
    connectDriveWithProject,

    isConnectingDrive, // EXPOSED
    onConnectProjectToDrive, // EXPOSED

    disconnectDriveDialogOpen,
    openDisconnectDriveDialog,
    closeDisconnectDriveDialog,
  };
}
