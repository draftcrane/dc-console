/**
 * Local source material handling -- file upload, text/markdown conversion, dedup.
 *
 * Split from source-material.ts per Single Responsibility Principle.
 * Handles .txt and .md file uploads: validation, content conversion to HTML,
 * content hash dedup, R2 storage, and D1 metadata.
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { countWords } from "../utils/word-count.js";
import { type SourceMaterial, type SourceRow, rowToSource } from "./source-types.js";

const MAX_LOCAL_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_LOCAL_EXTENSIONS = [".txt", ".md"];

/** Convert plain text to simple HTML paragraphs */
export function textToHtml(text: string): string {
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
export function markdownToHtml(md: string): string {
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

export class SourceLocalService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
  ) {}

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
}
