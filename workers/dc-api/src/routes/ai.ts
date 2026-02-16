import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validationError, rateLimited } from "../middleware/error-handler.js";
import { AIRewriteService, type RewriteInput } from "../services/ai-rewrite.js";
import { AIInteractionService } from "../services/ai-interaction.js";
import { OpenAIProvider } from "../services/ai-provider.js";

/**
 * AI API routes
 *
 * Per PRD Section 12:
 * - POST /ai/rewrite - Streams AI rewrite via SSE
 *
 * Per PRD US-017:
 * - Sends selected text + instruction + context
 * - Response streams via SSE
 * - Rate limit: 10 req/min/user
 *
 * Per PRD US-018:
 * - POST /ai/interactions/:id/accept - Record acceptance of AI rewrite result
 * - POST /ai/interactions/:id/reject - Record rejection of AI rewrite result
 */
const ai = new Hono<{ Bindings: Env }>();

// All AI routes require authentication
ai.use("*", requireAuth);

/**
 * POST /ai/rewrite
 *
 * Request body:
 * - selectedText: string (required) - The text to rewrite
 * - instruction: string (required) - How to rewrite it
 * - contextBefore: string (optional) - Up to 500 chars before selection
 * - contextAfter: string (optional) - Up to 500 chars after selection
 * - chapterTitle: string (optional) - Chapter title for context
 * - projectDescription: string (optional) - Project description for context
 * - chapterId: string (required) - Chapter ID for logging
 *
 * Response: SSE stream with events:
 * - { type: "token", text: string } - Each token as it arrives
 * - { type: "done", interactionId: string } - Stream complete
 * - { type: "error", message: string } - Error occurred
 */
ai.post("/rewrite", async (c) => {
  const { userId } = c.get("auth");

  const provider = new OpenAIProvider(c.env.OPENAI_API_KEY, c.env.AI_MODEL);
  const service = new AIRewriteService(c.env.DB, c.env.CACHE, provider);

  // Check rate limit
  const { allowed, remaining } = await service.checkRateLimit(userId);
  if (!allowed) {
    rateLimited("You've used AI rewrite frequently. Please wait a moment.");
  }

  // Parse and validate input
  const body = (await c.req.json().catch(() => ({}))) as Partial<RewriteInput>;

  const input: RewriteInput = {
    selectedText: body.selectedText ?? "",
    instruction: body.instruction ?? "",
    contextBefore: body.contextBefore ?? "",
    contextAfter: body.contextAfter ?? "",
    chapterTitle: body.chapterTitle ?? "",
    projectDescription: body.projectDescription ?? "",
    chapterId: body.chapterId ?? "",
    parentInteractionId: body.parentInteractionId,
  };

  const validationErr = service.validateInput(input);
  if (validationErr) {
    validationError(validationErr);
  }

  // Stream the rewrite
  const { stream } = await service.streamRewrite(userId, input);

  // Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-RateLimit-Remaining": String(remaining),
    },
  });
});

/**
 * POST /ai/interactions/:id/accept
 * Record that the user accepted the AI rewrite result.
 * Updates the interaction metadata (accepted = true).
 */
ai.post("/interactions/:id/accept", async (c) => {
  const { userId } = c.get("auth");
  const interactionId = c.req.param("id");

  const service = new AIInteractionService(c.env.DB);
  const interaction = await service.acceptInteraction(userId, interactionId);

  return c.json(interaction);
});

/**
 * POST /ai/interactions/:id/reject
 * Record that the user rejected/discarded the AI rewrite result.
 * Updates the interaction metadata (accepted = false).
 */
ai.post("/interactions/:id/reject", async (c) => {
  const { userId } = c.get("auth");
  const interactionId = c.req.param("id");

  const service = new AIInteractionService(c.env.DB);
  const interaction = await service.rejectInteraction(userId, interactionId);

  return c.json(interaction);
});

export { ai };
