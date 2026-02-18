import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { AIInteractionService } from "../src/services/ai-interaction.js";
import { seedUser, seedProject, seedChapter, cleanAll } from "./helpers/seed.js";
import { ulid } from "ulidx";

/**
 * Seed an ai_interactions row directly in D1.
 * Returns the row's id for use in tests.
 */
async function seedAIInteraction(
  userId: string,
  chapterId: string,
  overrides?: {
    id?: string;
    instruction?: string;
    accepted?: number | null;
    parentInteractionId?: string | null;
    attemptNumber?: number;
  },
): Promise<{ id: string }> {
  const id = overrides?.id ?? ulid();
  const instruction = overrides?.instruction ?? "Make it concise";
  const accepted = overrides?.accepted ?? null;
  const parentInteractionId = overrides?.parentInteractionId ?? null;
  const attemptNumber = overrides?.attemptNumber ?? 1;

  await env.DB.prepare(
    `INSERT INTO ai_interactions (id, user_id, chapter_id, action, instruction, input_chars, output_chars, model, latency_ms, accepted, attempt_number, parent_interaction_id, tier, created_at)
     VALUES (?, ?, ?, 'rewrite', ?, 150, 120, 'gpt-4o', 1200, ?, ?, ?, 'frontier', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
  )
    .bind(id, userId, chapterId, instruction, accepted, attemptNumber, parentInteractionId)
    .run();

  return { id };
}

describe("AIInteractionService", () => {
  let service: AIInteractionService;
  let userId: string;
  let chapterId: string;
  let interactionId: string;

  beforeEach(async () => {
    // Clean all tables in proper FK order
    await env.DB.exec(`
      DELETE FROM ai_interactions;
      DELETE FROM export_jobs;
      DELETE FROM chapters;
      DELETE FROM projects;
      DELETE FROM users;
    `);

    service = new AIInteractionService(env.DB);

    // Seed prerequisite data
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    const chapter = await seedChapter(project.id);
    chapterId = chapter.id;

    // Seed an ai_interaction row
    const interaction = await seedAIInteraction(userId, chapterId);
    interactionId = interaction.id;
  });

  describe("acceptInteraction", () => {
    it("sets accepted = true and returns mapped interaction", async () => {
      const result = await service.acceptInteraction(userId, interactionId);

      expect(result.id).toBe(interactionId);
      expect(result.accepted).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.chapterId).toBe(chapterId);
      expect(result.action).toBe("rewrite");
      expect(result.instruction).toBe("Make it concise");
      expect(result.inputChars).toBe(150);
      expect(result.outputChars).toBe(120);
      expect(result.model).toBe("gpt-4o");
      expect(result.latencyMs).toBe(1200);
      expect(result.attemptNumber).toBe(1);
      expect(result.parentInteractionId).toBeNull();
      expect(result.tier).toBe("frontier");

      // Verify persisted in D1
      const row = await env.DB.prepare(`SELECT accepted FROM ai_interactions WHERE id = ?`)
        .bind(interactionId)
        .first<{ accepted: number | null }>();
      expect(row!.accepted).toBe(1);
    });

    it("can accept an interaction that was previously null", async () => {
      // Verify it starts as null
      const before = await env.DB.prepare(`SELECT accepted FROM ai_interactions WHERE id = ?`)
        .bind(interactionId)
        .first<{ accepted: number | null }>();
      expect(before!.accepted).toBeNull();

      const result = await service.acceptInteraction(userId, interactionId);
      expect(result.accepted).toBe(true);
    });
  });

  describe("rejectInteraction", () => {
    it("sets accepted = false and returns mapped interaction", async () => {
      const result = await service.rejectInteraction(userId, interactionId);

      expect(result.id).toBe(interactionId);
      expect(result.accepted).toBe(false);
      expect(result.userId).toBe(userId);
      expect(result.chapterId).toBe(chapterId);
      expect(result.action).toBe("rewrite");

      // Verify persisted in D1
      const row = await env.DB.prepare(`SELECT accepted FROM ai_interactions WHERE id = ?`)
        .bind(interactionId)
        .first<{ accepted: number | null }>();
      expect(row!.accepted).toBe(0);
    });
  });

  describe("ownership check", () => {
    it("throws NOT_FOUND for another user's interaction", async () => {
      const other = await seedUser({ id: "other-user" });

      await expect(service.acceptInteraction(other.id, interactionId)).rejects.toThrow(
        "AI interaction not found",
      );

      await expect(service.rejectInteraction(other.id, interactionId)).rejects.toThrow(
        "AI interaction not found",
      );
    });
  });

  describe("NOT_FOUND", () => {
    it("throws for non-existent interaction ID on accept", async () => {
      await expect(service.acceptInteraction(userId, "nonexistent-id")).rejects.toThrow(
        "AI interaction not found",
      );
    });

    it("throws for non-existent interaction ID on reject", async () => {
      await expect(service.rejectInteraction(userId, "nonexistent-id")).rejects.toThrow(
        "AI interaction not found",
      );
    });
  });

  describe("retry chain mapping", () => {
    it("correctly maps parentInteractionId for retry interactions", async () => {
      // Seed a child interaction with parent
      const child = await seedAIInteraction(userId, chapterId, {
        parentInteractionId: interactionId,
        attemptNumber: 2,
      });

      const result = await service.acceptInteraction(userId, child.id);

      expect(result.parentInteractionId).toBe(interactionId);
      expect(result.attemptNumber).toBe(2);
    });
  });
});
