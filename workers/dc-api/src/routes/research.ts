/**
 * Research routes -- endpoints for the Research Companion panel.
 *
 * Routes:
 * - GET /projects/:projectId/research/sources/search?q=keyword - Full-text search
 * - POST /projects/:projectId/research/clips - Save a clip
 * - GET /projects/:projectId/research/clips - List clips (optional ?chapterId=xxx)
 * - DELETE /research/clips/:clipId - Delete a clip
 * - POST /projects/:projectId/research/query — Query sources with SSE streaming or JSON response
 *
 * All routes require authentication (enforced globally in index.ts).
 */

import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { standardRateLimit, rateLimit } from "../middleware/rate-limit.js";
import { validationError, AppError } from "../middleware/error-handler.js";
import { ResearchClipService, type CreateClipInput } from "../services/research-clip.js";
import { SourceSearchService } from "../services/source-search.js";
import {
  ResearchQueryService,
  NoSourcesError,
  AIUnavailableError,
  QueryFailedError,
  type ResearchQueryInput,
} from "../services/research-query.js";
import { AIAnalysisService, type AnalysisInput } from "../services/ai-analysis.js";
import { OpenAIProvider, WorkersAIProvider } from "../services/ai-provider.js";
import { DeepAnalysisService } from "../services/deep-analysis.js";

const research = new Hono<{ Bindings: Env }>();

// Auth is enforced globally in index.ts
research.use("*", standardRateLimit);

/**
 * GET /projects/:projectId/research/sources/search?q=keyword
 * Full-text search across source titles and content.
 * Uses FTS5 with LIKE fallback.
 */
research.get("/projects/:projectId/research/sources/search", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const q = c.req.query("q") ?? "";

  if (!q || q.trim().length < 2) {
    validationError("Search query must be at least 2 characters");
  }

  const service = new SourceSearchService(c.env.DB);
  const response = await service.search(userId, projectId, q);

  return c.json(response);
});

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

/** Research query rate limit: 20 req/min per user */
const researchQueryRateLimit = rateLimit({
  prefix: "research-query",
  maxRequests: 20,
  windowSeconds: 60,
});

/**
 * POST /projects/:projectId/research/query
 *
 * Natural language query against project sources.
 * Streams structured results with source citations via SSE.
 *
 * Request body:
 * - query: string (required, max 1000 chars)
 * - sourceIds: string[] (optional, limit to specific sources)
 *
 * Response (default): SSE stream with events:
 * - event: result — { content, sourceId, sourceTitle, sourceLocation, relevance }
 * - event: done — { resultCount, summary, processingTimeMs, queryId }
 * - event: error — { error, code }
 *
 * Response (Accept: application/json): JSON with results array
 */
research.post("/projects/:projectId/research/query", researchQueryRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  // Parse request body
  const body = (await c.req.json().catch(() => ({}))) as Partial<ResearchQueryInput>;

  const input: ResearchQueryInput = {
    query: body.query ?? "",
    sourceIds: body.sourceIds,
  };

  // Validate
  const service = new ResearchQueryService(
    c.env.DB,
    c.env.EXPORTS_BUCKET,
    c.env.AI_API_KEY,
    c.env.AI_MODEL || "gpt-4o",
  );

  const validationErr = service.validateInput(input);
  if (validationErr) {
    validationError(validationErr);
  }

  // Verify project ownership
  const project = await c.env.DB.prepare(
    `SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`,
  )
    .bind(projectId, userId)
    .first<{ id: string }>();

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  // Determine response format
  const acceptHeader = c.req.header("Accept") || "";
  const wantsJson =
    acceptHeader.includes("application/json") && !acceptHeader.includes("text/event-stream");

  try {
    const { result, queryId, latencyMs } = await service.executeQuery(userId, projectId, input);

    if (wantsJson) {
      // Non-streaming JSON fallback
      const jsonResult = service.buildJsonResponse(result, latencyMs);
      return c.json(jsonResult);
    }

    // SSE streaming (default)
    const stream = service.buildSSEStream(result, queryId, latencyMs);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof NoSourcesError) {
      if (wantsJson) {
        return c.json({ error: error.message, code: "NO_SOURCES" }, 400);
      }
      return sseErrorResponse("Project has no sources with cached content", "NO_SOURCES");
    }
    if (error instanceof AIUnavailableError) {
      if (wantsJson) {
        return c.json({ error: error.message, code: "AI_UNAVAILABLE" }, 503);
      }
      return sseErrorResponse("AI service unavailable", "AI_UNAVAILABLE");
    }
    if (error instanceof QueryFailedError) {
      if (wantsJson) {
        return c.json({ error: error.message, code: "QUERY_FAILED" }, 500);
      }
      return sseErrorResponse(error.message, "QUERY_FAILED");
    }
    throw error;
  }
});

/**
 * POST /projects/:projectId/research/analyze
 *
 * AI-powered analysis of a source document with a user instruction.
 * Streams the response via SSE (same format as /ai/rewrite).
 *
 * Request body:
 * - sourceId: string (required) - Source to analyze
 * - instruction: string (required) - What to analyze/extract
 *
 * Response: SSE stream with events:
 * - { type: "start" } - Stream started
 * - { type: "token", text: string } - Each token as it arrives
 * - { type: "done" } - Stream complete
 * - { type: "error", message: string } - Error occurred
 */
research.post("/projects/:projectId/research/analyze", researchQueryRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const body = (await c.req.json().catch(() => ({}))) as Partial<AnalysisInput> & {
    sourceId?: string;
  };

  // Verify project ownership
  const project = await c.env.DB.prepare(
    `SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`,
  )
    .bind(projectId, userId)
    .first<{ id: string }>();

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  // Accept sourceIds array or legacy sourceId string
  const sourceIds = body.sourceIds ?? (body.sourceId ? [body.sourceId] : []);

  const input: AnalysisInput = {
    sourceIds,
    instruction: body.instruction ?? "",
  };

  const defaultTier = (c.env.AI_DEFAULT_TIER as "edge" | "frontier") || "frontier";

  const provider =
    defaultTier === "edge"
      ? new WorkersAIProvider(c.env.AI)
      : new OpenAIProvider(c.env.AI_API_KEY, c.env.AI_MODEL);

  const service = new AIAnalysisService(c.env.DB, c.env.EXPORTS_BUCKET, provider);

  const err = service.validateInput(input);
  if (err) {
    validationError(err);
  }

  // Token estimation — decide inline vs async
  const threshold = DeepAnalysisService.getThreshold(c.env);
  const { total: estimatedTokens, hasUnknown } = await DeepAnalysisService.estimateSourceTokens(
    c.env.DB,
    userId,
    projectId,
    sourceIds,
  );

  if (DeepAnalysisService.shouldUseDeepAnalysis(estimatedTokens, hasUnknown, threshold)) {
    // Async path: create job, process via waitUntil
    const jobId = await DeepAnalysisService.createJob(
      c.env.DB,
      userId,
      projectId,
      sourceIds,
      input.instruction,
    );

    // Estimate batch count for the response
    const placeholders = sourceIds.map(() => "?").join(",");
    const sourceRows = await c.env.DB.prepare(
      `SELECT id, word_count FROM source_materials WHERE id IN (${placeholders}) AND status = 'active'`,
    )
      .bind(...sourceIds)
      .all<{ id: string; word_count: number }>();

    const sourceInfos = sourceRows.results.map((r) => ({
      id: r.id,
      wordCount: r.word_count,
    }));
    const totalBatches = DeepAnalysisService.partitionSources(sourceInfos).length;

    // Fire and forget
    c.executionCtx.waitUntil(DeepAnalysisService.processJob(c.env, jobId));

    return c.json({
      async: true,
      jobId,
      totalBatches,
      estimatedTokens,
    });
  }

  // Inline path: stream SSE with raised budget
  const { stream } = await service.streamAnalysis(userId, input);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

/**
 * GET /projects/:projectId/research/jobs/latest
 * Returns the most recent deep analysis job for a project.
 * Must be registered before /:jobId to avoid "latest" matching as a param.
 */
research.get("/projects/:projectId/research/jobs/latest", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const job = await DeepAnalysisService.getLatestJob(c.env.DB, userId, projectId);

  return c.json(job);
});

/**
 * GET /projects/:projectId/research/jobs/:jobId
 * Returns status and result for a specific deep analysis job.
 */
research.get("/projects/:projectId/research/jobs/:jobId", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const jobId = c.req.param("jobId");

  const job = await DeepAnalysisService.getJobStatus(c.env.DB, userId, projectId, jobId);
  if (!job) {
    throw new AppError(404, "NOT_FOUND", "Job not found");
  }

  return c.json(job);
});

/**
 * Build an SSE error response.
 */
function sseErrorResponse(message: string, code: string): Response {
  const encoder = new TextEncoder();
  const data = JSON.stringify({ error: message, code });
  const body = encoder.encode(`event: error\ndata: ${data}\n\n`);

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export { research };
