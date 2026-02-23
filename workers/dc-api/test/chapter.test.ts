import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { ChapterService } from "../src/services/chapter.js";
import { seedUser, seedProject, seedChapter, cleanAll } from "./helpers/seed.js";

describe("ChapterService", () => {
  let service: ChapterService;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new ChapterService(env.DB);
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  describe("createChapter", () => {
    it("creates a chapter with auto-incremented sort_order", async () => {
      await seedChapter(projectId, { sortOrder: 1 });

      const ch = await service.createChapter(userId, projectId, { title: "Chapter 2" });

      expect(ch.title).toBe("Chapter 2");
      expect(ch.sortOrder).toBe(2);
      expect(ch.version).toBe(1);
      expect(ch.wordCount).toBe(0);
      expect(ch.status).toBe("draft");
    });

    it("defaults title to 'Untitled Chapter' when empty", async () => {
      const ch = await service.createChapter(userId, projectId, { title: "" });
      expect(ch.title).toBe("Untitled Chapter");
    });

    it("defaults title to 'Untitled Chapter' when omitted", async () => {
      const ch = await service.createChapter(userId, projectId);
      expect(ch.title).toBe("Untitled Chapter");
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.createChapter(userId, "nonexistent")).rejects.toThrow(
        "Project not found",
      );
    });

    it("throws NOT_FOUND for project owned by another user", async () => {
      const other = await seedUser({ id: "other-user" });
      await expect(service.createChapter(other.id, projectId)).rejects.toThrow("Project not found");
    });
  });

  describe("listChapters", () => {
    it("lists chapters in sort_order", async () => {
      await seedChapter(projectId, { title: "B", sortOrder: 2 });
      await seedChapter(projectId, { title: "A", sortOrder: 1 });

      const chapters = await service.listChapters(userId, projectId);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe("A");
      expect(chapters[1].title).toBe("B");
    });

    it("returns empty array for project with no chapters", async () => {
      const chapters = await service.listChapters(userId, projectId);
      expect(chapters).toHaveLength(0);
    });
  });

  describe("updateChapter", () => {
    it("updates chapter title", async () => {
      const ch = await seedChapter(projectId);
      const updated = await service.updateChapter(userId, ch.id, { title: "New Title" });
      expect(updated.title).toBe("New Title");
    });

    it("updates chapter status", async () => {
      const ch = await seedChapter(projectId);
      const updated = await service.updateChapter(userId, ch.id, { status: "review" });
      expect(updated.status).toBe("review");
    });

    it("reverts empty title to 'Untitled Chapter'", async () => {
      const ch = await seedChapter(projectId);
      const updated = await service.updateChapter(userId, ch.id, { title: "  " });
      expect(updated.title).toBe("Untitled Chapter");
    });
  });

  describe("deleteChapter", () => {
    it("deletes a chapter", async () => {
      await seedChapter(projectId, { sortOrder: 1 });
      const ch2 = await seedChapter(projectId, { sortOrder: 2 });

      await service.deleteChapter(userId, ch2.id);

      const remaining = await service.listChapters(userId, projectId);
      expect(remaining).toHaveLength(1);
    });

    it("rejects deleting the last chapter", async () => {
      const ch = await seedChapter(projectId);
      await expect(service.deleteChapter(userId, ch.id)).rejects.toThrow(
        "Cannot delete the last chapter",
      );
    });
  });

  describe("reorderChapters", () => {
    it("updates sort_order for all chapters", async () => {
      const ch1 = await seedChapter(projectId, { title: "First", sortOrder: 1 });
      const ch2 = await seedChapter(projectId, { title: "Second", sortOrder: 2 });

      const reordered = await service.reorderChapters(userId, projectId, {
        chapterIds: [ch2.id, ch1.id],
      });

      expect(reordered[0].title).toBe("Second");
      expect(reordered[0].sortOrder).toBe(1);
      expect(reordered[1].title).toBe("First");
      expect(reordered[1].sortOrder).toBe(2);
    });

    it("rejects when not all chapters are included", async () => {
      const ch1 = await seedChapter(projectId, { sortOrder: 1 });
      await seedChapter(projectId, { sortOrder: 2 });

      await expect(
        service.reorderChapters(userId, projectId, { chapterIds: [ch1.id] }),
      ).rejects.toThrow("All chapters must be included");
    });
  });

  describe("getChapter", () => {
    it("returns a chapter by ID", async () => {
      const ch = await seedChapter(projectId, { title: "My Chapter" });
      const result = await service.getChapter(userId, ch.id);
      expect(result.title).toBe("My Chapter");
      expect(result.projectId).toBe(projectId);
    });

    it("throws NOT_FOUND for another user's chapter", async () => {
      const ch = await seedChapter(projectId);
      const other = await seedUser({ id: "other-user-2" });
      await expect(service.getChapter(other.id, ch.id)).rejects.toThrow("Chapter not found");
    });

    it("throws NOT_FOUND when parent project is archived", async () => {
      const archivedProject = await seedProject(userId, { status: "archived" });
      const ch = await seedChapter(archivedProject.id);

      await expect(service.getChapter(userId, ch.id)).rejects.toThrow("Chapter not found");
    });
  });
});
