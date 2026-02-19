import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import type { SourceMaterial } from "./source-material.js";

/**
 * ChapterSourceService - Manages many-to-many linking between chapters and source materials.
 *
 * Links are soft-deletable: when a Drive connection is disconnected, links are
 * set to 'archived' (not deleted). If the user reconnects the same account,
 * links can be restored without the user re-doing their chapter-source associations.
 *
 * All methods enforce ownership via project JOIN to prevent cross-user access.
 */

/** DB row shape for chapter_sources join */
interface ChapterSourceRow {
  id: string;
  chapter_id: string;
  source_id: string;
  status: string;
  sort_order: number;
  created_at: string;
}

/** DB row shape for source_materials (used in getLinkedSources) */
interface SourceRow {
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

function rowToSource(row: SourceRow): SourceMaterial {
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

export class ChapterSourceService {
  constructor(private readonly db: D1Database) {}

  /**
   * Link a source to a chapter.
   * If the link already exists but is archived, reactivates it.
   * Enforces ownership via project JOIN.
   */
  async linkSource(userId: string, chapterId: string, sourceId: string): Promise<void> {
    // Verify chapter ownership and get project_id
    const chapter = await this.db
      .prepare(
        `SELECT ch.id, ch.project_id FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<{ id: string; project_id: string }>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    // Verify source belongs to the same project
    const source = await this.db
      .prepare(
        `SELECT id FROM source_materials
         WHERE id = ? AND project_id = ? AND status != 'archived'`,
      )
      .bind(sourceId, chapter.project_id)
      .first<{ id: string }>();

    if (!source) {
      notFound("Source not found in this project");
    }

    // Get max sort_order for this chapter's links
    const maxSort = await this.db
      .prepare(
        `SELECT MAX(sort_order) as max_sort FROM chapter_sources
         WHERE chapter_id = ? AND status = 'active'`,
      )
      .bind(chapterId)
      .first<{ max_sort: number | null }>();

    const sortOrder = (maxSort?.max_sort || 0) + 1;
    const id = ulid();
    const now = new Date().toISOString();

    // Upsert: insert new or reactivate archived link
    await this.db
      .prepare(
        `INSERT INTO chapter_sources (id, chapter_id, source_id, status, sort_order, created_at)
         VALUES (?, ?, ?, 'active', ?, ?)
         ON CONFLICT (chapter_id, source_id) DO UPDATE SET
           status = 'active',
           sort_order = excluded.sort_order`,
      )
      .bind(id, chapterId, sourceId, sortOrder, now)
      .run();
  }

  /**
   * Unlink a source from a chapter (soft-archive).
   * Sets status to 'archived' rather than deleting, so reconnection can restore.
   */
  async unlinkSource(userId: string, chapterId: string, sourceId: string): Promise<void> {
    // Verify chapter ownership
    const chapter = await this.db
      .prepare(
        `SELECT ch.id FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<{ id: string }>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    await this.db
      .prepare(
        `UPDATE chapter_sources SET status = 'archived'
         WHERE chapter_id = ? AND source_id = ?`,
      )
      .bind(chapterId, sourceId)
      .run();
  }

  /**
   * Get all active linked sources for a chapter.
   * Returns full source material metadata for each linked source.
   */
  async getLinkedSources(userId: string, chapterId: string): Promise<SourceMaterial[]> {
    // Verify chapter ownership
    const chapter = await this.db
      .prepare(
        `SELECT ch.id FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<{ id: string }>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    const result = await this.db
      .prepare(
        `SELECT sm.* FROM source_materials sm
         JOIN chapter_sources cs ON cs.source_id = sm.id
         WHERE cs.chapter_id = ? AND cs.status = 'active' AND sm.status != 'archived'
         ORDER BY cs.sort_order ASC`,
      )
      .bind(chapterId)
      .all<SourceRow>();

    return (result.results ?? []).map(rowToSource);
  }

  /**
   * Restore archived chapter-source links for a reconnected Drive connection.
   * When a user reconnects the same Google account, their previously-archived
   * chapter-source associations can be restored.
   *
   * @returns Number of links restored
   */
  async restoreLinks(connectionId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `UPDATE chapter_sources SET status = 'active'
         WHERE status = 'archived' AND source_id IN (
           SELECT id FROM source_materials WHERE drive_connection_id = ? AND status = 'active'
         )`,
      )
      .bind(connectionId)
      .run();

    return result.meta.changes;
  }
}
