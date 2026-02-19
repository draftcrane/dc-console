/**
 * Export job creation -- generates PDF and EPUB exports for books and chapters.
 *
 * Split from export.ts per Single Responsibility Principle.
 * Handles the "write" side of exports: creating jobs, fetching content,
 * generating artifacts (PDF/EPUB), and storing in R2.
 *
 * Per ADR-004:
 * 1. Create export_jobs row (status: 'processing')
 * 2. Fetch chapter content from R2 (sequential, memory-safe)
 * 3. Branch by format (PDF via Browser Rendering, EPUB via JSZip)
 * 4. Store result in R2 (EXPORTS_BUCKET)
 * 5. Update export_jobs (status: 'completed', r2_key)
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { buildFileName, formatDate } from "../utils/file-names.js";
import { fetchChapterContentsFromR2 } from "../utils/r2-content.js";
import {
  assembleBookHtml,
  assembleChapterHtml,
  PRINT_CSS,
  type BookMetadata,
  type ChapterContent,
} from "./book-template.js";
import { generateEpub } from "./epub-generator.js";
import { generatePdf, type PdfGeneratorConfig } from "./pdf-generator.js";

export interface ExportJobResult {
  jobId: string;
  status: "completed" | "failed";
  fileName: string | null;
  downloadUrl: string | null;
  error: string | null;
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

export class ExportJobService {
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
  async getAuthorName(userId: string): Promise<string> {
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
