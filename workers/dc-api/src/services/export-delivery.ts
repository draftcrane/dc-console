/**
 * Export delivery -- status queries, download streaming, and Drive upload.
 *
 * Split from export.ts per Single Responsibility Principle.
 * Handles the "read" side of exports: checking job status, streaming downloads
 * from R2, and saving completed exports to Google Drive.
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import type { DriveService } from "./drive.js";
import { resolveProjectConnection } from "./drive-connection-resolver.js";

export interface ExportToDriveResult {
  driveFileId: string;
  fileName: string;
  webViewLink: string;
}

export interface ExportPreference {
  id: string;
  projectId: string;
  userId: string;
  destinationType: "device" | "drive";
  driveConnectionId: string | null;
  driveFolderId: string | null;
  driveFolderPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportPreferenceInput {
  destinationType: "device" | "drive";
  driveConnectionId?: string;
  driveFolderId?: string;
  driveFolderPath?: string;
}

interface ExportPreferenceRow {
  id: string;
  project_id: string;
  user_id: string;
  destination_type: string;
  drive_connection_id: string | null;
  drive_folder_id: string | null;
  drive_folder_path: string | null;
  created_at: string;
  updated_at: string;
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
   * Get the saved export preference for a project.
   */
  async getExportPreference(userId: string, projectId: string): Promise<ExportPreference | null> {
    const row = await this.db
      .prepare(
        `SELECT id, project_id, user_id, destination_type, drive_connection_id,
                drive_folder_id, drive_folder_path, created_at, updated_at
         FROM export_preferences WHERE project_id = ? AND user_id = ?`,
      )
      .bind(projectId, userId)
      .first<ExportPreferenceRow>();

    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      destinationType: row.destination_type as "device" | "drive",
      driveConnectionId: row.drive_connection_id,
      driveFolderId: row.drive_folder_id,
      driveFolderPath: row.drive_folder_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Create or update the export preference for a project (upsert).
   */
  async setExportPreference(
    userId: string,
    projectId: string,
    input: ExportPreferenceInput,
  ): Promise<ExportPreference> {
    if (input.destinationType !== "device" && input.destinationType !== "drive") {
      validationError('destinationType must be "device" or "drive"');
    }

    if (input.destinationType === "drive" && !input.driveConnectionId) {
      validationError("driveConnectionId is required for drive destination");
    }

    // Verify project exists and belongs to user
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const now = new Date().toISOString();

    // Check for existing preference
    const existing = await this.db
      .prepare(`SELECT id FROM export_preferences WHERE project_id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    const id = existing?.id ?? ulid();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE export_preferences
           SET destination_type = ?, drive_connection_id = ?, drive_folder_id = ?,
               drive_folder_path = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          input.destinationType,
          input.destinationType === "drive" ? (input.driveConnectionId ?? null) : null,
          input.destinationType === "drive" ? (input.driveFolderId ?? null) : null,
          input.destinationType === "drive" ? (input.driveFolderPath ?? null) : null,
          now,
          id,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO export_preferences (id, project_id, user_id, destination_type,
           drive_connection_id, drive_folder_id, drive_folder_path, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          projectId,
          userId,
          input.destinationType,
          input.destinationType === "drive" ? (input.driveConnectionId ?? null) : null,
          input.destinationType === "drive" ? (input.driveFolderId ?? null) : null,
          input.destinationType === "drive" ? (input.driveFolderPath ?? null) : null,
          now,
          now,
        )
        .run();
    }

    return {
      id,
      projectId,
      userId,
      destinationType: input.destinationType,
      driveConnectionId:
        input.destinationType === "drive" ? (input.driveConnectionId ?? null) : null,
      driveFolderId: input.destinationType === "drive" ? (input.driveFolderId ?? null) : null,
      driveFolderPath: input.destinationType === "drive" ? (input.driveFolderPath ?? null) : null,
      createdAt: existing ? (await this.getExportPreference(userId, projectId))!.createdAt : now,
      updatedAt: now,
    };
  }

  /**
   * Clear the export preference for a project.
   */
  async clearExportPreference(userId: string, projectId: string): Promise<void> {
    const result = await this.db
      .prepare(`DELETE FROM export_preferences WHERE project_id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .run();

    if (!result.meta.changes || result.meta.changes === 0) {
      notFound("No export preference found for this project");
    }
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
   * 5. Find or create project folder at Drive root (skipped if folderId provided)
   * 6. Find or create _exports/ subfolder (skipped if folderId provided)
   * 7. Fetch export artifact from R2, upload to Drive
   * 8. Update export_jobs row with drive_file_id
   *
   * @param userId - Authenticated user ID
   * @param jobId - Export job ID
   * @param driveService - DriveService instance for Drive API calls
   * @param connectionId - Optional: which Drive account to use (required if multiple)
   * @param folderId - Optional: upload directly to this folder (skip auto-create)
   * @returns Drive file metadata (id, fileName, webViewLink)
   */
  async saveToDrive(
    userId: string,
    jobId: string,
    driveService: DriveService,
    connectionId?: string,
    folderId?: string,
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

    // 5-6. Determine target folder: use explicit folderId or auto-create
    let targetFolderId: string;
    if (folderId) {
      // Explicit folder — skip auto-create (remembered default or user-selected)
      targetFolderId = folderId;
    } else {
      // Find or create project folder at Drive root, then _exports/ subfolder
      const projectFolderId = await driveService.findOrCreateRootFolder(
        resolved.tokens.accessToken,
        project.title,
      );
      targetFolderId = await driveService.findOrCreateSubfolder(
        resolved.tokens.accessToken,
        projectFolderId,
        "_exports",
      );
    }

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
      targetFolderId,
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
