import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { AIRewriteService, type RewriteInput } from "../src/services/ai-rewrite.js";
import type { AIProvider, AIStreamEvent } from "../src/services/ai-provider.js";
import { seedUser, seedProject, seedChapter, cleanAll } from "./helpers/seed.js";

/**
 * Mock AIProvider that returns a simple ReadableStream of AIStreamEvents.
 * Allows tests to verify the service's stream-wrapping and D1 interaction
 * logging without calling a real AI API.
 */
const mockProvider: AIProvider = {
  model: "test-model",
  async streamCompletion() {
    return new ReadableStream<AIStreamEvent>({
      start(controller) {
        controller.enqueue({ type: "token", text: "Hello " });
        controller.enqueue({ type: "token", text: "world" });
        controller.enqueue({ type: "done" });
        controller.close();
      },
    });
  },
};

/**
 * Helper to build a valid RewriteInput with sensible defaults.
 */
function validInput(overrides?: Partial<RewriteInput>): RewriteInput {
  return {
    selectedText: "Some text to rewrite",
    instruction: "Make it better",
    contextBefore: "Before context",
    contextAfter: "After context",
    chapterTitle: "Chapter One",
    projectDescription: "A test book",
    chapterId: "test-chapter-id",
    ...overrides,
  };
}

describe("AIRewriteService", () => {
  let service: AIRewriteService;

  beforeEach(async () => {
    // Clean all tables including ai_interactions to avoid FK constraint issues
    await env.DB.exec(`
      DELETE FROM ai_interactions;
      DELETE FROM export_jobs;
      DELETE FROM chapters;
      DELETE FROM projects;
      DELETE FROM users;
    `);
    service = new AIRewriteService(env.DB, mockProvider);
  });

  describe("validateInput", () => {
    it("returns null for valid input", () => {
      const result = service.validateInput(validInput());
      expect(result).toBeNull();
    });

    it("returns error for empty selectedText", () => {
      const result = service.validateInput(validInput({ selectedText: "" }));
      expect(result).toBe("Selected text is required");
    });

    it("returns error for whitespace-only selectedText", () => {
      const result = service.validateInput(validInput({ selectedText: "   " }));
      expect(result).toBe("Selected text is required");
    });

    it("returns error for selectedText over 10000 chars", () => {
      const result = service.validateInput(validInput({ selectedText: "x".repeat(10001) }));
      expect(result).toBe("Selected text must be at most 10000 characters");
    });

    it("returns null for selectedText exactly at 10000 chars", () => {
      const result = service.validateInput(validInput({ selectedText: "x".repeat(10000) }));
      expect(result).toBeNull();
    });

    it("returns error for empty instruction", () => {
      const result = service.validateInput(validInput({ instruction: "" }));
      expect(result).toBe("Instruction is required");
    });

    it("returns error for whitespace-only instruction", () => {
      const result = service.validateInput(validInput({ instruction: "   " }));
      expect(result).toBe("Instruction is required");
    });

    it("returns error for instruction over 500 chars", () => {
      const result = service.validateInput(validInput({ instruction: "x".repeat(501) }));
      expect(result).toBe("Instruction must be at most 500 characters");
    });

    it("returns null for instruction exactly at 500 chars", () => {
      const result = service.validateInput(validInput({ instruction: "x".repeat(500) }));
      expect(result).toBeNull();
    });

    it("returns error for empty chapterId", () => {
      const result = service.validateInput(validInput({ chapterId: "" }));
      expect(result).toBe("Chapter ID is required");
    });

    it("returns error for whitespace-only chapterId", () => {
      const result = service.validateInput(validInput({ chapterId: "   " }));
      expect(result).toBe("Chapter ID is required");
    });
  });

  describe("streamRewrite", () => {
    let userId: string;
    let chapterId: string;

    beforeEach(async () => {
      const user = await seedUser();
      userId = user.id;
      const project = await seedProject(userId);
      const chapter = await seedChapter(project.id);
      chapterId = chapter.id;
    });

    it("creates an interaction record in D1", async () => {
      const input = validInput({ chapterId });

      const { interactionId } = await service.streamRewrite(userId, input);

      // Verify the row was created
      const row = await env.DB.prepare(
        `SELECT id, user_id, chapter_id, action, instruction, input_chars, model, attempt_number, tier
         FROM ai_interactions WHERE id = ?`,
      )
        .bind(interactionId)
        .first<{
          id: string;
          user_id: string;
          chapter_id: string;
          action: string;
          instruction: string;
          input_chars: number;
          model: string;
          attempt_number: number;
          tier: string;
        }>();

      expect(row).not.toBeNull();
      expect(row!.id).toBe(interactionId);
      expect(row!.user_id).toBe(userId);
      expect(row!.chapter_id).toBe(chapterId);
      expect(row!.action).toBe("rewrite");
      expect(row!.instruction).toBe("Make it better");
      expect(row!.input_chars).toBe(input.selectedText.length);
      expect(row!.model).toBe("test-model");
      expect(row!.attempt_number).toBe(1);
      expect(row!.tier).toBe("frontier");
    });

    it("returns a stream with start event containing interactionId", async () => {
      const input = validInput({ chapterId });

      const { stream, interactionId } = await service.streamRewrite(userId, input);

      // Read the SSE stream into text
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      // Parse SSE events — each event is "data: {json}\n\n"
      const events = fullText
        .split("\n\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.replace("data: ", "")));

      expect(events.length).toBeGreaterThanOrEqual(3);

      // First event: start with interactionId
      expect(events[0].type).toBe("start");
      expect(events[0].interactionId).toBe(interactionId);
      expect(events[0].attemptNumber).toBe(1);
      expect(events[0].tier).toBe("frontier");

      // Token events
      expect(events[1]).toEqual({ type: "token", text: "Hello " });
      expect(events[2]).toEqual({ type: "token", text: "world" });

      // Done event
      expect(events[3].type).toBe("done");
      expect(events[3].interactionId).toBe(interactionId);
    });

    it("increments attempt_number for retry chains", async () => {
      const input = validInput({ chapterId });

      // First interaction (the parent)
      const first = await service.streamRewrite(userId, input);
      // Consume the stream so the flush runs
      await consumeStream(first.stream);

      // Second interaction (retry of the first)
      const retryInput = validInput({
        chapterId,
        parentInteractionId: first.interactionId,
      });
      const second = await service.streamRewrite(userId, retryInput);
      await consumeStream(second.stream);

      // Verify attempt numbers
      const firstRow = await env.DB.prepare(
        `SELECT attempt_number FROM ai_interactions WHERE id = ?`,
      )
        .bind(first.interactionId)
        .first<{ attempt_number: number }>();
      expect(firstRow!.attempt_number).toBe(1);

      const secondRow = await env.DB.prepare(
        `SELECT attempt_number, parent_interaction_id FROM ai_interactions WHERE id = ?`,
      )
        .bind(second.interactionId)
        .first<{ attempt_number: number; parent_interaction_id: string }>();
      expect(secondRow!.attempt_number).toBe(2);
      expect(secondRow!.parent_interaction_id).toBe(first.interactionId);
    });

    it("records output_chars and latency_ms after stream completes", async () => {
      const input = validInput({ chapterId });

      const { stream, interactionId } = await service.streamRewrite(userId, input);

      // Before consuming — output_chars should be 0
      const before = await env.DB.prepare(
        `SELECT output_chars, latency_ms FROM ai_interactions WHERE id = ?`,
      )
        .bind(interactionId)
        .first<{ output_chars: number; latency_ms: number }>();
      expect(before!.output_chars).toBe(0);
      expect(before!.latency_ms).toBe(0);

      // Consume stream to trigger the TransformStream flush
      await consumeStream(stream);

      // After consuming — output_chars should reflect "Hello world" = 11 chars
      const after = await env.DB.prepare(
        `SELECT output_chars, latency_ms FROM ai_interactions WHERE id = ?`,
      )
        .bind(interactionId)
        .first<{ output_chars: number; latency_ms: number }>();
      expect(after!.output_chars).toBe(11); // "Hello " (6) + "world" (5)
      expect(after!.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it("sets tier to 'edge' when specified in input", async () => {
      const input = validInput({ chapterId, tier: "edge" });

      const { interactionId } = await service.streamRewrite(userId, input);

      const row = await env.DB.prepare(`SELECT tier FROM ai_interactions WHERE id = ?`)
        .bind(interactionId)
        .first<{ tier: string }>();
      expect(row!.tier).toBe("edge");
    });
  });
});

/**
 * Consume a ReadableStream fully, discarding all chunks.
 * This triggers the TransformStream's flush() callback.
 */
async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}
