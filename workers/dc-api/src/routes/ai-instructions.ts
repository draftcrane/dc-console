import { Hono } from "hono";
import type { Env } from "../types";
import { validationError } from "../middleware";
import { AIInstructionService } from "../services/ai-instructions";
import { standardRateLimit } from "../middleware/rate-limit";

const instructions = new Hono<{ Bindings: Env }>();

instructions.use("*", standardRateLimit);

// GET /ai/instructions?type=...
instructions.get("/", async (c) => {
  const { userId } = c.get("auth");
  const type = c.req.query("type");

  if (type && type !== "analysis" && type !== "rewrite") {
    validationError("Invalid 'type' query parameter. Must be 'analysis' or 'rewrite'.");
  }

  const service = new AIInstructionService(c.env.DB);
  const result = await service.listForUser(userId, type as "analysis" | "rewrite" | undefined);

  return c.json({ instructions: result });
});

// POST /ai/instructions
instructions.post("/", async (c) => {
  const { userId } = c.get("auth");
  const body = await c.req.json<{
    label: string;
    instructionText: string;
    type: "analysis" | "rewrite";
  }>();

  if (!body.label || !body.instructionText || !body.type) {
    validationError("Missing required fields: label, instructionText, type");
  }
  if (body.type !== "analysis" && body.type !== "rewrite") {
    validationError("Invalid 'type'. Must be 'analysis' or 'rewrite'.");
  }

  const service = new AIInstructionService(c.env.DB);
  const newInstruction = await service.create(userId, body);

  return c.json(newInstruction, 201);
});

// DELETE /ai/instructions/:id
instructions.delete("/:id", async (c) => {
  const { userId } = c.get("auth");
  const id = c.req.param("id");

  const service = new AIInstructionService(c.env.DB);
  await service.delete(id, userId);

  return new Response(null, { status: 204 });
});

export { instructions };
