/**
 * Research clip routes -- CRUD for user-saved research snippets.
 *
 * Routes:
 * - POST /projects/:projectId/research/clips - Save a clip
 * - GET /projects/:projectId/research/clips - List clips (optional ?chapterId=xxx)
 * - DELETE /research/clips/:clipId - Delete a clip
 *
 * All routes require authentication (enforced globally in index.ts).
 */

import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { standardRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { ResearchClipService, type CreateClipInput } from "../services/research-clip.js";

const research = new Hono<{ Bindings: Env }>();

// Auth is enforced globally in index.ts
research.use("*", standardRateLimit);

/**
 * POST /projects/:projectId/research/clips
 * Save a research clip.
 *
 * Deduplication: same content + sourceId returns existing clip (200)
 * instead of creating a duplicate (201).
 */
research.post("/projects/:projectId/research/clips", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as Partial<CreateClipInput>;

  if (!body.content || typeof body.content !== "string") {
    validationError("content is required");
  }

  if (!body.sourceTitle || typeof body.sourceTitle !== "string") {
    validationError("sourceTitle is required");
  }

  const service = new ResearchClipService(c.env.DB);
  const { clip, existed } = await service.createClip(userId, projectId, {
    content: body.content,
    sourceTitle: body.sourceTitle,
    sourceId: body.sourceId ?? null,
    sourceLocation: body.sourceLocation ?? null,
    chapterId: body.chapterId ?? null,
  });

  return c.json(clip, existed ? 200 : 201);
});

/**
 * GET /projects/:projectId/research/clips
 * List research clips for a project.
 *
 * Optional query param: ?chapterId=xxx for chapter filtering.
 */
research.get("/projects/:projectId/research/clips", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const chapterId = c.req.query("chapterId") || undefined;

  const service = new ResearchClipService(c.env.DB);
  const clips = await service.listClips(userId, projectId, chapterId);

  return c.json({ clips });
});

/**
 * DELETE /research/clips/:clipId
 * Delete a research clip.
 *
 * Authorization: verifies clip belongs to user's project.
 */
research.delete("/research/clips/:clipId", async (c) => {
  const { userId } = c.get("auth");
  const clipId = c.req.param("clipId");

  const service = new ResearchClipService(c.env.DB);
  await service.deleteClip(userId, clipId);

  return c.json({ success: true });
});

export { research };
