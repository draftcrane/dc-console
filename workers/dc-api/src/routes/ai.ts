import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { validationError } from "../middleware/error-handler.js";
import { aiRateLimit } from "../middleware/rate-limit.js";
import { AIRewriteService, type RewriteInput } from "../services/ai-rewrite.js";
import { AIInteractionService } from "../services/ai-interaction.js";
import { OpenAIProvider, WorkersAIProvider } from "../services/ai-provider.js";

const ai = new Hono<{ Bindings: Env }>();

// Auth is enforced globally in index.ts
// Rate limit: 10 req/min for AI endpoints (applied after auth)
ai.use("/rewrite", aiRateLimit);

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
 * - tier: "edge" | "frontier" (optional) - AI tier to use (default from env)
 *
 * Response: SSE stream with events:
 * - { type: "start", interactionId: string, attemptNumber: number } - Stream started
 * - { type: "token", text: string } - Each token as it arrives
 * - { type: "done", interactionId: string } - Stream complete
 * - { type: "error", message: string } - Error occurred
 */
ai.post("/rewrite", async (c) => {
  const { userId } = c.get("auth");

  const body = (await c.req.json().catch(() => ({}))) as Partial<RewriteInput> & {
    tier?: "edge" | "frontier";
  };

  const defaultTier = (c.env.AI_DEFAULT_TIER as "edge" | "frontier") || "frontier";
  const tier = body.tier === "edge" || body.tier === "frontier" ? body.tier : defaultTier;

  const provider =
    tier === "edge"
      ? new WorkersAIProvider(c.env.AI)
      : new OpenAIProvider(c.env.AI_API_KEY, c.env.AI_MODEL);

  const service = new AIRewriteService(c.env.DB, provider);

  const input: RewriteInput = {
    selectedText: body.selectedText ?? "",
    instruction: body.instruction ?? "",
    contextBefore: body.contextBefore ?? "",
    contextAfter: body.contextAfter ?? "",
    chapterTitle: body.chapterTitle ?? "",
    projectDescription: body.projectDescription ?? "",
    chapterId: body.chapterId ?? "",
    parentInteractionId: body.parentInteractionId,
    tier,
  };

  const validationErr = service.validateInput(input);
  if (validationErr) {
    validationError(validationErr);
  }

  const { stream } = await service.streamRewrite(userId, input);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
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
