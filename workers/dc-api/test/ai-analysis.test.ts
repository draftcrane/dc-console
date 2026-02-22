import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  AIAnalysisService,
  loadSourceContent,
  buildAnalysisUserMessage,
} from "../src/services/ai-analysis.js";
import { chunkStructuredHtml } from "../src/services/chunking.js";
import { seedUser, seedProject, seedSourceWithContent, cleanAll } from "./helpers/seed.js";
import type { AIProvider, AIStreamEvent } from "../src/services/ai-provider.js";

/** Mock AIProvider that yields predefined tokens */
function createMockProvider(tokens: string[]): AIProvider {
  return {
    model: "mock-model",
    async streamCompletion() {
      let index = 0;
      return new ReadableStream<AIStreamEvent>({
        pull(controller) {
          if (index < tokens.length) {
            controller.enqueue({ type: "token", text: tokens[index] });
            index++;
          } else {
            controller.enqueue({ type: "done" });
            controller.close();
          }
        },
      });
    },
  };
}

/** Mock AIProvider that yields an error */
function createErrorProvider(message: string): AIProvider {
  return {
    model: "mock-model",
    async streamCompletion() {
      return new ReadableStream<AIStreamEvent>({
        start(controller) {
          controller.enqueue({ type: "error", message });
          controller.close();
        },
      });
    },
  };
}

/** Read full SSE stream into parsed events */
async function readSSEStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Record<string, unknown>[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Record<string, unknown>[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data) {
            events.push(JSON.parse(data));
          }
        }
      }
    }
  }

  return events;
}

describe("AIAnalysisService", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  describe("validateInput", () => {
    it("returns null for valid input", () => {
      const provider = createMockProvider([]);
      const service = new AIAnalysisService(env.DB, env.EXPORTS_BUCKET, provider);
      const result = service.validateInput({
        sourceId: "source-123",
        instruction: "Summarize this",
      });
      expect(result).toBeNull();
    });

    it("rejects empty sourceId", () => {
      const provider = createMockProvider([]);
      const service = new AIAnalysisService(env.DB, env.EXPORTS_BUCKET, provider);
      expect(service.validateInput({ sourceId: "", instruction: "Test" })).toBe(
        "sourceId is required",
      );
    });

    it("rejects empty instruction", () => {
      const provider = createMockProvider([]);
      const service = new AIAnalysisService(env.DB, env.EXPORTS_BUCKET, provider);
      expect(service.validateInput({ sourceId: "id", instruction: "" })).toBe(
        "instruction is required",
      );
    });

    it("rejects instruction exceeding max length", () => {
      const provider = createMockProvider([]);
      const service = new AIAnalysisService(env.DB, env.EXPORTS_BUCKET, provider);
      expect(service.validateInput({ sourceId: "id", instruction: "a".repeat(2001) })).toMatch(
        /at most 2000/,
      );
    });
  });

  describe("loadSourceContent", () => {
    it("loads source content for the owner", async () => {
      const source = await seedSourceWithContent(projectId, "<p>Hello world</p>");

      const result = await loadSourceContent(env.DB, env.EXPORTS_BUCKET, userId, source.id);
      expect(result.html).toBe("<p>Hello world</p>");
      expect(result.title).toBe("Source Doc");
    });

    it("rejects access from non-owner", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const source = await seedSourceWithContent(projectId, "<p>Secret</p>");

      await expect(
        loadSourceContent(env.DB, env.EXPORTS_BUCKET, otherUser.id, source.id),
      ).rejects.toThrow("Source not found");
    });

    it("rejects nonexistent source", async () => {
      await expect(
        loadSourceContent(env.DB, env.EXPORTS_BUCKET, userId, "nonexistent"),
      ).rejects.toThrow("Source not found");
    });
  });

  describe("buildAnalysisUserMessage", () => {
    it("includes source title, content, and instruction", () => {
      const chunks = chunkStructuredHtml("s1", "My Source", "<p>Content goes here.</p>");
      const msg = buildAnalysisUserMessage("Summarize this", "My Source", chunks);

      expect(msg).toContain('Source: "My Source"');
      expect(msg).toContain("Content goes here");
      expect(msg).toContain("Summarize this");
    });
  });

  describe("streamAnalysis", () => {
    it("returns SSE stream with start, tokens, and done events", async () => {
      const source = await seedSourceWithContent(
        projectId,
        "<p>The quick brown fox jumped over the lazy dog. This is a test document with enough words to form a proper chunk for analysis purposes.</p>",
      );

      const provider = createMockProvider(["Hello", " ", "World"]);
      const service = new AIAnalysisService(env.DB, env.EXPORTS_BUCKET, provider);

      const { stream } = await service.streamAnalysis(userId, {
        sourceId: source.id,
        instruction: "Summarize this",
      });

      const events = await readSSEStream(stream);

      expect(events[0]).toEqual({ type: "start" });
      expect(events[1]).toEqual({ type: "token", text: "Hello" });
      expect(events[2]).toEqual({ type: "token", text: " " });
      expect(events[3]).toEqual({ type: "token", text: "World" });
      expect(events[4]).toEqual({ type: "done" });
    });

    it("propagates AI provider errors as SSE error events", async () => {
      const source = await seedSourceWithContent(
        projectId,
        "<p>Some content for testing error handling in the analysis service.</p>",
      );

      const provider = createErrorProvider("Model overloaded");
      const service = new AIAnalysisService(env.DB, env.EXPORTS_BUCKET, provider);

      const { stream } = await service.streamAnalysis(userId, {
        sourceId: source.id,
        instruction: "Analyze this",
      });

      const events = await readSSEStream(stream);

      expect(events[0]).toEqual({ type: "start" });
      expect(events[1]).toEqual({ type: "error", message: "Model overloaded" });
    });

    it("rejects analysis of source not owned by user", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const otherProject = await seedProject(otherUser.id);
      const source = await seedSourceWithContent(otherProject.id, "<p>Secret data</p>");

      const provider = createMockProvider(["Should", "not", "reach"]);
      const service = new AIAnalysisService(env.DB, env.EXPORTS_BUCKET, provider);

      await expect(
        service.streamAnalysis(userId, {
          sourceId: source.id,
          instruction: "Steal this",
        }),
      ).rejects.toThrow("Source not found");
    });
  });
});
