import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { countWords } from "../utils/word-count.js";
import { sanitizeGoogleDocsHtml } from "../utils/html-sanitize.js";
import type { DriveService } from "./drive.js";

/**
 * SourceMaterialService - Manages Google Docs connected as reference material.
 *
 * Users select files via Google Picker; content is exported as HTML,
 * sanitized, and cached in R2. Sources can be viewed within the app
 * or imported as new chapters.
 *
 * R2 key format: sources/{sourceId}/content.html
 * No content stored in D1 — only metadata.
 */

/** Input for adding sources from Google Picker selection */
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
  driveFileId: string;
  title: string;
  mimeType: string;
  driveModifiedTime: string | null;
  wordCount: number;
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
interface SourceRow {
  id: string;
  project_id: string;
  drive_file_id: string;
  title: string;
  mime_type: string;
  drive_modified_time: string | null;
  word_count: number;
  r2_key: string | null;
  cached_at: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const ALLOWED_MIME_TYPE = "application/vnd.google-apps.document";
const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_SOURCES_PER_REQUEST = 20;
const MAX_EXPANDED_DOCS_PER_REQUEST = 200;

function rowToSource(row: SourceRow): SourceMaterial {
  return {
    id: row.id,
    projectId: row.project_id,
    driveFileId: row.drive_file_id,
    title: row.title,
    mimeType: row.mime_type,
    driveModifiedTime: row.drive_modified_time,
    wordCount: row.word_count,
    cachedAt: row.cached_at,
    status: row.status as SourceMaterial["status"],
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SourceMaterialService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
  ) {}

  /**
   * Add source materials from Google Picker selection.
   * Validates mime types (Google Docs only) and deduplicates silently.
   */
  async addSources(
    userId: string,
    projectId: string,
    files: AddSourceInput[],
    driveService?: DriveService,
  ): Promise<AddSourcesResult> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    if (!files || files.length === 0) {
      validationError("At least one file is required");
    }

    if (files.length > MAX_SOURCES_PER_REQUEST) {
      validationError(`Maximum ${MAX_SOURCES_PER_REQUEST} files per request`);
    }

    const selectedDocs = files.filter((f) => f.mimeType === ALLOWED_MIME_TYPE);
    const selectedFolders = files.filter((f) => f.mimeType === GOOGLE_FOLDER_MIME_TYPE);

    // Expand selected folders into Google Docs (recursive).
    let discoveredFromFolders: AddSourceInput[] = [];
    if (selectedFolders.length > 0) {
      if (!driveService) {
        throw new Error("DriveService is required when adding folders as sources");
      }

      const tokens = await driveService.getValidTokens(userId);
      if (!tokens) {
        validationError("Google Drive is not connected. Connect Drive to add folder sources.");
      }

      try {
        const docs = await driveService.listDocsInFoldersRecursive(
          tokens.accessToken,
          selectedFolders.map((f) => f.driveFileId),
          MAX_EXPANDED_DOCS_PER_REQUEST,
        );
        discoveredFromFolders = docs.map((doc) => ({
          driveFileId: doc.id,
          title: doc.name || "Untitled Google Doc",
          mimeType: ALLOWED_MIME_TYPE,
        }));
      } catch (err) {
        if (err instanceof Error && err.message === "MAX_DOCS_EXCEEDED") {
          validationError(`Maximum ${MAX_EXPANDED_DOCS_PER_REQUEST} docs may be imported at once`);
        }
        throw err;
      }
    }

    const docsToInsert = [...selectedDocs, ...discoveredFromFolders];
    const docsById = new Map<string, AddSourceInput>();
    for (const file of docsToInsert) {
      if (!docsById.has(file.driveFileId)) {
        docsById.set(file.driveFileId, file);
      }
    }
    const uniqueDocsToInsert = Array.from(docsById.values());

    // Get current max sort_order
    const maxSort = await this.db
      .prepare(
        `SELECT MAX(sort_order) as max_sort FROM source_materials
         WHERE project_id = ? AND status = 'active'`,
      )
      .bind(projectId)
      .first<{ max_sort: number | null }>();

    let sortOrder = (maxSort?.max_sort || 0) + 1;
    const now = new Date().toISOString();
    const created: SourceMaterial[] = [];

    for (const file of uniqueDocsToInsert) {
      const id = ulid();

      // ON CONFLICT DO NOTHING handles re-selection of existing sources
      const result = await this.db
        .prepare(
          `INSERT INTO source_materials (id, project_id, drive_file_id, title, mime_type, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (project_id, drive_file_id) DO NOTHING`,
        )
        .bind(id, projectId, file.driveFileId, file.title, file.mimeType, sortOrder, now, now)
        .run();

      if (result.meta.changes > 0) {
        created.push({
          id,
          projectId,
          driveFileId: file.driveFileId,
          title: file.title,
          mimeType: file.mimeType,
          driveModifiedTime: null,
          wordCount: 0,
          cachedAt: null,
          status: "active",
          sortOrder,
          createdAt: now,
          updatedAt: now,
        });
        sortOrder++;
      }
    }

    if (selectedFolders.length > 0) {
      return {
        sources: created,
        expandedCounts: {
          selectedFolders: selectedFolders.length,
          docsDiscovered: discoveredFromFolders.length,
          docsInserted: created.length,
        },
      };
    }

    return { sources: created };
  }

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
   * Get source content. Lazy-fetches from Google Drive on first access.
   * If content is already cached in R2, returns from cache.
   */
  async getContent(
    userId: string,
    sourceId: string,
    driveService: DriveService,
  ): Promise<SourceContentResult> {
    const source = await this.getSource(userId, sourceId);

    // If already cached, read from R2
    if (source.cachedAt && source.status === "active") {
      const r2Key = `sources/${sourceId}/content.html`;
      const object = await this.bucket.get(r2Key);
      if (object) {
        const content = await object.text();
        return {
          content,
          wordCount: source.wordCount,
          cachedAt: source.cachedAt,
        };
      }
      // R2 object missing — fall through to re-fetch
    }

    // Fetch from Drive, sanitize, and cache
    return this.fetchAndCache(userId, sourceId, source.driveFileId, driveService);
  }

  /**
   * Fetch content from Drive, sanitize, and cache in R2.
   * Updates D1 metadata (word_count, cached_at, drive_modified_time).
   */
  private async fetchAndCache(
    userId: string,
    sourceId: string,
    driveFileId: string,
    driveService: DriveService,
  ): Promise<SourceContentResult> {
    const tokens = await driveService.getValidTokens(userId);
    if (!tokens) {
      validationError("Google Drive is not connected. Connect Drive to access source content.");
    }

    let rawHtml: string;
    try {
      rawHtml = await driveService.exportFile(tokens.accessToken, driveFileId, "text/html");
    } catch (err) {
      // Mark source as error state so UI can show appropriate message
      await this.db
        .prepare(`UPDATE source_materials SET status = 'error', updated_at = ? WHERE id = ?`)
        .bind(new Date().toISOString(), sourceId)
        .run();
      throw err;
    }

    const content = sanitizeGoogleDocsHtml(rawHtml);
    const wordCount = countWords(content);
    const now = new Date().toISOString();
    const r2Key = `sources/${sourceId}/content.html`;

    // Get Drive file's modifiedTime for staleness tracking
    let driveModifiedTime: string | null = null;
    try {
      const metadata = await driveService.getFileMetadata(tokens.accessToken, driveFileId);
      driveModifiedTime = metadata.modifiedTime ?? null;
    } catch {
      // Non-critical — staleness detection just won't work until next fetch
    }

    // Write sanitized content to R2
    await this.bucket.put(r2Key, content, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
      customMetadata: { sourceId, cachedAt: now },
    });

    // Update D1 metadata
    await this.db
      .prepare(
        `UPDATE source_materials
         SET r2_key = ?, word_count = ?, cached_at = ?, drive_modified_time = ?,
             status = 'active', updated_at = ?
         WHERE id = ?`,
      )
      .bind(r2Key, wordCount, now, driveModifiedTime, now, sourceId)
      .run();

    return { content, wordCount, cachedAt: now };
  }

  /**
   * Remove a source material (soft delete).
   * Fire-and-forget R2 cleanup.
   */
  async removeSource(userId: string, sourceId: string): Promise<void> {
    // Verify ownership
    const source = await this.getSource(userId, sourceId);

    await this.db
      .prepare(`UPDATE source_materials SET status = 'archived', updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), sourceId)
      .run();

    // Fire-and-forget R2 cleanup
    if (source.cachedAt) {
      this.bucket.delete(`sources/${sourceId}/content.html`).catch(() => {
        // Non-critical — orphaned R2 object is harmless
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
    driveService: DriveService,
  ): Promise<ImportAsChapterResult & { projectId: string; r2Key: string }> {
    const source = await this.getSource(userId, sourceId);

    // Get content — from cache or Drive
    const { content, wordCount } = await this.getContent(userId, sourceId, driveService);

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
