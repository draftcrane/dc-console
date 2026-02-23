/**
 * Export service facade -- composes ExportJobService and ExportDeliveryService.
 *
 * This module preserves the original ExportService public API so that route files
 * and test files do not need import changes. Internally, responsibilities
 * are delegated to focused sub-services:
 *
 *   - export-job.ts     -- Export generation (book & chapter PDF/EPUB creation)
 *   - export-delivery.ts -- Status queries, download streaming, Drive upload
 *
 * Re-exports all public types from sub-modules for backward compatibility.
 */

import { ExportJobService } from "./export-job.js";
import type { ExportJobResult } from "./export-job.js";
import { ExportDeliveryService } from "./export-delivery.js";
import type {
  ExportJobStatus,
  ExportToDriveResult,
  ExportPreference,
  ExportPreferenceInput,
} from "./export-delivery.js";
import type { DriveService } from "./drive.js";
import type { PdfGeneratorConfig } from "./pdf-generator.js";

// Re-export public types so existing imports from "./export.js" still work
export type { ExportJobResult } from "./export-job.js";
export type {
  ExportJobStatus,
  ExportToDriveResult,
  ExportPreference,
  ExportPreferenceInput,
} from "./export-delivery.js";

/**
 * ExportService composes job creation and delivery into a single unified API.
 * Route files instantiate `new ExportService(db, bucket, pdfConfig, apiBaseUrl)`
 * and call methods directly -- this facade delegates to the appropriate sub-service.
 */
export class ExportService {
  private readonly jobs: ExportJobService;
  private readonly delivery: ExportDeliveryService;

  constructor(db: D1Database, bucket: R2Bucket, pdfConfig: PdfGeneratorConfig, apiBaseUrl: string) {
    this.jobs = new ExportJobService(db, bucket, pdfConfig, apiBaseUrl);
    this.delivery = new ExportDeliveryService(db, bucket, apiBaseUrl);
  }

  // ── Job creation (delegated to ExportJobService) ──

  exportBook(
    userId: string,
    projectId: string,
    format: "pdf" | "epub" = "pdf",
  ): Promise<ExportJobResult> {
    return this.jobs.exportBook(userId, projectId, format);
  }

  exportChapter(
    userId: string,
    projectId: string,
    chapterId: string,
    format: "pdf" | "epub" = "pdf",
  ): Promise<ExportJobResult> {
    return this.jobs.exportChapter(userId, projectId, chapterId, format);
  }

  // ── Delivery (delegated to ExportDeliveryService) ──

  getExportStatus(userId: string, jobId: string): Promise<ExportJobStatus> {
    return this.delivery.getExportStatus(userId, jobId);
  }

  getExportDownload(
    userId: string,
    jobId: string,
  ): Promise<{ data: ReadableStream; fileName: string; contentType: string }> {
    return this.delivery.getExportDownload(userId, jobId);
  }

  saveToDrive(
    userId: string,
    jobId: string,
    driveService: DriveService,
    connectionId?: string,
    folderId?: string,
  ): Promise<ExportToDriveResult> {
    return this.delivery.saveToDrive(userId, jobId, driveService, connectionId, folderId);
  }

  // ── Export preferences (delegated to ExportDeliveryService) ──

  getExportPreference(userId: string, projectId: string): Promise<ExportPreference | null> {
    return this.delivery.getExportPreference(userId, projectId);
  }

  setExportPreference(
    userId: string,
    projectId: string,
    input: ExportPreferenceInput,
  ): Promise<ExportPreference> {
    return this.delivery.setExportPreference(userId, projectId, input);
  }

  clearExportPreference(userId: string, projectId: string): Promise<void> {
    return this.delivery.clearExportPreference(userId, projectId);
  }
}
