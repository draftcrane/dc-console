import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { requireAuth } from "../middleware/auth.js";
import { standardRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { ProjectService } from "../services/project.js";
import { ContentService } from "../services/content.js";

/**
 * Chapters API routes
 *
 * Per PRD Section 12:
 * - POST /projects/:projectId/chapters - Creates chapter, creates Drive/R2 file
 * - GET /projects/:projectId/chapters - Lists chapters (metadata only)
 * - PATCH /chapters/:chapterId - Updates title, status
 * - DELETE /chapters/:chapterId - Deletes from D1, trashes Drive file. Rejects if last chapter.
 * - PATCH /projects/:projectId/chapters/reorder - Batch sort_order update
 *
 * Per US-015 (Three-Tier Save Architecture):
 * - PUT /chapters/:chapterId/content - Save content to R2, update D1 metadata
 * - GET /chapters/:chapterId/content - Load content from R2
 *
 * All routes require authentication.
 * Authorization: All queries include WHERE user_id = ? via project ownership
 */
const chapters = new Hono<{ Bindings: Env }>();

// All chapter routes require authentication
chapters.use("*", requireAuth);
chapters.use("*", standardRateLimit);

/**
 * POST /projects/:projectId/chapters
 * Create a new chapter at the end of the list
 *
 * Per PRD US-010: "+" button creates chapter at end of list with editable title
 */
chapters.post("/projects/:projectId/chapters", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };

  const service = new ProjectService(c.env.DB);
  const chapter = await service.createChapter(userId, projectId, {
    title: body.title,
  });

  return c.json(chapter, 201);
});

/**
 * GET /projects/:projectId/chapters
 * List chapters for a project (metadata only)
 */
chapters.get("/projects/:projectId/chapters", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const service = new ProjectService(c.env.DB);
  const chapterList = await service.listChapters(userId, projectId);

  return c.json({ chapters: chapterList });
});

/**
 * PATCH /projects/:projectId/chapters/reorder
 * Batch update of sort_order
 *
 * Per PRD US-012A: Long-press-and-drag reorder
 */
chapters.patch("/projects/:projectId/chapters/reorder", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as { chapterIds?: string[] };

  if (!body.chapterIds || !Array.isArray(body.chapterIds)) {
    validationError("chapterIds array is required");
  }

  const service = new ProjectService(c.env.DB);
  const reorderedChapters = await service.reorderChapters(userId, projectId, {
    chapterIds: body.chapterIds,
  });

  return c.json({ chapters: reorderedChapters });
});

/**
 * GET /chapters/:chapterId
 * Get a single chapter by ID
 */
chapters.get("/chapters/:chapterId", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");

  const service = new ProjectService(c.env.DB);
  const chapter = await service.getChapter(userId, chapterId);

  return c.json(chapter);
});

/**
 * PATCH /chapters/:chapterId
 * Update chapter title and/or status
 *
 * Per PRD US-013: Inline editing via double-tap. Max 200 characters.
 */
chapters.patch("/chapters/:chapterId", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string;
    status?: "draft" | "review" | "final";
  };

  // At least one field should be provided
  if (body.title === undefined && body.status === undefined) {
    validationError("At least one of title or status must be provided");
  }

  const service = new ProjectService(c.env.DB);
  const chapter = await service.updateChapter(userId, chapterId, body);

  return c.json(chapter);
});

/**
 * DELETE /chapters/:chapterId
 * Delete a chapter
 *
 * Per PRD US-014: Confirmation required. Hard delete in D1.
 * Minimum one chapter per project - rejects if last chapter.
 */
chapters.delete("/chapters/:chapterId", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");

  const service = new ProjectService(c.env.DB);
  await service.deleteChapter(userId, chapterId);

  return c.json({ success: true });
});

/**
 * PUT /chapters/:chapterId/content
 * Save chapter content (Tier 2 of auto-save).
 *
 * Per US-015:
 * - Writes content to R2 (or Drive if connected)
 * - Updates D1 metadata: word_count, version, updated_at
 * - Returns 409 CONFLICT on version mismatch
 * - No content stored in D1 (Tier 3 metadata only)
 */
chapters.put("/chapters/:chapterId/content", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");
  const body = (await c.req.json().catch(() => ({}))) as {
    content?: string;
    version?: number;
  };

  if (body.content === undefined) {
    validationError("content is required");
  }

  if (body.version === undefined || typeof body.version !== "number") {
    validationError("version number is required");
  }

  const service = new ContentService(c.env.DB, c.env.EXPORTS_BUCKET);
  const result = await service.saveContent(userId, chapterId, {
    content: body.content,
    version: body.version,
  });

  return c.json(result);
});

/**
 * GET /chapters/:chapterId/content
 * Load chapter content from R2.
 *
 * Per US-015: Used by editor to load content and for crash recovery comparison.
 */
chapters.get("/chapters/:chapterId/content", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");

  const service = new ContentService(c.env.DB, c.env.EXPORTS_BUCKET);
  const result = await service.getContent(userId, chapterId);

  return c.json(result);
});

export { chapters };
