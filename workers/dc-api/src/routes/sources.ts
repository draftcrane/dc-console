/**
 * Source material routes -- reference material from Google Drive and local uploads.
 *
 * Routes:
 * - POST /projects/:projectId/sources - Add Drive sources from Google Picker selection
 * - POST /projects/:projectId/sources/upload - Upload local file (.txt, .md)
 * - GET /projects/:projectId/sources - List sources for a project
 * - GET /sources/:sourceId/content - Get cached source content (lazy-fetches from Drive)
 * - DELETE /sources/:sourceId - Remove a source
 * - POST /sources/:sourceId/import-as-chapter - Import source as a new chapter
 * - GET /chapters/:chapterId/sources - List linked sources for a chapter
 * - POST /chapters/:chapterId/sources/:sourceId/link - Link source to chapter
 * - DELETE /chapters/:chapterId/sources/:sourceId/link - Unlink source from chapter
 *
 * All routes require authentication and enforce ownership via project JOIN.
 */

import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { standardRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { SourceMaterialService, type AddSourceInput } from "../services/source-material.js";
import { ChapterSourceService } from "../services/chapter-source.js";
import { DriveService } from "../services/drive.js";
import { validateDriveId } from "../utils/drive-query.js";

const sources = new Hono<{ Bindings: Env }>();

// Auth is enforced globally in index.ts
sources.use("*", standardRateLimit);

/**
 * POST /projects/:projectId/sources
 * Add source materials from Google Picker selection.
 * Accepts Google Docs directly and/or folders (expanded recursively to Docs).
 * Now accepts optional connectionId to track which Drive account the source is from.
 */
sources.post("/projects/:projectId/sources", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as {
    files?: AddSourceInput[];
    connectionId?: string;
  };

  if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
    validationError("files array is required and must not be empty");
  }

  const files: AddSourceInput[] = body.files;

  // Validate each file has required fields and a safe Drive ID
  for (const file of files) {
    if (!file.driveFileId || !file.title || !file.mimeType) {
      validationError("Each file must have driveFileId, title, and mimeType");
    }
    validateDriveId(file.driveFileId);
  }

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const driveService = new DriveService(c.env);
  const created = await service.addSources(
    userId,
    projectId,
    files,
    driveService,
    body.connectionId,
  );

  return c.json(created, 201);
});

/**
 * POST /projects/:projectId/sources/upload
 * Upload a local file (.txt or .md) as a source material.
 * Max file size: 5MB. Deduplicates on content hash.
 */
sources.post("/projects/:projectId/sources/upload", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    validationError("A file is required");
  }

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const source = await service.addLocalSource(userId, projectId, {
    name: file.name,
    content: await file.arrayBuffer(),
  });

  return c.json({ source }, 201);
});

/**
 * GET /projects/:projectId/sources
 * List source materials for a project.
 */
sources.get("/projects/:projectId/sources", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const list = await service.listSources(userId, projectId);

  return c.json({ sources: list });
});

/**
 * GET /sources/:sourceId/content
 * Get cached source content. Lazy-fetches from Google Drive on first access.
 */
sources.get("/sources/:sourceId/content", async (c) => {
  const { userId } = c.get("auth");
  const sourceId = c.req.param("sourceId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const driveService = new DriveService(c.env);
  const result = await service.getContent(userId, sourceId, driveService);

  return c.json(result);
});

/**
 * DELETE /sources/:sourceId
 * Remove a source material (soft delete).
 */
sources.delete("/sources/:sourceId", async (c) => {
  const { userId } = c.get("auth");
  const sourceId = c.req.param("sourceId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  await service.removeSource(userId, sourceId);

  return c.json({ success: true });
});

/**
 * POST /sources/:sourceId/import-as-chapter
 * Import source content as a new chapter.
 * Creates chapter in D1/R2, then fire-and-forget Drive file creation.
 */
sources.post("/sources/:sourceId/import-as-chapter", async (c) => {
  const { userId } = c.get("auth");
  const sourceId = c.req.param("sourceId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const driveService = new DriveService(c.env);
  const result = await service.importAsChapter(userId, sourceId, driveService);

  // Fire-and-forget: create Drive file for the new chapter (same pattern as chapter POST)
  driveService
    .getValidTokens(userId)
    .then(async (tokens) => {
      if (!tokens) return;

      const project = await c.env.DB.prepare(
        `SELECT drive_folder_id FROM projects WHERE id = ? AND user_id = ?`,
      )
        .bind(result.projectId, userId)
        .first<{ drive_folder_id: string | null }>();

      if (!project?.drive_folder_id) return;

      // Upload the chapter content to Drive
      const encoder = new TextEncoder();
      const content = await c.env.EXPORTS_BUCKET.get(result.r2Key);
      const html = content ? await content.text() : "";
      const driveFile = await driveService.uploadFile(
        tokens.accessToken,
        project.drive_folder_id,
        `${result.title}.html`,
        "text/html",
        encoder.encode(html).buffer as ArrayBuffer,
      );

      // Store drive_file_id on the chapter
      await c.env.DB.prepare(`UPDATE chapters SET drive_file_id = ? WHERE id = ?`)
        .bind(driveFile.id, result.chapterId)
        .run();
    })
    .catch((err) => {
      console.error("Drive file creation on source import failed (non-blocking):", err);
    });

  return c.json(
    {
      chapterId: result.chapterId,
      title: result.title,
      wordCount: result.wordCount,
    },
    201,
  );
});

/**
 * GET /chapters/:chapterId/sources
 * List linked sources for a chapter (active links only).
 */
sources.get("/chapters/:chapterId/sources", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");

  const service = new ChapterSourceService(c.env.DB);
  const linkedSources = await service.getLinkedSources(userId, chapterId);

  return c.json({ sources: linkedSources });
});

/**
 * POST /chapters/:chapterId/sources/:sourceId/link
 * Link a source to a chapter. Reactivates archived links.
 */
sources.post("/chapters/:chapterId/sources/:sourceId/link", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");
  const sourceId = c.req.param("sourceId");

  const service = new ChapterSourceService(c.env.DB);
  await service.linkSource(userId, chapterId, sourceId);

  return c.json({ success: true }, 201);
});

/**
 * DELETE /chapters/:chapterId/sources/:sourceId/link
 * Unlink a source from a chapter (soft-archive).
 */
sources.delete("/chapters/:chapterId/sources/:sourceId/link", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");
  const sourceId = c.req.param("sourceId");

  const service = new ChapterSourceService(c.env.DB);
  await service.unlinkSource(userId, chapterId, sourceId);

  return c.json({ success: true });
});

export { sources };
