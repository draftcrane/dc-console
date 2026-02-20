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
import { removeFtsEntry } from "./text-extraction.js";
import {
  type AddSourceInput,
  type AddSourcesResult,
  type SourceMaterial,
  type SourceContentResult,
  type ImportAsChapterResult,
  type SourceRow,
  rowToSource,
} from "./source-types.js";

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
}
