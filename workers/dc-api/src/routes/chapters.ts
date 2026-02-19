import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { standardRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { ChapterService } from "../services/chapter.js";
import { ContentService } from "../services/content.js";
import { DriveService } from "../services/drive.js";

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
 * All routes require authentication (enforced globally in index.ts).
 * Authorization: All queries include WHERE user_id = ? via project ownership
 */
const chapters = new Hono<{ Bindings: Env }>();

// Auth is enforced globally in index.ts
chapters.use("*", standardRateLimit);

/**
 * POST /projects/:projectId/chapters
 * Create a new chapter at the end of the list
 *
 * Per PRD US-010: "+" button creates chapter at end of list with editable title
 * If Drive is connected and project has a folder, creates an HTML file on Drive.
 */
chapters.post("/projects/:projectId/chapters", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };

  const service = new ChapterService(c.env.DB);
  const chapter = await service.createChapter(userId, projectId, {
    title: body.title,
  });

  // If Drive is connected and project has a folder, create an HTML file on Drive (fire-and-forget)
  // Uses project.drive_connection_id for multi-account token lookup
  const driveService = new DriveService(c.env);
  (async () => {
    // Check if project has a Drive folder and connection
    const project = await c.env.DB.prepare(
      `SELECT drive_folder_id, drive_connection_id FROM projects WHERE id = ? AND user_id = ?`,
    )
      .bind(projectId, userId)
      .first<{ drive_folder_id: string | null; drive_connection_id: string | null }>();

    if (!project?.drive_folder_id) return;

    // Get tokens via connection or fallback
    let accessToken: string;
    if (project.drive_connection_id) {
      const tokens = await driveService.getValidTokensByConnection(project.drive_connection_id);
      if (!tokens) return;
      accessToken = tokens.accessToken;
    } else {
      const tokens = await driveService.getValidTokens(userId);
      if (!tokens) return;
      accessToken = tokens.accessToken;
    }

    // Create empty HTML file on Drive
    const fileName = `${chapter.title}.html`;
    const emptyHtml = "";
    const encoder = new TextEncoder();
    const driveFile = await driveService.uploadFile(
      accessToken,
      project.drive_folder_id,
      fileName,
      "text/html",
      encoder.encode(emptyHtml).buffer as ArrayBuffer,
    );

    // Store drive_file_id on the chapter
    await c.env.DB.prepare(`UPDATE chapters SET drive_file_id = ? WHERE id = ?`)
      .bind(driveFile.id, chapter.id)
      .run();
  })().catch((err) => {
    console.error("Drive file creation on chapter create failed (non-blocking):", err);
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

  const service = new ChapterService(c.env.DB);
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

  const service = new ChapterService(c.env.DB);
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

  const service = new ChapterService(c.env.DB);
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

  const service = new ChapterService(c.env.DB);
  const chapter = await service.updateChapter(userId, chapterId, body);

  // If title was updated and chapter has a Drive file, rename it (fire-and-forget)
  // Per PRD US-013: If Drive is connected, Drive file renamed to match new chapter title
  if (body.title !== undefined && chapter.driveFileId) {
    const driveService = new DriveService(c.env);
    (async () => {
      // Get project's drive_connection_id for token lookup
      const project = await c.env.DB.prepare(
        `SELECT drive_connection_id FROM projects WHERE id = (SELECT project_id FROM chapters WHERE id = ?)`,
      )
        .bind(chapterId)
        .first<{ drive_connection_id: string | null }>();

      let accessToken: string;
      if (project?.drive_connection_id) {
        const tokens = await driveService.getValidTokensByConnection(project.drive_connection_id);
        if (!tokens) return;
        accessToken = tokens.accessToken;
      } else {
        const tokens = await driveService.getValidTokens(userId);
        if (!tokens) return;
        accessToken = tokens.accessToken;
      }

      await driveService.renameFile(accessToken, chapter.driveFileId!, chapter.title);
    })().catch((err) => {
      console.error("Drive file rename failed (non-blocking):", err);
    });
  }

  return c.json(chapter);
});

/**
 * DELETE /chapters/:chapterId
 * Delete a chapter
 *
 * Per PRD US-014: Confirmation required. Hard delete in D1.
 * Minimum one chapter per project - rejects if last chapter.
 * If Drive is connected and chapter has a Drive file, trash it.
 */
chapters.delete("/chapters/:chapterId", async (c) => {
  const { userId } = c.get("auth");
  const chapterId = c.req.param("chapterId");

  const service = new ChapterService(c.env.DB);
  const { driveFileId } = await service.deleteChapter(userId, chapterId);

  // If the chapter had a Drive file, move it to trash (best effort)
  if (driveFileId) {
    try {
      const driveService = new DriveService(c.env);
      const tokens = await driveService.getValidTokens(userId);
      if (tokens) {
        await driveService.trashFile(tokens.accessToken, driveFileId);
      }
    } catch (err) {
      // Log but don't fail the delete - D1 record is already gone
      console.warn("Failed to trash Drive file for deleted chapter:", err);
    }
  }

  return c.json({ success: true });
});

/**
 * PUT /chapters/:chapterId/content
 * Save chapter content (Tier 2 of auto-save).
 *
 * Per US-015:
 * - Writes content to R2 (fast cache)
 * - Updates D1 metadata: word_count, version, updated_at
 * - Returns 409 CONFLICT on version mismatch
 * - No content stored in D1 (Tier 3 metadata only)
 *
 * Per ADR-005 (Drive write-through):
 * - After R2 save, syncs content to Google Drive (fire-and-forget)
 * - 30s coalescing via KV to avoid hammering Google API (~2s auto-save cadence)
 * - Lazy migration: creates Drive file if drive_file_id is null but Drive is connected
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

  // Capture validated values for use in async closure
  const content: string = body.content;

  const service = new ContentService(c.env.DB, c.env.EXPORTS_BUCKET);
  const result = await service.saveContent(userId, chapterId, {
    content,
    version: body.version,
  });

  // Drive write-through (fire-and-forget, follows rename/trash pattern)
  // Coalesce writes to 30s intervals to avoid hitting Google API rate limits
  // Uses project.drive_connection_id for token lookup (multi-account aware)
  const driveWriteThrough = async () => {
    // Check coalescing: skip if last Drive write was <30s ago
    const coalesceKey = `drive-sync:${chapterId}`;
    const lastSync = await c.env.CACHE.get(coalesceKey);
    if (lastSync) return; // Within 30s window, skip

    const driveService = new DriveService(c.env);

    // Get chapter's drive_file_id and project's drive info
    const chapter = await c.env.DB.prepare(
      `SELECT ch.drive_file_id, ch.title, p.drive_folder_id, p.drive_connection_id
       FROM chapters ch
       JOIN projects p ON p.id = ch.project_id
       WHERE ch.id = ? AND p.user_id = ?`,
    )
      .bind(chapterId, userId)
      .first<{
        drive_file_id: string | null;
        title: string;
        drive_folder_id: string | null;
        drive_connection_id: string | null;
      }>();

    if (!chapter?.drive_folder_id) return; // No Drive folder on project

    // Get tokens: prefer project's drive_connection_id, fall back to user's first connection
    let accessToken: string;
    if (chapter.drive_connection_id) {
      const tokens = await driveService.getValidTokensByConnection(chapter.drive_connection_id);
      if (!tokens) return; // Connection tokens invalid
      accessToken = tokens.accessToken;
    } else {
      // Fallback: project has drive_folder_id but no drive_connection_id (pre-migration data)
      console.warn(
        `Project missing drive_connection_id but has drive_folder_id, falling back to user connection`,
      );
      const tokens = await driveService.getValidTokens(userId);
      if (!tokens) return;
      accessToken = tokens.accessToken;
    }

    // Mark coalescing window (30s TTL)
    await c.env.CACHE.put(coalesceKey, String(Date.now()), { expirationTtl: 30 });

    if (chapter.drive_file_id) {
      // Update existing Drive file
      await driveService.updateFile(accessToken, chapter.drive_file_id, "text/html", content);
    } else {
      // Lazy migration: create Drive file for this chapter
      const fileName = `${chapter.title}.html`;
      const encoder = new TextEncoder();
      const driveFile = await driveService.uploadFile(
        accessToken,
        chapter.drive_folder_id,
        fileName,
        "text/html",
        encoder.encode(content).buffer as ArrayBuffer,
      );

      // Store drive_file_id
      await c.env.DB.prepare(`UPDATE chapters SET drive_file_id = ? WHERE id = ?`)
        .bind(driveFile.id, chapterId)
        .run();
    }
  };

  driveWriteThrough().catch((err) => {
    console.error("Drive write-through failed (non-blocking):", err);
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
