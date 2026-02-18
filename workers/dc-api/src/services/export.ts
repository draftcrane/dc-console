import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { buildFileName, formatDate } from "../utils/file-names.js";
import { fetchChapterContentsFromR2 } from "../utils/r2-content.js";
import type { DriveService } from "./drive.js";
import {
  assembleBookHtml,
  assembleChapterHtml,
  PRINT_CSS,
  type BookMetadata,
  type ChapterContent,
} from "./book-template.js";
import { generateEpub } from "./epub-generator.js";
import { generatePdf, type PdfGeneratorConfig } from "./pdf-generator.js";

/**
 * ExportService - Orchestrates PDF and EPUB export for full books and single chapters.
 *
 * Per ADR-004:
 * 1. Create export_jobs row (status: 'processing')
 * 2. Fetch chapter content from R2 (sequential, memory-safe)
 * 3. Branch by format:
 *    - PDF: Assemble HTML with print stylesheet, generate via Browser Rendering
 *    - EPUB: Generate EPUB 3.0 ZIP via JSZip (EpubGenerator)
 * 4. Store result in R2 (EXPORTS_BUCKET)
 * 5. Update export_jobs (status: 'completed', r2_key)
 * 6. Return download URL (served via download endpoint)
 */

export interface ExportJobResult {
  jobId: string;
  status: "completed" | "failed";
  fileName: string | null;
  downloadUrl: string | null;
  error: string | null;
}

export interface ExportToDriveResult {
  driveFileId: string;
  fileName: string;
  webViewLink: string;
}

export interface ExportJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  format: string;
  fileName: string | null;
  downloadUrl: string | null;
  chapterCount: number;
  totalWordCount: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ExportJobRow {
  id: string;
  project_id: string;
  user_id: string;
  chapter_id: string | null;
  format: string;
  status: string;
  r2_key: string | null;
  drive_file_id: string | null;
  error_message: string | null;
  chapter_count: number;
  total_word_count: number;
  created_at: string;
  completed_at: string | null;
}

interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
}

interface ChapterRow {
  id: string;
  title: string;
  sort_order: number;
  r2_key: string | null;
  word_count: number;
}

interface UserRow {
  display_name: string | null;
  email: string;
}

export class ExportService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
    private readonly pdfConfig: PdfGeneratorConfig,
    private readonly apiBaseUrl: string,
  ) {}

  /**
   * Export a full book as PDF or EPUB.
   *
   * @param userId - Authenticated user ID
   * @param projectId - Project to export
   * @param format - Export format: "pdf" or "epub"
   * @returns Export job result with download URL
   */
  async exportBook(
    userId: string,
    projectId: string,
    format: "pdf" | "epub" = "pdf",
  ): Promise<ExportJobResult> {
    // Verify project ownership
    const project = await this.db
      .prepare(
        `SELECT id, user_id, title FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`,
      )
      .bind(projectId, userId)
      .first<ProjectRow>();

    if (!project) {
      notFound("Project not found");
    }

    // Fetch chapters
    const chaptersResult = await this.db
      .prepare(
        `SELECT id, title, sort_order, r2_key, word_count
         FROM chapters WHERE project_id = ? ORDER BY sort_order ASC`,
      )
      .bind(projectId)
      .all<ChapterRow>();

    const chapterRows = chaptersResult.results ?? [];

    if (chapterRows.length === 0) {
      validationError("Project has no chapters to export");
    }

    // Create export job
    const jobId = ulid();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO export_jobs (id, project_id, user_id, format, status, chapter_count, total_word_count, created_at)
         VALUES (?, ?, ?, ?, 'processing', ?, ?, ?)`,
      )
      .bind(
        jobId,
        projectId,
        userId,
        format,
        chapterRows.length,
        chapterRows.reduce((sum, ch) => sum + ch.word_count, 0),
        now,
      )
      .run();

    try {
      // Fetch chapter content from R2 sequentially (memory-safe per ADR-004)
      const chapters = await this.fetchChapterContents(chapterRows);

      // Get author name
      const authorName = await this.getAuthorName(userId);

      // Assemble metadata
      const metadata: BookMetadata = {
        title: project.title,
        authorName,
        generatedDate: formatDate(new Date()),
      };

      // Branch by format (ADR-004 architecture)
      let fileData: ArrayBuffer;
      let contentType: string;

      if (format === "epub") {
        fileData = await generateEpub(metadata, chapters);
        contentType = "application/epub+zip";
      } else {
        const html = assembleBookHtml(metadata, chapters);
        const pdf = await generatePdf(html, PRINT_CSS, this.pdfConfig);
        fileData = pdf.data;
        contentType = "application/pdf";
      }

      // Build file name: {Book Title} - YYYY-MM-DD.{ext}
      const fileName = buildFileName(project.title, format);
      const r2Key = `exports/${jobId}.${format}`;

      // Store in R2
      await this.bucket.put(r2Key, fileData, {
        httpMetadata: {
          contentType,
          contentDisposition: `attachment; filename="${fileName}"`,
        },
        customMetadata: {
          jobId,
          projectId,
          userId,
          fileName,
        },
      });

      // Update job as completed
      await this.db
        .prepare(
          `UPDATE export_jobs SET status = 'completed', r2_key = ?, completed_at = ? WHERE id = ?`,
        )
        .bind(r2Key, new Date().toISOString(), jobId)
        .run();

      return {
        jobId,
        status: "completed",
        fileName,
        downloadUrl: `${this.apiBaseUrl}/exports/${jobId}/download`,
        error: null,
      };
    } catch (err) {
      // Update job as failed
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await this.db
        .prepare(
          `UPDATE export_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`,
        )
        .bind(errorMessage, new Date().toISOString(), jobId)
        .run();

      return {
        jobId,
        status: "failed",
        fileName: null,
        downloadUrl: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Export a single chapter as PDF or EPUB.
   *
   * @param userId - Authenticated user ID
   * @param projectId - Project the chapter belongs to
   * @param chapterId - Chapter to export
   * @param format - Export format: "pdf" or "epub"
   * @returns Export job result with download URL
   */
  async exportChapter(
    userId: string,
    projectId: string,
    chapterId: string,
    format: "pdf" | "epub" = "pdf",
  ): Promise<ExportJobResult> {
    // Verify project ownership
    const project = await this.db
      .prepare(
        `SELECT id, user_id, title FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`,
      )
      .bind(projectId, userId)
      .first<ProjectRow>();

    if (!project) {
      notFound("Project not found");
    }

    // Verify chapter belongs to project
    const chapter = await this.db
      .prepare(
        `SELECT id, title, sort_order, r2_key, word_count
         FROM chapters WHERE id = ? AND project_id = ?`,
      )
      .bind(chapterId, projectId)
      .first<ChapterRow>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    // Create export job
    const jobId = ulid();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO export_jobs (id, project_id, user_id, chapter_id, format, status, chapter_count, total_word_count, created_at)
         VALUES (?, ?, ?, ?, ?, 'processing', 1, ?, ?)`,
      )
      .bind(jobId, projectId, userId, chapterId, format, chapter.word_count, now)
      .run();

    try {
      // Fetch chapter content from R2
      const chapters = await this.fetchChapterContents([chapter]);
      if (chapters.length === 0) {
        validationError("Chapter has no content to export");
      }

      const authorName = await this.getAuthorName(userId);

      const metadata: BookMetadata = {
        title: project.title,
        authorName,
        generatedDate: formatDate(new Date()),
      };

      // Branch by format (ADR-004 architecture)
      let fileData: ArrayBuffer;
      let contentType: string;

      if (format === "epub") {
        fileData = await generateEpub(metadata, chapters);
        contentType = "application/epub+zip";
      } else {
        const html = assembleChapterHtml(metadata, chapters[0]);
        const pdf = await generatePdf(html, PRINT_CSS, this.pdfConfig);
        fileData = pdf.data;
        contentType = "application/pdf";
      }

      // Build file name: {Book Title} - {Chapter Title} - YYYY-MM-DD.{ext}
      const fileName = buildFileName(`${project.title} - ${chapter.title}`, format);
      const r2Key = `exports/${jobId}.${format}`;

      // Store in R2
      await this.bucket.put(r2Key, fileData, {
        httpMetadata: {
          contentType,
          contentDisposition: `attachment; filename="${fileName}"`,
        },
        customMetadata: {
          jobId,
          projectId,
          userId,
          chapterId,
          fileName,
        },
      });

      // Update job as completed
      await this.db
        .prepare(
          `UPDATE export_jobs SET status = 'completed', r2_key = ?, completed_at = ? WHERE id = ?`,
        )
        .bind(r2Key, new Date().toISOString(), jobId)
        .run();

      return {
        jobId,
        status: "completed",
        fileName,
        downloadUrl: `${this.apiBaseUrl}/exports/${jobId}/download`,
        error: null,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await this.db
        .prepare(
          `UPDATE export_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`,
        )
        .bind(errorMessage, new Date().toISOString(), jobId)
        .run();

      return {
        jobId,
        status: "failed",
        fileName: null,
        downloadUrl: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the status of an export job.
   *
   * Per US-022: GET /exports/:jobId returns job status + signed download URL.
   * Download URL is only included for completed jobs (1-hour cache via download endpoint).
   */
  async getExportStatus(userId: string, jobId: string): Promise<ExportJobStatus> {
    const job = await this.db
      .prepare(
        `SELECT id, user_id, format, status, r2_key, error_message, chapter_count,
                total_word_count, created_at, completed_at
         FROM export_jobs WHERE id = ? AND user_id = ?`,
      )
      .bind(jobId, userId)
      .first<ExportJobRow>();

    if (!job) {
      notFound("Export not found");
    }

    let fileName: string | null = null;
    let downloadUrl: string | null = null;

    if (job.status === "completed" && job.r2_key) {
      // Retrieve the file name from R2 custom metadata
      const head = await this.bucket.head(job.r2_key);
      fileName = head?.customMetadata?.fileName || `export-${jobId}.${job.format}`;
      downloadUrl = `${this.apiBaseUrl}/exports/${jobId}/download`;
    }

    return {
      jobId: job.id,
      status: job.status as ExportJobStatus["status"],
      format: job.format,
      fileName,
      downloadUrl,
      chapterCount: job.chapter_count,
      totalWordCount: job.total_word_count,
      error: job.error_message,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    };
  }

  /**
   * Get the download for a completed export job.
   * Streams the file directly from R2.
   */
  async getExportDownload(
    userId: string,
    jobId: string,
  ): Promise<{ data: ReadableStream; fileName: string; contentType: string }> {
    const job = await this.db
      .prepare(
        `SELECT id, user_id, r2_key, format, status FROM export_jobs WHERE id = ? AND user_id = ?`,
      )
      .bind(jobId, userId)
      .first<{
        id: string;
        user_id: string;
        r2_key: string | null;
        format: string;
        status: string;
      }>();

    if (!job) {
      notFound("Export not found");
    }

    if (job.status !== "completed" || !job.r2_key) {
      notFound("Export not available for download");
    }

    const object = await this.bucket.get(job.r2_key);
    if (!object) {
      notFound("Export file not found in storage");
    }

    const fileName = object.customMetadata?.fileName || `export-${jobId}.${job.format || "pdf"}`;
    const contentType = job.format === "epub" ? "application/epub+zip" : "application/pdf";

    return {
      data: object.body,
      fileName,
      contentType,
    };
  }

  /**
   * Save a completed export to Google Drive.
   *
   * Per US-021:
   * 1. Verify the export job belongs to the user and is completed
   * 2. Look up the project's drive_folder_id
   * 3. Find or create the _exports/ subfolder
   * 4. Fetch the export artifact from R2
   * 5. Upload to Drive with date-stamped file name
   * 6. Update the export_jobs row with drive_file_id
   *
   * @param userId - Authenticated user ID
   * @param jobId - Export job ID
   * @param driveService - DriveService instance for Drive API calls
   * @returns Drive file metadata (id, fileName, webViewLink)
   */
  async saveToDrive(
    userId: string,
    jobId: string,
    driveService: DriveService,
  ): Promise<ExportToDriveResult> {
    // 1. Verify the export job belongs to the user and is completed
    const job = await this.db
      .prepare(
        `SELECT id, project_id, user_id, r2_key, format, status, drive_file_id
         FROM export_jobs WHERE id = ? AND user_id = ?`,
      )
      .bind(jobId, userId)
      .first<{
        id: string;
        project_id: string;
        user_id: string;
        r2_key: string | null;
        format: string;
        status: string;
        drive_file_id: string | null;
      }>();

    if (!job) {
      notFound("Export not found");
    }

    if (job.status !== "completed" || !job.r2_key) {
      validationError("Export is not available for saving to Drive");
    }

    // If already saved to Drive, return the existing info
    if (job.drive_file_id) {
      // Fetch the file name from R2 metadata
      const head = await this.bucket.head(job.r2_key);
      const fileName = head?.customMetadata?.fileName || `export-${jobId}.${job.format}`;
      return {
        driveFileId: job.drive_file_id,
        fileName,
        webViewLink: `https://drive.google.com/file/d/${job.drive_file_id}/view`,
      };
    }

    // 2. Look up the project's drive_folder_id
    const project = await this.db
      .prepare(
        `SELECT id, title, drive_folder_id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`,
      )
      .bind(job.project_id, userId)
      .first<{ id: string; title: string; drive_folder_id: string | null }>();

    if (!project) {
      notFound("Project not found");
    }

    if (!project.drive_folder_id) {
      validationError(
        "Project does not have a Google Drive folder. Connect Drive and create a book folder first.",
      );
    }

    // 3. Get valid Drive tokens
    const tokens = await driveService.getValidTokens(userId);
    if (!tokens) {
      validationError("Google Drive is not connected");
    }

    // 4. Find or create the _exports/ subfolder
    const exportsFolderId = await driveService.findOrCreateSubfolder(
      tokens.accessToken,
      project.drive_folder_id,
      "_exports",
    );

    // 5. Fetch the export artifact from R2
    const object = await this.bucket.get(job.r2_key);
    if (!object) {
      notFound("Export file not found in storage");
    }

    const fileName = object.customMetadata?.fileName || `export-${jobId}.${job.format}`;
    const contentType = job.format === "epub" ? "application/epub+zip" : "application/pdf";
    const fileData = await object.arrayBuffer();

    // 6. Upload to Drive
    const driveFile = await driveService.uploadFile(
      tokens.accessToken,
      exportsFolderId,
      fileName,
      contentType,
      fileData,
    );

    // 7. Update the export_jobs row with drive_file_id
    await this.db
      .prepare(`UPDATE export_jobs SET drive_file_id = ? WHERE id = ?`)
      .bind(driveFile.id, jobId)
      .run();

    return {
      driveFileId: driveFile.id,
      fileName,
      webViewLink: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
    };
  }

  /**
   * Fetch chapter content from R2 sequentially.
   * Per ADR-004: sequential fetching is memory-safe for book-length documents.
   */
  private async fetchChapterContents(chapterRows: ChapterRow[]): Promise<ChapterContent[]> {
    const contentMap = await fetchChapterContentsFromR2(this.bucket, chapterRows);

    // Include chapters even with empty content (they'll just have the heading)
    return chapterRows.map((row) => ({
      id: row.id,
      title: row.title,
      sortOrder: row.sort_order,
      html: contentMap.get(row) ?? "",
      wordCount: row.word_count,
    }));
  }

  /**
   * Get the author's display name from the users table.
   */
  private async getAuthorName(userId: string): Promise<string> {
    const user = await this.db
      .prepare(`SELECT display_name, email FROM users WHERE id = ?`)
      .bind(userId)
      .first<UserRow>();

    if (user?.display_name) {
      return user.display_name;
    }

    // Fall back to email prefix
    if (user?.email) {
      return user.email.split("@")[0];
    }

    return "Author";
  }
}
