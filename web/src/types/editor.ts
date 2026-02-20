/**
 * Shared types for the editor page and its sub-components.
 *
 * These were previously duplicated across page.tsx and multiple hooks.
 * Centralising them here avoids drift and makes refactors safer.
 */

export interface Chapter {
  id: string;
  title: string;
  sortOrder: number;
  wordCount: number;
  version: number;
  status: string;
}

/**
 * Shape returned by GET /projects/:projectId.
 * The API returns a flat object with project fields + chapters array,
 * NOT a nested { project, chapters } structure.
 */
export interface ProjectData {
  id: string;
  title: string;
  description?: string;
  driveFolderId?: string | null;
  driveConnectionId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  chapters: Chapter[];
}
