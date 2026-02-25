"use client";

import { useRouter } from "next/navigation";
import type { ProjectData } from "@/types/editor";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import { RenameProjectDialog } from "@/components/project/rename-project-dialog";
import { DuplicateProjectDialog } from "@/components/project/duplicate-project-dialog";
import { DeleteChapterDialog } from "@/components/project/delete-chapter-dialog";

interface EditorDialogsProps {
  projectData: ProjectData | null;
  projectId: string;

  // Delete project
  deleteDialogOpen: boolean;
  onDeleteProject: () => Promise<void>;
  onCloseDeleteDialog: () => void;

  // Rename project
  renameDialogOpen: boolean;
  onRenameProject: (projectId: string, newTitle: string) => Promise<boolean>;
  onCloseRenameDialog: () => void;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData | null>>;

  // Duplicate project
  duplicateDialogOpen: boolean;
  onDuplicateProject: (projectId: string) => Promise<string | null>;
  onCloseDuplicateDialog: () => void;

  // Delete chapter
  deleteChapterDialogOpen: boolean;
  chapterToDelete: string | null;
  onDeleteChapter: () => Promise<void>;
  onCloseDeleteChapterDialog: () => void;
}

/**
 * EditorDialogs - All modal dialogs and sheet overlays for the editor page.
 *
 * Extracted to keep the page orchestrator focused on layout and state wiring.
 * Each dialog/sheet is a controlled component receiving open/close state from the parent.
 *
 * Source management is handled by the SourcesPanel via the SourcesProvider context.
 * Drive backup config is handled by the SettingsMenu (2-state: setup vs open/unlink).
 * Account management is handled by the SourcesSection within the Sources panel.
 */
export function EditorDialogs({
  projectData,
  projectId,
  deleteDialogOpen,
  onDeleteProject,
  onCloseDeleteDialog,
  renameDialogOpen,
  onRenameProject,
  onCloseRenameDialog,
  setProjectData,
  duplicateDialogOpen,
  onDuplicateProject,
  onCloseDuplicateDialog,
  deleteChapterDialogOpen,
  chapterToDelete,
  onDeleteChapter,
  onCloseDeleteChapterDialog,
}: EditorDialogsProps) {
  const router = useRouter();

  return (
    <>
      {/* Delete project confirmation dialog (US-023) */}
      <DeleteProjectDialog
        projectTitle={projectData?.title || ""}
        isOpen={deleteDialogOpen}
        onConfirm={onDeleteProject}
        onCancel={onCloseDeleteDialog}
      />

      {/* Rename book dialog */}
      <RenameProjectDialog
        isOpen={renameDialogOpen}
        projectTitle={projectData?.title || ""}
        onConfirm={async (newTitle) => {
          const success = await onRenameProject(projectId, newTitle);
          if (success) {
            setProjectData((prev) => (prev ? { ...prev, title: newTitle } : prev));
            onCloseRenameDialog();
          }
        }}
        onCancel={onCloseRenameDialog}
      />

      {/* Duplicate book confirmation dialog */}
      <DuplicateProjectDialog
        isOpen={duplicateDialogOpen}
        projectTitle={projectData?.title || ""}
        onConfirm={async () => {
          const newProjectId = await onDuplicateProject(projectId);
          onCloseDuplicateDialog();
          if (newProjectId) {
            router.push(`/editor/${newProjectId}`);
          }
        }}
        onCancel={onCloseDuplicateDialog}
      />

      {/* Delete chapter confirmation dialog (US-014) */}
      <DeleteChapterDialog
        chapterTitle={
          projectData?.chapters.find((ch) => ch.id === chapterToDelete)?.title || "Untitled Chapter"
        }
        isOpen={deleteChapterDialogOpen}
        onConfirm={onDeleteChapter}
        onCancel={onCloseDeleteChapterDialog}
      />
    </>
  );
}
