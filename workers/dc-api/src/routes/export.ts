import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { exportRateLimit, standardRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { ExportService } from "../services/export.js";
import { safeContentDisposition } from "../utils/file-names.js";
import { DriveService } from "../services/drive.js";

/**
 * Export API routes
 *
 * Per US-019 (PDF Export) and US-020 (EPUB Export):
 * - POST /projects/:projectId/export - Full-book export (format: "pdf" | "epub")
 * - POST /projects/:projectId/chapters/:chapterId/export - Single-chapter export
 * - GET /exports/:jobId/download - Download a completed export
 *
 * Rate limit: 5 req/min per user (exportRateLimit middleware).
 * All routes require authentication (enforced globally in index.ts).
 */
const exportRoutes = new Hono<{ Bindings: Env }>();

// Auth is enforced globally in index.ts
// Rate limit export generation endpoints (not downloads)
exportRoutes.use("/projects/*", exportRateLimit);

/**
 * POST /projects/:projectId/export
 * Generate a full-book export.
 *
 * Request body:
 * - format: "pdf" | "epub" (required)
 *
 * Response: { jobId, status, fileName, downloadUrl, error }
 */
exportRoutes.post("/projects/:projectId/export", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const body = (await c.req.json().catch(() => ({}))) as { format?: string };

  if (!body.format || (body.format !== "pdf" && body.format !== "epub")) {
    validationError('format must be "pdf" or "epub"');
  }

  const format = body.format as "pdf" | "epub";
  const service = createExportService(c.env);
  const result = await service.exportBook(userId, projectId, format);

  if (result.status === "failed") {
    return c.json(result, 500);
  }

  return c.json(result, 201);
});

/**
 * POST /projects/:projectId/chapters/:chapterId/export
 * Generate a single-chapter export.
 *
 * Request body:
 * - format: "pdf" | "epub" (required)
 *
 * Response: { jobId, status, fileName, downloadUrl, error }
 */
exportRoutes.post("/projects/:projectId/chapters/:chapterId/export", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const chapterId = c.req.param("chapterId");

  const body = (await c.req.json().catch(() => ({}))) as { format?: string };

  if (!body.format || (body.format !== "pdf" && body.format !== "epub")) {
    validationError('format must be "pdf" or "epub"');
  }

  const format = body.format as "pdf" | "epub";
  const service = createExportService(c.env);
  const result = await service.exportChapter(userId, projectId, chapterId, format);

  if (result.status === "failed") {
    return c.json(result, 500);
  }

  return c.json(result, 201);
});

/**
 * GET /exports/:jobId
 * Get the status of an export job.
 *
 * Per US-022: Returns job status + download URL for completed exports.
 * Download URL points to the authenticated download endpoint (1-hour cache).
 *
 * Response: { jobId, status, format, fileName, downloadUrl, chapterCount,
 *             totalWordCount, error, createdAt, completedAt }
 */
exportRoutes.get("/exports/:jobId", async (c) => {
  const { userId } = c.get("auth");
  const jobId = c.req.param("jobId");

  const service = createExportService(c.env);
  const status = await service.getExportStatus(userId, jobId);

  return c.json(status);
});

/**
 * GET /exports/:jobId/download
 * Download a completed export file from R2.
 *
 * Streams the PDF directly from R2 storage.
 * No rate limit on downloads (already generated).
 */
exportRoutes.get("/exports/:jobId/download", async (c) => {
  const { userId } = c.get("auth");
  const jobId = c.req.param("jobId");

  const service = createExportService(c.env);
  const download = await service.getExportDownload(userId, jobId);

  return new Response(download.data, {
    headers: {
      "Content-Type": download.contentType,
      "Content-Disposition": safeContentDisposition(download.fileName),
      "Cache-Control": "private, max-age=3600",
    },
  });
});

/**
 * POST /exports/:jobId/to-drive
 * Save a completed export to Google Drive.
 *
 * Per US-021: Uploads the export artifact to _exports/ subfolder in the Book Folder.
 * Date-stamped file names prevent overwrites.
 * Idempotent: if already saved, returns the existing Drive file info.
 *
 * Response: { driveFileId, fileName, webViewLink }
 */
exportRoutes.post("/exports/:jobId/to-drive", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const jobId = c.req.param("jobId");
  const body = (await c.req.json().catch(() => ({}))) as { connectionId?: string };

  const service = createExportService(c.env);
  const driveService = new DriveService(c.env);
  const result = await service.saveToDrive(userId, jobId, driveService, body.connectionId);

  return c.json(result);
});

/**
 * Create ExportService with environment bindings.
 */
function createExportService(env: Env): ExportService {
  return new ExportService(
    env.DB,
    env.EXPORTS_BUCKET,
    {
      accountId: env.CF_ACCOUNT_ID,
      apiToken: env.CF_API_TOKEN,
    },
    env.API_BASE_URL || "",
  );
}

export { exportRoutes };
