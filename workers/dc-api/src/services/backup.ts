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

    // Read and validate manifest
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      validationError("Invalid backup: missing manifest.json");
    }

    const manifestText = await manifestFile.async("text");
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

    // Create chapters
    for (const chapter of manifest.chapters) {
      const chapterId = ulid();
      const r2Key = `chapters/${chapterId}/content.html`;

      // Read HTML from ZIP
      const chapterFile = zip.file(`chapters/${chapter.fileName}`);
      const html = chapterFile ? await chapterFile.async("text") : "";
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
