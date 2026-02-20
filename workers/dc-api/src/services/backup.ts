import JSZip from "jszip";
import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { countWords } from "../utils/word-count.js";
import { sanitizeFileName, formatDate } from "../utils/file-names.js";
import { fetchChapterContentsFromR2 } from "../utils/r2-content.js";

/**
 * BackupService - Generates downloadable ZIP backups and restores from them.
 *
 * Backup format (version 1):
 *   manifest.json - Project metadata and chapter list
 *   chapters/01-chapter-title.html - Chapter content files
 *
 * No export_jobs table or R2 artifact storage — backup is synchronous and
 * streamed directly to the client.
 */

/** Decompression guards — prevent zip-bomb style payloads */
export const IMPORT_LIMITS = {
  /** Maximum total uncompressed bytes across all entries (200 MB) */
  MAX_TOTAL_UNCOMPRESSED_BYTES: 200 * 1024 * 1024,
  /** Maximum uncompressed bytes for a single entry (50 MB) */
  MAX_ENTRY_UNCOMPRESSED_BYTES: 50 * 1024 * 1024,
  /** Maximum number of entries in the ZIP */
  MAX_ENTRY_COUNT: 500,
} as const;

interface ProjectRow {
  id: string;
  title: string;
  description: string;
}

interface ChapterRow {
  id: string;
  title: string;
  sort_order: number;
  r2_key: string | null;
  word_count: number;
}

interface BackupManifest {
  version: 1;
  exportedAt: string;
  app: "DraftCrane";
  project: {
    title: string;
    description: string;
  };
  chapters: {
    title: string;
    sortOrder: number;
    fileName: string;
    wordCount: number;
  }[];
}

export interface GenerateBackupResult {
  data: ArrayBuffer;
  fileName: string;
}

export interface ImportBackupResult {
  projectId: string;
  title: string;
  chapterCount: number;
}

export class BackupService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
  ) {}

  /**
   * Generate a ZIP backup of a project.
   *
   * 1. Verify project ownership
   * 2. Fetch chapter metadata from D1
   * 3. Fetch chapter content from R2 (sequential, memory-safe)
   * 4. Build manifest.json
   * 5. Assemble ZIP with JSZip
   */
  async generateBackup(userId: string, projectId: string): Promise<GenerateBackupResult> {
    const project = await this.db
      .prepare(
        `SELECT id, title, description FROM projects
         WHERE id = ? AND user_id = ? AND status = 'active'`,
      )
      .bind(projectId, userId)
      .first<ProjectRow>();

    if (!project) {
      notFound("Project not found");
    }

    const chaptersResult = await this.db
      .prepare(
        `SELECT id, title, sort_order, r2_key, word_count
         FROM chapters WHERE project_id = ? ORDER BY sort_order ASC`,
      )
      .bind(projectId)
      .all<ChapterRow>();

    const chapterRows = chaptersResult.results ?? [];

    if (chapterRows.length === 0) {
      validationError("Project has no chapters to back up");
    }

    const zip = new JSZip();
    const chaptersFolder = zip.folder("chapters")!;
    const manifestChapters: BackupManifest["chapters"] = [];

    // Fetch chapter content from R2 sequentially (memory-safe)
    const contentMap = await fetchChapterContentsFromR2(this.bucket, chapterRows);

    for (const row of chapterRows) {
      const html = contentMap.get(row) ?? "";
      const fileName = buildChapterFileName(row.sort_order, row.title);
      chaptersFolder.file(fileName, html);

      manifestChapters.push({
        title: row.title,
        sortOrder: row.sort_order,
        fileName,
        wordCount: row.word_count,
      });
    }

    const manifest: BackupManifest = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "DraftCrane",
      project: {
        title: project.title,
        description: project.description,
      },
      chapters: manifestChapters,
    };

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const data = await zip.generateAsync({ type: "arraybuffer" });
    const fileName = `${sanitizeFileName(project.title)} - Backup ${formatDate(new Date())}.zip`;

    return { data, fileName };
  }

  /**
   * Import a project from a ZIP backup.
   *
   * 1. Parse ZIP and validate manifest
   * 2. Create project in D1
   * 3. For each chapter: create D1 row, write HTML to R2
   *
   * Always creates a new project — never overwrites existing work.
   */
  async importBackup(userId: string, zipBuffer: ArrayBuffer): Promise<ImportBackupResult> {
    const zip = await JSZip.loadAsync(zipBuffer);

    // --- Zip-bomb guard: entry count ---
    const fileEntries = Object.values(zip.files).filter((e) => !e.dir);
    if (fileEntries.length > IMPORT_LIMITS.MAX_ENTRY_COUNT) {
      validationError(
        `Backup exceeds maximum entry count (${fileEntries.length} > ${IMPORT_LIMITS.MAX_ENTRY_COUNT})`,
      );
    }

    // --- Zip-bomb guard: uncompressed sizes ---
    // Decompress each entry to ArrayBuffer and check sizes before proceeding.
    // This catches zip-bombs where compressed data expands to huge payloads.
    let totalUncompressed = 0;
    const decompressedEntries = new Map<string, ArrayBuffer>();
    for (const entry of fileEntries) {
      const buf = await entry.async("arraybuffer");

      if (buf.byteLength > IMPORT_LIMITS.MAX_ENTRY_UNCOMPRESSED_BYTES) {
        validationError(
          `Entry "${entry.name}" exceeds maximum uncompressed size (${buf.byteLength} bytes > ${IMPORT_LIMITS.MAX_ENTRY_UNCOMPRESSED_BYTES} bytes)`,
        );
      }

      totalUncompressed += buf.byteLength;
      if (totalUncompressed > IMPORT_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES) {
        validationError(
          `Backup exceeds maximum total uncompressed size (> ${IMPORT_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES} bytes)`,
        );
      }

      decompressedEntries.set(entry.name, buf);
    }

    // Read and validate manifest
    const manifestBuf = decompressedEntries.get("manifest.json");
    if (!manifestBuf) {
      validationError("Invalid backup: missing manifest.json");
    }

    const manifestText = new TextDecoder().decode(manifestBuf);
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      validationError("Invalid backup: manifest.json is not valid JSON");
    }

    if (manifest.version !== 1) {
      validationError(`Unsupported backup version: ${manifest.version}`);
    }

    if (!manifest.project?.title?.trim()) {
      validationError("Invalid backup: project title is missing");
    }

    if (!manifest.chapters || manifest.chapters.length === 0) {
      validationError("Invalid backup: no chapters found");
    }

    // Create the project
    const projectId = ulid();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO projects (id, user_id, title, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(
        projectId,
        userId,
        manifest.project.title.trim(),
        manifest.project.description?.trim() || "",
        now,
        now,
      )
      .run();

    // Create chapters — use already-decompressed content
    const decoder = new TextDecoder();
    for (const chapter of manifest.chapters) {
      const chapterId = ulid();
      const r2Key = `chapters/${chapterId}/content.html`;

      // Read HTML from pre-decompressed entries
      const chapterBuf = decompressedEntries.get(`chapters/${chapter.fileName}`);
      const html = chapterBuf ? decoder.decode(chapterBuf) : "";
      const wordCount = countWords(html);

      // Write to R2
      await this.bucket.put(r2Key, html, {
        httpMetadata: {
          contentType: "text/html; charset=utf-8",
        },
        customMetadata: {
          chapterId,
          version: "1",
          updatedAt: now,
        },
      });

      // Insert chapter row
      await this.db
        .prepare(
          `INSERT INTO chapters (id, project_id, title, sort_order, r2_key, word_count, version, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'draft', ?, ?)`,
        )
        .bind(chapterId, projectId, chapter.title, chapter.sortOrder, r2Key, wordCount, now, now)
        .run();
    }

    return {
      projectId,
      title: manifest.project.title.trim(),
      chapterCount: manifest.chapters.length,
    };
  }
}

/**
 * Build a chapter file name: "01-chapter-title.html"
 */
function buildChapterFileName(sortOrder: number, title: string): string {
  const padded = String(sortOrder).padStart(2, "0");
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${padded}-${slug || "untitled"}.html`;
}
