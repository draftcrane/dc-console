/**
 * Source material routes -- reference material from Google Drive and local uploads.
 *
 * Routes:
 * - POST /projects/:projectId/sources - Add Drive sources from Google Picker selection
 * - POST /projects/:projectId/sources/upload - Upload local file (.txt, .md)
 * - GET /projects/:projectId/sources - List sources for a project
 * - POST /projects/:projectId/sources/remediate-markdown - Reprocess cached local Markdown sources
 * - GET /sources/:sourceId/content - Get cached source content (lazy-fetches from Drive)
 * - DELETE /sources/:sourceId - Remove a source
 * - POST /sources/:sourceId/import-as-chapter - Import source as a new chapter
 *
 * All routes require authentication and enforce ownership via project JOIN.
 *
 * Note: Linked folder routes (project_linked_folders, linked_folder_exclusions) were
 * removed in the Library Model v2 migration. Tables are preserved (forward-only migrations).
 */

import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { standardRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { SourceMaterialService, type AddSourceInput } from "../services/source-material.js";
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
 * POST /projects/:projectId/sources/remediate-markdown
 * Reprocess cached local Markdown sources to remove unsafe legacy HTML and rebuild FTS.
 */
sources.post("/projects/:projectId/sources/remediate-markdown", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const result = await service.remediateLocalMarkdownSources(userId, projectId);

  return c.json(result);
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
 * PATCH /sources/:sourceId/restore
 * Restore a previously removed (archived) source. Used for undo-remove.
 */
sources.patch("/sources/:sourceId/restore", async (c) => {
  const { userId } = c.get("auth");
  const sourceId = c.req.param("sourceId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const source = await service.restoreSource(userId, sourceId);

  return c.json({ source });
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
 * GET /projects/:projectId/source-connections
 * List Drive connections linked to this project for research input.
 */
sources.get("/projects/:projectId/source-connections", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const connections = await service.listProjectConnections(userId, projectId);

  return c.json({ connections });
});

/**
 * POST /projects/:projectId/source-connections
 * Link a Drive connection to this project for research input.
 */
sources.post("/projects/:projectId/source-connections", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as {
    driveConnectionId?: string;
  };

  if (!body.driveConnectionId) {
    validationError("driveConnectionId is required");
  }

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  const connection = await service.linkConnection(userId, projectId, body.driveConnectionId);

  return c.json({ connection }, 201);
});

/**
 * DELETE /projects/:projectId/source-connections/:connId
 * Unlink a Drive connection from this project. Archives its source materials.
 */
sources.delete("/projects/:projectId/source-connections/:connId", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const connId = c.req.param("connId");

  const service = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  await service.unlinkConnection(userId, projectId, connId);

  return c.json({ success: true });
});

export { sources };
