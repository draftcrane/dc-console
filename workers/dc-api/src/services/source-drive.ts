/**
 * Drive source material handling -- adding sources from Google Picker, folder expansion,
 * fetching and caching Drive content.
 *
 * Split from source-material.ts per Single Responsibility Principle.
 * Handles the Google Drive integration side of source materials:
 * - Adding Drive files selected via Picker
 * - Recursive folder expansion to discover Google Docs
 * - Fetching, sanitizing, and caching Google Docs content in R2
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { countWords } from "../utils/word-count.js";
import { sanitizeGoogleDocsHtml } from "../utils/html-sanitize.js";
import type { DriveService } from "./drive.js";
import {
  type AddSourceInput,
  type AddSourcesResult,
  type SourceMaterial,
  type SourceContentResult,
} from "./source-types.js";
import { extractPlainTextFromHtml, storeExtractionResult } from "./text-extraction.js";
import { resolveReadOnlyConnection } from "./drive-connection-resolver.js";

const ALLOWED_MIME_TYPE = "application/vnd.google-apps.document";
const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_SOURCES_PER_REQUEST = 50;
const MAX_EXPANDED_DOCS_PER_REQUEST = 200;

export class SourceDriveService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
  ) {}

  /**
   * Add source materials from Google Picker selection.
   * Validates mime types (Google Docs only) and deduplicates silently.
   *
   * @param connectionId - The Drive connection to associate these sources with
   */
  async addSources(
    userId: string,
    projectId: string,
    files: AddSourceInput[],
    driveService?: DriveService,
    connectionId?: string,
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
      if (!driveService || !connectionId) {
        throw new Error(
          "DriveService and connectionId are required when adding folders as sources",
        );
      }

      const tokens = await driveService.getValidTokensByConnection(connectionId);
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

      // Check for existing source with same drive_file_id (partial unique index not usable with ON CONFLICT)
      const existing = await this.db
        .prepare(`SELECT id FROM source_materials WHERE project_id = ? AND drive_file_id = ?`)
        .bind(projectId, file.driveFileId)
        .first<{ id: string }>();

      if (existing) continue;

      await this.db
        .prepare(
          `INSERT INTO source_materials (id, project_id, source_type, drive_connection_id, drive_file_id, title, mime_type, sort_order, created_at, updated_at)
           VALUES (?, ?, 'drive', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          projectId,
          connectionId || null,
          file.driveFileId,
          file.title,
          file.mimeType,
          sortOrder,
          now,
          now,
        )
        .run();

      created.push({
        id,
        projectId,
        sourceType: "drive",
        driveConnectionId: connectionId || null,
        driveFileId: file.driveFileId,
        title: file.title,
        mimeType: file.mimeType,
        originalFilename: null,
        driveModifiedTime: null,
        wordCount: 0,
        r2Key: null,
        cachedAt: null,
        status: "active",
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      sortOrder++;
    }

    // Auto-link: ensure project_source_connections row exists for this connection
    if (connectionId && created.length > 0) {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO project_source_connections (id, project_id, drive_connection_id, created_at)
           VALUES (lower(hex(randomblob(16))), ?, ?, ?)`,
        )
        .bind(projectId, connectionId, new Date().toISOString())
        .run();
    }

    if (selectedFolders.length > 0) {
      console.info(
        JSON.stringify({
          level: "info",
          event: "sources_folder_expand_complete",
          user_id: userId,
          project_id: projectId,
          selected_folders: selectedFolders.length,
          docs_discovered: discoveredFromFolders.length,
          docs_inserted: created.length,
        }),
      );
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
   * Fetch content from Drive, sanitize, cache in R2 (HTML + plain text),
   * and populate FTS index.
   * Updates D1 metadata (word_count, cached_at, drive_modified_time).
   *
   * Connection resolution: uses the source's driveConnectionId if available,
   * otherwise falls back to single-connection or rejects with DRIVE_AMBIGUOUS
   * for multi-account users. See drive-connection-resolver.ts for rules.
   */
  async fetchAndCache(
    userId: string,
    sourceId: string,
    driveFileId: string,
    driveConnectionId: string | null,
    driveService: DriveService,
    sourceTitle?: string,
  ): Promise<SourceContentResult> {
    // Resolve connection: prefer source-specific binding, reject ambiguous state
    const { tokens } = await resolveReadOnlyConnection(
      driveService.tokenService,
      userId,
      driveConnectionId ?? undefined,
    );
    const accessToken = tokens.accessToken;

    let rawHtml: string;
    try {
      rawHtml = await driveService.exportFile(accessToken, driveFileId, "text/html");
    } catch (err) {
      // Mark source as error state so UI can show appropriate message
      await this.db
        .prepare(`UPDATE source_materials SET status = 'error', updated_at = ? WHERE id = ?`)
        .bind(new Date().toISOString(), sourceId)
        .run();
      throw err;
    }

    const content = sanitizeGoogleDocsHtml(rawHtml);

    // Get Drive file's modifiedTime for staleness tracking
    let driveModifiedTime: string | null = null;
    try {
      const metadata = await driveService.getFileMetadata(accessToken, driveFileId);
      driveModifiedTime = metadata.modifiedTime ?? null;
    } catch {
      // Non-critical -- staleness detection just won't work until next fetch
    }

    // Extract plain text from sanitized HTML and store both versions + FTS
    const extractionResult = extractPlainTextFromHtml(content);

    // Resolve title for FTS indexing
    const title = sourceTitle || "Untitled";

    // Store HTML + plain text in R2 and populate FTS index
    const { r2Key, cachedAt } = await storeExtractionResult(
      sourceId,
      title,
      extractionResult,
      this.bucket,
      this.db,
    );

    // Update D1 metadata
    await this.db
      .prepare(
        `UPDATE source_materials
         SET r2_key = ?, word_count = ?, cached_at = ?, drive_modified_time = ?,
             status = 'active', updated_at = ?
         WHERE id = ?`,
      )
      .bind(r2Key, extractionResult.wordCount, cachedAt, driveModifiedTime, cachedAt, sourceId)
      .run();

    return { content, wordCount: extractionResult.wordCount, cachedAt };
  }

  /**
   * Archive all sources for a disconnected Drive connection.
   *
   * Note: chapter_sources table is deprecated (#181) -- no writes.
   * Table preserved for 90-day rollback window. See migration 0014.
   */
  async archiveByConnection(connectionId: string): Promise<void> {
    const now = new Date().toISOString();

    // Archive source materials
    await this.db
      .prepare(
        `UPDATE source_materials SET status = 'archived', updated_at = ?
         WHERE drive_connection_id = ?`,
      )
      .bind(now, connectionId)
      .run();
  }
}
