/**
 * Export delivery -- status queries, download streaming, and Drive upload.
 *
 * Split from export.ts per Single Responsibility Principle.
 * Handles the "read" side of exports: checking job status, streaming downloads
 * from R2, and saving completed exports to Google Drive.
 */

import { notFound, validationError } from "../middleware/error-handler.js";
import type { DriveService } from "./drive.js";
import { resolveProjectConnection } from "./drive-connection-resolver.js";

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

export class ExportDeliveryService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
    private readonly apiBaseUrl: string,
  ) {}

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
   * Creates a project folder on-demand (no project-level Drive binding required).
   * Any user with a connected Drive account can save exports.
   *
   * Steps:
   * 1. Verify the export job belongs to the user and is completed
   * 2. Idempotency: if already saved, return existing info without calling Drive
   * 3. Look up the project title for folder naming
   * 4. Resolve Drive connection (user-level, not project-level)
   * 5. Find or create project folder at Drive root
   * 6. Find or create _exports/ subfolder
   * 7. Fetch export artifact from R2, upload to Drive
   * 8. Update export_jobs row with drive_file_id
   *
   * @param userId - Authenticated user ID
   * @param jobId - Export job ID
   * @param driveService - DriveService instance for Drive API calls
   * @param connectionId - Optional: which Drive account to use (required if multiple)
   * @returns Drive file metadata (id, fileName, webViewLink)
   */
  async saveToDrive(
    userId: string,
    jobId: string,
    driveService: DriveService,
    connectionId?: string,
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

    // 2. Idempotency: if already saved, return existing info without calling Drive
    if (job.drive_file_id) {
      const head = await this.bucket.head(job.r2_key);
      const fileName = head?.customMetadata?.fileName || `export-${jobId}.${job.format}`;
      return {
        driveFileId: job.drive_file_id,
        fileName,
        webViewLink: `https://drive.google.com/file/d/${job.drive_file_id}/view`,
      };
    }

    // 3. Look up the project title for folder naming
    const project = await this.db
      .prepare(`SELECT id, title FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(job.project_id, userId)
      .first<{ id: string; title: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // 4. Resolve Drive connection (user-level, not project-level)
    const resolved = await resolveProjectConnection(
      driveService.tokenService,
      userId,
      null, // No project binding
      connectionId,
    );

    // 5. Find or create project folder at Drive root
    const projectFolderId = await driveService.findOrCreateRootFolder(
      resolved.tokens.accessToken,
      project.title,
    );

    // 6. Find or create _exports/ subfolder
    const exportsFolderId = await driveService.findOrCreateSubfolder(
      resolved.tokens.accessToken,
      projectFolderId,
      "_exports",
    );

    // 7. Fetch the export artifact from R2
    const object = await this.bucket.get(job.r2_key);
    if (!object) {
      notFound("Export file not found in storage");
    }

    const fileName = object.customMetadata?.fileName || `export-${jobId}.${job.format}`;
    const contentType = job.format === "epub" ? "application/epub+zip" : "application/pdf";
    const fileData = await object.arrayBuffer();

    // Upload to Drive
    const driveFile = await driveService.uploadFile(
      resolved.tokens.accessToken,
      exportsFolderId,
      fileName,
      contentType,
      fileData,
    );

    // 8. Update the export_jobs row with drive_file_id
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
}
