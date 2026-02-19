import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { countWords } from "../utils/word-count.js";
import { sanitizeGoogleDocsHtml } from "../utils/html-sanitize.js";
import type { DriveService } from "./drive.js";

/**
 * SourceMaterialService - Manages reference material from Google Drive and local uploads.
 *
 * Sources are polymorphic: either Drive files (Google Docs selected via Picker)
 * or local uploads (.txt, .md). Content is cached in R2 as sanitized HTML.
 *
 * R2 key format:
 * - sources/{sourceId}/content.html -- processed/extracted HTML
 * - sources/{sourceId}/original.{ext} -- original file (local uploads only)
 *
 * No content stored in D1 -- only metadata.
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

const ALLOWED_MIME_TYPE = "application/vnd.google-apps.document";
const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_SOURCES_PER_REQUEST = 20;
const MAX_EXPANDED_DOCS_PER_REQUEST = 200;
const MAX_LOCAL_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_LOCAL_EXTENSIONS = [".txt", ".md"];

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

/** Convert plain text to simple HTML paragraphs */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0)
    .map(
      (p) =>
        `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim()}</p>`,
    )
    .join("\n");
}

/** Lightweight Markdown to HTML (headings, bold, italic, lists, paragraphs) */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const htmlLines: string[] = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine;

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      const level = headingMatch[1].length;
      htmlLines.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    // Unordered list items
    const listMatch = line.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }
      htmlLines.push(`<li>${listMatch[1]}</li>`);
      continue;
    }

    // Close list if not a list item
    if (inList) {
      htmlLines.push("</ul>");
      inList = false;
    }

    // Empty lines
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraph - apply inline formatting
    let formatted = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
    htmlLines.push(`<p>${formatted}</p>`);
  }

  if (inList) htmlLines.push("</ul>");
  return htmlLines.join("\n");
}

export class SourceMaterialService {
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
   * Add a local file as a source material.
   * Supports .txt and .md files up to 5MB.
   * Deduplicates on (project_id, content_hash).
   */
  async addLocalSource(
    userId: string,
    projectId: string,
    file: { name: string; content: ArrayBuffer },
  ): Promise<SourceMaterial> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Validate file size
    if (file.content.byteLength > MAX_LOCAL_FILE_SIZE) {
      validationError(`File must be under ${MAX_LOCAL_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validate extension
    const ext =
      file.name.lastIndexOf(".") >= 0
        ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
        : "";
    if (!ALLOWED_LOCAL_EXTENSIONS.includes(ext)) {
      validationError(`Only ${ALLOWED_LOCAL_EXTENSIONS.join(", ")} files are supported`);
    }

    // Compute content hash for dedup (SHA-256 via Web Crypto)
    const hashBuffer = await crypto.subtle.digest("SHA-256", file.content);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Check for existing source with same hash in this project
    const existing = await this.db
      .prepare(
        `SELECT id FROM source_materials
         WHERE project_id = ? AND content_hash = ? AND source_type = 'local' AND status = 'active'`,
      )
      .bind(projectId, contentHash)
      .first<{ id: string }>();

    if (existing) {
      // Return the existing source
      const row = await this.db
        .prepare(`SELECT * FROM source_materials WHERE id = ?`)
        .bind(existing.id)
        .first<SourceRow>();
      return rowToSource(row!);
    }

    // Decode content
    const textContent = new TextDecoder().decode(file.content);

    // Convert to HTML based on extension
    const html = ext === ".md" ? markdownToHtml(textContent) : textToHtml(textContent);
    const wordCount = countWords(html);
    const mimeType = ext === ".md" ? "text/markdown" : "text/plain";

    // Get next sort_order
    const maxSort = await this.db
      .prepare(
        `SELECT MAX(sort_order) as max_sort FROM source_materials
         WHERE project_id = ? AND status = 'active'`,
      )
      .bind(projectId)
      .first<{ max_sort: number | null }>();

    const sortOrder = (maxSort?.max_sort || 0) + 1;
    const id = ulid();
    const now = new Date().toISOString();
    const r2Key = `sources/${id}/content.html`;
    const title = file.name.replace(/\.[^.]+$/, ""); // Strip extension for title

    // Write HTML content to R2
    await this.bucket.put(r2Key, html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
      customMetadata: { sourceId: id, cachedAt: now },
    });

    // Store original file in R2
    await this.bucket.put(`sources/${id}/original${ext}`, file.content, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { sourceId: id, originalFilename: file.name },
    });

    // Insert into D1
    await this.db
      .prepare(
        `INSERT INTO source_materials (id, project_id, source_type, title, mime_type, original_filename, content_hash, word_count, r2_key, cached_at, sort_order, created_at, updated_at)
         VALUES (?, ?, 'local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        projectId,
        title,
        mimeType,
        file.name,
        contentHash,
        wordCount,
        r2Key,
        now,
        sortOrder,
        now,
        now,
      )
      .run();

    return {
      id,
      projectId,
      sourceType: "local",
      driveConnectionId: null,
      driveFileId: null,
      title,
      mimeType,
      originalFilename: file.name,
      driveModifiedTime: null,
      wordCount,
      r2Key: r2Key,
      cachedAt: now,
      status: "active",
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
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
   * Get source content. Lazy-fetches from Google Drive on first access (for Drive sources).
   * For local sources, always reads from R2.
   */
  async getContent(
    userId: string,
    sourceId: string,
    driveService: DriveService,
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

    // Fetch from Drive, sanitize, and cache
    return this.fetchAndCache(
      userId,
      sourceId,
      source.driveFileId!,
      source.driveConnectionId,
      driveService,
    );
  }

  /**
   * Fetch content from Drive, sanitize, and cache in R2.
   * Updates D1 metadata (word_count, cached_at, drive_modified_time).
   */
  private async fetchAndCache(
    userId: string,
    sourceId: string,
    driveFileId: string,
    driveConnectionId: string | null,
    driveService: DriveService,
  ): Promise<SourceContentResult> {
    // Get tokens: prefer connection-specific, fall back to user's first connection
    let accessToken: string;
    if (driveConnectionId) {
      const tokens = await driveService.getValidTokensByConnection(driveConnectionId);
      if (!tokens) {
        validationError(
          "Drive connection not found. The Google account may have been disconnected.",
        );
      }
      accessToken = tokens.accessToken;
    } else {
      const tokens = await driveService.getValidTokens(userId);
      if (!tokens) {
        validationError("Google Drive is not connected. Connect Drive to access source content.");
      }
      accessToken = tokens.accessToken;
    }

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
    const wordCount = countWords(content);
    const now = new Date().toISOString();
    const r2Key = `sources/${sourceId}/content.html`;

    // Get Drive file's modifiedTime for staleness tracking
    let driveModifiedTime: string | null = null;
    try {
      const metadata = await driveService.getFileMetadata(accessToken, driveFileId);
      driveModifiedTime = metadata.modifiedTime ?? null;
    } catch {
      // Non-critical -- staleness detection just won't work until next fetch
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
        // Non-critical -- orphaned R2 object is harmless
      });
    }
  }

  /**
   * Archive all sources for a disconnected Drive connection.
   * Also soft-archives related chapter_sources links (preserving them for reconnection).
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

    // Soft-archive chapter-source links
    await this.db
      .prepare(
        `UPDATE chapter_sources SET status = 'archived'
         WHERE source_id IN (SELECT id FROM source_materials WHERE drive_connection_id = ?)`,
      )
      .bind(connectionId)
      .run();
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

    // Get content -- from cache or Drive
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
