/**
 * AI Instructions routes — CRUD for saved analysis/rewrite instructions.
 *
 * Routes:
 * - GET    /instructions           — List (optional ?type=analysis|rewrite)
 * - POST   /instructions           — Create {label, instructionText, type}
 * - PATCH  /instructions/:id       — Update {label?, instructionText?}
 * - DELETE /instructions/:id       — Delete
 *
 * All routes require authentication (enforced globally in index.ts).
 * Mounted under /ai in index.ts, so full paths are /ai/instructions/...
 */

import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { standardRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import {
  AIInstructionsService,
  type CreateInstructionInput,
  type UpdateInstructionInput,
} from "../services/ai-instructions.js";

const aiInstructions = new Hono<{ Bindings: Env }>();

aiInstructions.use("*", standardRateLimit);

/**
 * GET /instructions
 * List instructions for the authenticated user.
 * Optional query param: ?type=analysis|rewrite
 */
aiInstructions.get("/instructions", async (c) => {
  const { userId } = c.get("auth");
  const type = c.req.query("type");

  const service = new AIInstructionsService(c.env.DB);
  const instructions = await service.list(userId, type);

  return c.json({ instructions });
});

/**
 * POST /instructions
 * Create a new instruction.
 */
aiInstructions.post("/instructions", async (c) => {
  const { userId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as Partial<CreateInstructionInput>;

  if (!body.label || typeof body.label !== "string") {
    validationError("label is required");
  }

  if (!body.instructionText || typeof body.instructionText !== "string") {
    validationError("instructionText is required");
  }

  if (!body.type || typeof body.type !== "string") {
    validationError("type is required");
  }

  const service = new AIInstructionsService(c.env.DB);
  const instruction = await service.create(userId, {
    label: body.label,
    instructionText: body.instructionText,
    type: body.type as "analysis" | "rewrite",
  });

  return c.json({ instruction }, 201);
});

/**
 * PATCH /instructions/:id
 * Update an existing instruction.
 */
aiInstructions.patch("/instructions/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Partial<UpdateInstructionInput>;

  if (body.label !== undefined && typeof body.label !== "string") {
    validationError("label must be a string");
  }

  if (body.instructionText !== undefined && typeof body.instructionText !== "string") {
    validationError("instructionText must be a string");
  }

  if (body.label === undefined && body.instructionText === undefined) {
    validationError("At least one of label or instructionText must be provided");
  }

  const service = new AIInstructionsService(c.env.DB);
  const instruction = await service.update(userId, id, {
    label: body.label,
    instructionText: body.instructionText,
  });

  return c.json({ instruction });
});

/**
 * DELETE /instructions/:id
 * Delete an instruction.
 */
aiInstructions.delete("/instructions/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const service = new AIInstructionsService(c.env.DB);
  await service.delete(userId, id);

  return c.json({ success: true });
});

export { aiInstructions };
