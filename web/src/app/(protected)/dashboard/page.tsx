"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useSignOut } from "@/hooks/use-sign-out";
import { useBackup } from "@/hooks/use-backup";
import { useProjectActions, type ProjectSummary } from "@/hooks/use-project-actions";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Format a date string as relative time ("2 hours ago", "3 days ago", etc.)
 */
function relativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Dashboard page — project list with card grid.
 *
 * Shows all user books with word counts, chapter counts, and relative timestamps.
 * Each card links to the editor. Overflow menu provides rename, duplicate, delete.
 * Zero-project state shows the original welcome screen with "Create Your First Book".
 */
export default function DashboardPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { handleSignOut, isSigningOut } = useSignOut();
  const { importBackup, isImporting, error: importError } = useBackup();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    projects,
    isLoadingProjects,
    projectsError,
    clearProjectsError,
    fetchProjects,
    renameProject,
    isRenaming,
    duplicateProject,
    isDuplicating,
  } = useProjectActions({ getToken: getToken as () => Promise<string | null> });

  // Card overflow menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Rename dialog state
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Duplicate dialog state
  const [duplicateTarget, setDuplicateTarget] = useState<ProjectSummary | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  // Close overflow menu on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [openMenuId]);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const success = await renameProject(renameTarget.id, renameValue.trim());
    if (success) {
      setRenameTarget(null);
    }
  }, [renameTarget, renameValue, renameProject]);

  const handleDuplicateConfirm = useCallback(async () => {
    if (!duplicateTarget) return;
    const newProjectId = await duplicateProject(duplicateTarget.id);
    setDuplicateTarget(null);
    if (newProjectId) {
      router.push(`/editor/${newProjectId}`);
    }
  }, [duplicateTarget, duplicateProject, router]);

  const handleDeleteProject = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to delete project");
      setDeleteTarget(null);
      await fetchProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
      setDeleteTarget(null);
    }
  }, [deleteTarget, getToken, fetchProjects]);

  // Loading state
  if (isLoadingProjects) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Error state
  if (projectsError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{projectsError}</p>
          <button
            onClick={() => {
              clearProjectsError();
              fetchProjects();
            }}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Zero-project state — preserve original welcome screen exactly
  if (projects.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
            Welcome to DraftCrane
          </h1>
          <p className="text-muted-foreground mb-8">
            A quiet place to write and shape your nonfiction book, chapter by chapter.
          </p>

          <div>
            <Link
              href="/setup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-gray-900 px-8 text-lg font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Create Your First Book
            </Link>
          </div>

          <p className="mt-4 text-sm text-[var(--dc-color-text-placeholder)]">
            Your first chapter will be waiting for you.
          </p>

          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const projectId = await importBackup(file);
                if (projectId) {
                  router.push(`/editor/${projectId}`);
                }
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="text-sm text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-secondary)] transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? "Importing..." : "Import from a backup file"}
            </button>
            {importError && <p className="text-sm text-red-600 mt-1">{importError}</p>}
          </div>

          <div className="mt-8">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-sm text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-secondary)] transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? "Signing out\u2026" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Project card grid
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Your Books</h1>
        <Link
          href="/setup"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          New Book
        </Link>
      </div>

      {/* Card grid: 1 col mobile, 2 cols tablet, 3 cols desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="relative bg-[var(--dc-color-surface-primary)] border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow group"
          >
            {/* Clickable card body */}
            <Link href={`/editor/${project.id}`} className="block min-h-[100px]">
              <h2 className="font-serif text-lg font-semibold text-foreground truncate pr-8">
                {project.title}
              </h2>
              <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {project.chapterCount} {project.chapterCount === 1 ? "chapter" : "chapters"}
                </span>
                <span className="text-[var(--dc-color-border-strong)]">&middot;</span>
                <span className="tabular-nums">{project.wordCount.toLocaleString()} words</span>
              </div>
              <p className="mt-3 text-xs text-[var(--dc-color-text-placeholder)]">
                Last edited {relativeTime(project.updatedAt)}
              </p>
            </Link>

            {/* Overflow menu trigger */}
            <div
              className="absolute top-4 right-4"
              ref={openMenuId === project.id ? menuRef : undefined}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === project.id ? null : project.id);
                }}
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-[var(--dc-color-surface-tertiary)]
                           transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label={`Actions for ${project.title}`}
                aria-haspopup="true"
                aria-expanded={openMenuId === project.id}
              >
                <svg
                  className="w-5 h-5 text-[var(--dc-color-text-muted)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="6" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="18" r="1.5" />
                </svg>
              </button>

              {/* Overflow menu dropdown */}
              {openMenuId === project.id && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-[var(--dc-color-surface-primary)] rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                  role="menu"
                >
                  <button
                    onClick={() => {
                      setOpenMenuId(null);
                      setRenameValue(project.title);
                      setRenameTarget(project);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--dc-color-text-secondary)] hover:bg-[var(--dc-color-surface-tertiary)]
                               transition-colors min-h-[44px] flex items-center gap-2"
                    role="menuitem"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      setOpenMenuId(null);
                      setDuplicateTarget(project);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--dc-color-text-secondary)] hover:bg-[var(--dc-color-surface-tertiary)]
                               transition-colors min-h-[44px] flex items-center gap-2"
                    role="menuitem"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Duplicate
                  </button>
                  <div className="my-1 border-t border-gray-200" role="separator" />
                  <button
                    onClick={() => {
                      setOpenMenuId(null);
                      setDeleteTarget(project);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50
                               transition-colors min-h-[44px] flex items-center gap-2"
                    role="menuitem"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Import from backup — below the grid */}
      <div className="mt-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const projectId = await importBackup(file);
            if (projectId) {
              router.push(`/editor/${projectId}`);
            }
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="text-sm text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-secondary)] transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? "Importing..." : "Import from a backup file"}
        </button>
        {importError && <p className="text-sm text-red-600 mt-1">{importError}</p>}
        <div className="mt-2">
          <Link
            href="/help"
            className="text-sm text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-secondary)] transition-colors"
          >
            Help
          </Link>
        </div>
      </div>

      {/* Rename dialog */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-dialog-title"
        >
          <div className="bg-[var(--dc-color-surface-primary)] rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h2
              id="rename-dialog-title"
              className="text-lg font-semibold text-[var(--dc-color-text-primary)] mb-4"
            >
              Rename Book
            </h2>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenameTarget(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setRenameTarget(null)}
                disabled={isRenaming}
                className="px-4 py-2 text-sm font-medium text-[var(--dc-color-text-secondary)] bg-[var(--dc-color-surface-tertiary)] rounded-lg
                           hover:bg-gray-200 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={isRenaming || !renameValue.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg
                           hover:bg-gray-800 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRenaming ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate confirmation dialog */}
      {duplicateTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-dialog-title"
        >
          <div className="bg-[var(--dc-color-surface-primary)] rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h2
              id="duplicate-dialog-title"
              className="text-lg font-semibold text-[var(--dc-color-text-primary)] mb-2"
            >
              Duplicate Book
            </h2>
            <p className="text-sm text-[var(--dc-color-text-muted)] mb-6">
              Duplicate &ldquo;{duplicateTarget.title}&rdquo;? This creates a full copy of all
              chapters.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDuplicateTarget(null)}
                disabled={isDuplicating}
                className="px-4 py-2 text-sm font-medium text-[var(--dc-color-text-secondary)] bg-[var(--dc-color-surface-tertiary)] rounded-lg
                           hover:bg-gray-200 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicateConfirm}
                disabled={isDuplicating}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg
                           hover:bg-gray-800 transition-colors min-h-[44px]
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDuplicating ? "Duplicating..." : "Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog — reuses existing component */}
      <DeleteProjectDialog
        projectTitle={deleteTarget?.title || ""}
        isOpen={!!deleteTarget}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
