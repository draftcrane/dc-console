import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { feedbackRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { FeedbackService } from "../services/feedback.js";

/**
 * Feedback API routes (#341)
 *
 * - POST /feedback - Submit a bug report or feature suggestion
 * - GET /feedback - List user's own feedback (cursor pagination)
 *
 * All routes require authentication (enforced globally in index.ts).
 */
const feedback = new Hono<{ Bindings: Env }>();

feedback.use("*", feedbackRateLimit);

/**
 * POST /feedback
 * Submit a bug report or feature suggestion.
 *
 * Body: { type: "bug" | "suggestion", description: string, context?: object }
 * Returns 201 with { id, type, status, createdAt }
 */
feedback.post("/", async (c) => {
  const { userId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as {
    type?: string;
    description?: string;
    context?: Record<string, unknown>;
  };

  if (!body.type) {
    validationError("type is required");
  }
  if (!body.description) {
    validationError("description is required");
  }

  const service = new FeedbackService(c.env.DB);
  const result = await service.createFeedback(userId, {
    type: body.type,
    description: body.description,
    context: body.context ?? {},
  });

  return c.json(result, 201);
});

/**
 * GET /feedback
 * List the current user's feedback submissions.
 *
 * Query params: cursor (string), limit (number, max 50)
 */
feedback.get("/", async (c) => {
  const { userId } = c.get("auth");
  const cursor = c.req.query("cursor") || undefined;
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const service = new FeedbackService(c.env.DB);
  const result = await service.listFeedback(userId, { cursor, limit });

  return c.json(result);
});

export { feedback };
