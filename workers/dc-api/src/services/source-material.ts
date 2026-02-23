/**
 * Source material service facade -- composes SourceDriveService, SourceLocalService,
 * and CRUD operations.
 *
 * This module preserves the original SourceMaterialService public API so that route
 * files and test files do not need import changes. Internally, responsibilities
 * are delegated to focused sub-services:
 *
 *   - source-types.ts  -- Shared types and row-to-model mapping
 *   - source-drive.ts  -- Drive source addition, folder expansion, content fetching
 *   - source-local.ts  -- Local file upload and conversion
 *
 * CRUD operations (list, get, remove, importAsChapter, getContent) remain in this
 * file as they are lightweight and cross-cutting.
 *
 * Re-exports all public types from sub-modules for backward compatibility.
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { countWords } from "../utils/word-count.js";
import type { DriveService } from "./drive.js";
import { SourceDriveService } from "./source-drive.js";
import { SourceLocalService } from "./source-local.js";
import {
  htmlToPlainText,
  removeFtsEntry,
  sanitizeSourceHtml,
  storeExtractionResult,
} from "./text-extraction.js";
import {
  type AddSourceInput,
  type AddSourcesResult,
  type SourceMaterial,
  type SourceContentResult,
  type ImportAsChapterResult,
  type SourceRow,
  rowToSource,
} from "./source-types.js";

// ── Project Source Connection types ──

export interface ProjectSourceConnection {
  id: string;
  driveConnectionId: string;
  email: string;
  connectedAt: string;
  documentCount: number;
}

export interface MarkdownRemediationResult {
  candidateCount: number;
  processedCount: number;
  missingCacheCount: number;
}

// Re-export public types so existing imports from "./source-material.js" still work
export type {
  AddSourceInput,
  AddSourcesResult,
  SourceMaterial,
  SourceContentResult,
  ImportAsChapterResult,
} from "./source-types.js";

export class SourceMaterialService {
  private readonly driveService: SourceDriveService;
  private readonly localService: SourceLocalService;

  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
  ) {
    this.driveService = new SourceDriveService(db, bucket);
    this.localService = new SourceLocalService(db, bucket);
  }

  // ── Drive sources (delegated to SourceDriveService) ──

  addSources(
    userId: string,
    projectId: string,
    files: AddSourceInput[],
    driveService?: DriveService,
    connectionId?: string,
  ): Promise<AddSourcesResult> {
    return this.driveService.addSources(userId, projectId, files, driveService, connectionId);
  }

  archiveByConnection(connectionId: string): Promise<void> {
    return this.driveService.archiveByConnection(connectionId);
  }

  // ── Local sources (delegated to SourceLocalService) ──

  addLocalSource(
    userId: string,
    projectId: string,
    file: { name: string; content: ArrayBuffer },
  ): Promise<SourceMaterial> {
    return this.localService.addLocalSource(userId, projectId, file);
  }

  // ── CRUD operations ──

  /**
   * List source materials for a project.
   * Ownership enforced via project JOIN.
   */
  async listSources(userId: string, projectId: string): Promise<SourceMaterial[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const result = await this.db
      .prepare(
        `SELECT sm.* FROM source_materials sm
         WHERE sm.project_id = ? AND sm.status != 'archived'
         ORDER BY sm.sort_order ASC`,
      )
      .bind(projectId)
      .all<SourceRow>();

    return (result.results ?? []).map(rowToSource);
  }

  /**
   * Get a single source material with ownership check.
   */
  async getSource(userId: string, sourceId: string): Promise<SourceMaterial> {
    const row = await this.db
      .prepare(
        `SELECT sm.* FROM source_materials sm
         JOIN projects p ON p.id = sm.project_id
         WHERE sm.id = ? AND p.user_id = ? AND sm.status != 'archived'`,
      )
      .bind(sourceId, userId)
      .first<SourceRow>();

    if (!row) {
      notFound("Source not found");
    }

    return rowToSource(row);
  }

  /**
   * Get source content. Lazy-fetches from Google Drive on first access (for Drive sources).
   * For local sources, always reads from R2.
   */
  async getContent(
    userId: string,
    sourceId: string,
    driveApi: DriveService,
  ): Promise<SourceContentResult> {
    const source = await this.getSource(userId, sourceId);

    // If already cached, read from R2 (both drive and local sources)
    if (source.cachedAt && source.status === "active") {
      const r2Key = source.r2Key || `sources/${sourceId}/content.html`;
      const object = await this.bucket.get(r2Key);
      if (object) {
        const content = await object.text();
        return {
          content,
          wordCount: source.wordCount,
          cachedAt: source.cachedAt,
        };
      }
      // R2 object missing -- fall through to re-fetch (Drive only)
    }

    // Local sources must have cached content (uploaded at creation time)
    if (source.sourceType === "local") {
      throw new Error("Local source content not found in R2");
    }

    // Fetch from Drive, sanitize, cache, and index in FTS
    return this.driveService.fetchAndCache(
      userId,
      sourceId,
      source.driveFileId!,
      source.driveConnectionId,
      driveApi,
      source.title,
      source.mimeType,
    );
  }

  /**
   * Remove a source material (soft delete).
   * Fire-and-forget R2 cleanup. Removes FTS index entry.
   */
  async removeSource(userId: string, sourceId: string): Promise<void> {
    // Verify ownership
    const source = await this.getSource(userId, sourceId);

    await this.db
      .prepare(`UPDATE source_materials SET status = 'archived', updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), sourceId)
      .run();

    // Remove FTS index entry
    await removeFtsEntry(sourceId, this.db);

    // Fire-and-forget R2 cleanup
    if (source.cachedAt) {
      Promise.all([
        this.bucket.delete(`sources/${sourceId}/content.html`),
        this.bucket.delete(`sources/${sourceId}/content.txt`),
      ]).catch(() => {
        // Non-critical -- orphaned R2 objects are harmless
      });
    }
  }

  /**
   * Import a source as a new chapter.
   * Creates chapter in D1, writes content to R2.
   * Returns chapter metadata for Drive file creation (fire-and-forget in route handler).
   */
  async importAsChapter(
    userId: string,
    sourceId: string,
    driveApi: DriveService,
  ): Promise<ImportAsChapterResult & { projectId: string; r2Key: string }> {
    const source = await this.getSource(userId, sourceId);

    // Get content -- from cache or Drive
    const { content, wordCount } = await this.getContent(userId, sourceId, driveApi);

    // Get max sort_order for chapters in this project
    const maxSort = await this.db
      .prepare(`SELECT MAX(sort_order) as max_sort FROM chapters WHERE project_id = ?`)
      .bind(source.projectId)
      .first<{ max_sort: number | null }>();

    const sortOrder = (maxSort?.max_sort || 0) + 1;
    const chapterId = ulid();
    const now = new Date().toISOString();
    const r2Key = `chapters/${chapterId}/content.html`;

    // Write content to R2 (chapter content location)
    await this.bucket.put(r2Key, content, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
      customMetadata: { chapterId, version: "1", updatedAt: now },
    });

    // Create chapter row in D1
    await this.db
      .prepare(
        `INSERT INTO chapters (id, project_id, title, sort_order, r2_key, word_count, version, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'draft', ?, ?)`,
      )
      .bind(chapterId, source.projectId, source.title, sortOrder, r2Key, wordCount, now, now)
      .run();

    // Update project updated_at
    await this.db
      .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
      .bind(now, source.projectId)
      .run();

    return {
      chapterId,
      title: source.title,
      wordCount,
      projectId: source.projectId,
      r2Key,
    };
  }

  /**
   * Restore a previously archived source (undo remove).
   * Sets status back to 'active' and re-indexes FTS from R2 plain text.
   */
  async restoreSource(userId: string, sourceId: string): Promise<SourceMaterial> {
    // Verify ownership — must be archived (not permanently deleted)
    const row = await this.db
      .prepare(
        `SELECT sm.* FROM source_materials sm
         JOIN projects p ON p.id = sm.project_id
         WHERE sm.id = ? AND p.user_id = ? AND sm.status = 'archived'`,
      )
      .bind(sourceId, userId)
      .first<SourceRow>();

    if (!row) {
      notFound("Archived source not found");
    }

    const now = new Date().toISOString();
    await this.db
      .prepare(`UPDATE source_materials SET status = 'active', updated_at = ? WHERE id = ?`)
      .bind(now, sourceId)
      .run();

    // Re-index FTS from R2 plain text if content was cached
    if (row.cached_at) {
      const txtKey = `sources/${sourceId}/content.txt`;
      const object = await this.bucket.get(txtKey);
      if (object) {
        const plainText = await object.text();
        await this.db.batch([
          this.db.prepare(`DELETE FROM source_content_fts WHERE source_id = ?`).bind(sourceId),
          this.db
            .prepare(`INSERT INTO source_content_fts (source_id, title, content) VALUES (?, ?, ?)`)
            .bind(sourceId, row.title, plainText),
        ]);
      }
    }

    return rowToSource({ ...row, status: "active", updated_at: now });
  }

  /**
   * Reprocess cached local Markdown sources to strip unsafe HTML and rebuild FTS text.
   * This remediates legacy caches created before Markdown escaping hardening.
   */
  async remediateLocalMarkdownSources(
    userId: string,
    projectId: string,
  ): Promise<MarkdownRemediationResult> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const sourcesResult = await this.db
      .prepare(
        `SELECT id, title, r2_key
         FROM source_materials
         WHERE project_id = ?
           AND source_type = 'local'
           AND mime_type = 'text/markdown'
           AND status = 'active'
         ORDER BY sort_order ASC`,
      )
      .bind(projectId)
      .all<{ id: string; title: string; r2_key: string | null }>();

    const sources = sourcesResult.results ?? [];
    let processedCount = 0;
    let missingCacheCount = 0;

    for (const source of sources) {
      const htmlKey = source.r2_key || `sources/${source.id}/content.html`;
      const object = await this.bucket.get(htmlKey);
      if (!object) {
        missingCacheCount++;
        continue;
      }

      const html = await object.text();
      const sanitizedHtml = sanitizeSourceHtml(html);
      const plainText = htmlToPlainText(sanitizedHtml);
      const wordCount = countWords(sanitizedHtml);

      const { r2Key, cachedAt } = await storeExtractionResult(
        source.id,
        source.title,
        { html: sanitizedHtml, plainText, wordCount },
        this.bucket,
        this.db,
      );

      await this.db
        .prepare(
          `UPDATE source_materials
           SET r2_key = ?, word_count = ?, cached_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(r2Key, wordCount, cachedAt, cachedAt, source.id)
        .run();

      processedCount++;
    }

    return {
      candidateCount: sources.length,
      processedCount,
      missingCacheCount,
    };
  }

  // ── Project Source Connections ──

  /**
   * List Drive connections linked to a project for research input.
   * Includes document count per connection.
   */
  async listProjectConnections(
    userId: string,
    projectId: string,
  ): Promise<ProjectSourceConnection[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const result = await this.db
      .prepare(
        `SELECT psc.id, psc.drive_connection_id, dc.drive_email, psc.created_at,
                (SELECT COUNT(*) FROM source_materials sm
                 WHERE sm.project_id = ? AND sm.drive_connection_id = psc.drive_connection_id
                   AND sm.status != 'archived') as document_count
         FROM project_source_connections psc
         JOIN drive_connections dc ON dc.id = psc.drive_connection_id
         WHERE psc.project_id = ? AND dc.user_id = ?
         ORDER BY psc.created_at ASC`,
      )
      .bind(projectId, projectId, userId)
      .all<{
        id: string;
        drive_connection_id: string;
        drive_email: string;
        created_at: string;
        document_count: number;
      }>();

    return (result.results ?? []).map((row) => ({
      id: row.id,
      driveConnectionId: row.drive_connection_id,
      email: row.drive_email,
      connectedAt: row.created_at,
      documentCount: row.document_count,
    }));
  }

  /**
   * Link a Drive connection to a project for research input.
   * Validates that the connection belongs to the user.
   */
  async linkConnection(
    userId: string,
    projectId: string,
    driveConnectionId: string,
  ): Promise<ProjectSourceConnection> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Verify connection belongs to user
    const connection = await this.db
      .prepare(`SELECT id, drive_email FROM drive_connections WHERE id = ? AND user_id = ?`)
      .bind(driveConnectionId, userId)
      .first<{ id: string; drive_email: string }>();

    if (!connection) {
      notFound("Drive connection not found");
    }

    const id = ulid();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT OR IGNORE INTO project_source_connections (id, project_id, drive_connection_id, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(id, projectId, driveConnectionId, now)
      .run();

    // Fetch the actual row (may be pre-existing due to OR IGNORE)
    const row = await this.db
      .prepare(
        `SELECT psc.id, psc.drive_connection_id, dc.drive_email, psc.created_at
         FROM project_source_connections psc
         JOIN drive_connections dc ON dc.id = psc.drive_connection_id
         WHERE psc.project_id = ? AND psc.drive_connection_id = ?`,
      )
      .bind(projectId, driveConnectionId)
      .first<{
        id: string;
        drive_connection_id: string;
        drive_email: string;
        created_at: string;
      }>();

    return {
      id: row!.id,
      driveConnectionId: row!.drive_connection_id,
      email: row!.drive_email,
      connectedAt: row!.created_at,
      documentCount: 0,
    };
  }

  /**
   * Unlink a Drive connection from a project.
   * Archives all source_materials for that project+connection and removes FTS entries.
   */
  async unlinkConnection(
    userId: string,
    projectId: string,
    driveConnectionId: string,
  ): Promise<void> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Delete the project_source_connections row
    await this.db
      .prepare(
        `DELETE FROM project_source_connections
         WHERE project_id = ? AND drive_connection_id = ?`,
      )
      .bind(projectId, driveConnectionId)
      .run();

    // Archive source_materials for this project+connection
    const sourcesToArchive = await this.db
      .prepare(
        `SELECT id FROM source_materials
         WHERE project_id = ? AND drive_connection_id = ? AND status != 'archived'`,
      )
      .bind(projectId, driveConnectionId)
      .all<{ id: string }>();

    const now = new Date().toISOString();

    if (sourcesToArchive.results && sourcesToArchive.results.length > 0) {
      await this.db
        .prepare(
          `UPDATE source_materials SET status = 'archived', updated_at = ?
           WHERE project_id = ? AND drive_connection_id = ? AND status != 'archived'`,
        )
        .bind(now, projectId, driveConnectionId)
        .run();

      // Remove FTS entries for archived sources
      for (const source of sourcesToArchive.results) {
        await removeFtsEntry(source.id, this.db);
      }
    }
  }
}
