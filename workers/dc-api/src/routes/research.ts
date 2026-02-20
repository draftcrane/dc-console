/**
 * Research routes -- clips management for the research board.
 *
 * Routes:
 * - POST /projects/:projectId/research/clips - Save a new clip
 * - GET /projects/:projectId/research/clips - List clips (optional ?chapterId filter)
 * - DELETE /research/clips/:clipId - Delete a clip
 *
 * All routes require authentication and enforce ownership via project JOIN.
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
 * Save a text snippet as a clip.
 */
research.post("/projects/:projectId/research/clips", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as Partial<CreateClipInput>;

  if (!body.snippetText || typeof body.snippetText !== "string" || body.snippetText.trim() === "") {
    validationError("snippetText is required");
  }

  if (!body.sourceTitle || typeof body.sourceTitle !== "string") {
    validationError("sourceTitle is required");
  }

  const service = new ResearchClipService(c.env.DB);
  const { clip, isNew } = await service.createClip(userId, projectId, {
    sourceId: body.sourceId ?? null,
    sourceTitle: body.sourceTitle,
    snippetText: body.snippetText,
    chapterId: body.chapterId ?? null,
  });

  return c.json({ clip }, isNew ? 201 : 200);
});

/**
 * GET /projects/:projectId/research/clips
 * List clips for a project, most recent first.
 * Optional query: ?chapterId=xxx to filter by chapter.
 */
research.get("/projects/:projectId/research/clips", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const chapterId = c.req.query("chapterId") || undefined;

  const service = new ResearchClipService(c.env.DB);
  const result = await service.listClips(userId, projectId, chapterId);

  return c.json(result);
});

/**
 * DELETE /research/clips/:clipId
 * Delete a saved clip.
 */
research.delete("/research/clips/:clipId", async (c) => {
  const { userId } = c.get("auth");
  const clipId = c.req.param("clipId");

  const service = new ResearchClipService(c.env.DB);
  await service.deleteClip(userId, clipId);

  return c.json({ success: true });
});

export { research };
