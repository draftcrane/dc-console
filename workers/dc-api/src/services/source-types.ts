/**
 * Shared types and helpers for source material services.
 *
 * Extracted from source-material.ts so that source-local.ts and source-drive.ts
 * can share these without circular dependencies.
 */

/** Input for adding Drive sources from Google Picker selection */
export interface AddSourceInput {
  driveFileId: string;
  title: string;
  mimeType: string;
}

export interface AddSourcesResult {
  sources: SourceMaterial[];
  expandedCounts?: {
    selectedFolders: number;
    docsDiscovered: number;
    docsInserted: number;
  };
}

/** Source material as returned to the API */
export interface SourceMaterial {
  id: string;
  projectId: string;
  sourceType: "drive" | "local";
  driveConnectionId: string | null;
  driveFileId: string | null;
  title: string;
  mimeType: string;
  originalFilename: string | null;
  driveModifiedTime: string | null;
  wordCount: number;
  r2Key: string | null;
  cachedAt: string | null;
  status: "active" | "archived" | "error";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Result of fetching source content */
export interface SourceContentResult {
  content: string;
  wordCount: number;
  cachedAt: string;
}

/** Result of importing a source as a chapter */
export interface ImportAsChapterResult {
  chapterId: string;
  title: string;
  wordCount: number;
}

/** DB row shape */
export interface SourceRow {
  id: string;
  project_id: string;
  source_type: string;
  drive_connection_id: string | null;
  drive_file_id: string | null;
  title: string;
  mime_type: string;
  original_filename: string | null;
  content_hash: string | null;
  drive_modified_time: string | null;
  word_count: number;
  r2_key: string | null;
  cached_at: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Convert a D1 row to the public SourceMaterial shape */
export function rowToSource(row: SourceRow): SourceMaterial {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceType: row.source_type as SourceMaterial["sourceType"],
    driveConnectionId: row.drive_connection_id,
    driveFileId: row.drive_file_id,
    title: row.title,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    driveModifiedTime: row.drive_modified_time,
    wordCount: row.word_count,
    r2Key: row.r2_key,
    cachedAt: row.cached_at,
    status: row.status as SourceMaterial["status"],
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
