import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { ContentService } from "../src/services/content.js";
import { seedUser, seedProject, seedChapter, cleanAll } from "./helpers/seed.js";

describe("ContentService", () => {
  let service: ContentService;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new ContentService(env.DB, env.EXPORTS_BUCKET);
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  describe("saveContent", () => {
    it("saves content to R2 and increments version", async () => {
      const ch = await seedChapter(projectId, { version: 1 });

      const result = await service.saveContent(userId, ch.id, {
        content: "<p>Hello world</p>",
        version: 1,
      });

      expect(result.version).toBe(2);
      expect(result.wordCount).toBe(2);

      // Verify D1 metadata updated
      const row = await env.DB.prepare(
        `SELECT version, word_count, r2_key FROM chapters WHERE id = ?`,
      )
        .bind(ch.id)
        .first<{ version: number; word_count: number; r2_key: string }>();
      expect(row!.version).toBe(2);
      expect(row!.word_count).toBe(2);
      expect(row!.r2_key).toBe(`chapters/${ch.id}/content.html`);
    });

    it("throws 409 on version mismatch", async () => {
      const ch = await seedChapter(projectId, { version: 3 });

      await expect(
        service.saveContent(userId, ch.id, {
          content: "<p>Stale</p>",
          version: 2, // behind current
        }),
      ).rejects.toThrow("Version mismatch");
    });

    it("throws NOT_FOUND for another user's chapter", async () => {
      const ch = await seedChapter(projectId);
      const other = await seedUser({ id: "other-user" });

      await expect(
        service.saveContent(other.id, ch.id, { content: "test", version: 1 }),
      ).rejects.toThrow("Chapter not found");
    });
  });

  describe("getContent", () => {
    it("returns empty content for chapter with no r2_key", async () => {
      const ch = await seedChapter(projectId);
      const result = await service.getContent(userId, ch.id);

      expect(result.content).toBe("");
      expect(result.version).toBe(1);
    });

    it("round-trips content through R2", async () => {
      const ch = await seedChapter(projectId, { version: 1 });
      const html = "<p>Some <strong>rich</strong> content</p>";

      await service.saveContent(userId, ch.id, { content: html, version: 1 });
      const result = await service.getContent(userId, ch.id);

      expect(result.content).toBe(html);
      expect(result.version).toBe(2);
    });

    it("throws NOT_FOUND for non-existent chapter", async () => {
      await expect(service.getContent(userId, "nonexistent")).rejects.toThrow("Chapter not found");
    });
  });
});
