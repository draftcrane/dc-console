import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { ProjectService } from "../src/services/project.js";
import { seedUser, seedProject, seedChapter, cleanAll } from "./helpers/seed.js";

describe("ProjectService", () => {
  let service: ProjectService;
  let userId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new ProjectService(env.DB);
    const user = await seedUser();
    userId = user.id;
  });

  describe("createProject", () => {
    it("creates a project with a default 'Chapter 1'", async () => {
      const project = await service.createProject(userId, { title: "My Book" });

      expect(project.title).toBe("My Book");
      expect(project.status).toBe("active");
      expect(project.chapters).toHaveLength(1);
      expect(project.chapters[0].title).toBe("Chapter 1");
      expect(project.chapters[0].sortOrder).toBe(1);
      expect(project.totalWordCount).toBe(0);
    });

    it("trims title and description whitespace", async () => {
      const project = await service.createProject(userId, {
        title: "  Padded Title  ",
        description: "  Padded Desc  ",
      });
      expect(project.title).toBe("Padded Title");
      expect(project.description).toBe("Padded Desc");
    });

    it("rejects empty title", async () => {
      await expect(service.createProject(userId, { title: "" })).rejects.toThrow(
        "Title is required",
      );
    });

    it("rejects title over 500 characters", async () => {
      await expect(service.createProject(userId, { title: "x".repeat(501) })).rejects.toThrow(
        "Title must be at most 500 characters",
      );
    });
  });

  describe("listProjects", () => {
    it("returns only active projects", async () => {
      await seedProject(userId, { title: "Active", status: "active" });
      await seedProject(userId, { title: "Archived", status: "archived" });

      const projects = await service.listProjects(userId);

      expect(projects).toHaveLength(1);
      expect(projects[0].title).toBe("Active");
    });

    it("includes word count and chapter count", async () => {
      const proj = await seedProject(userId);
      await seedChapter(proj.id, { sortOrder: 1, wordCount: 100 });
      await seedChapter(proj.id, { sortOrder: 2, wordCount: 200 });

      const projects = await service.listProjects(userId);

      expect(projects[0].wordCount).toBe(300);
      expect(projects[0].chapterCount).toBe(2);
    });

    it("returns empty array when user has no projects", async () => {
      const projects = await service.listProjects(userId);
      expect(projects).toHaveLength(0);
    });
  });

  describe("getProject", () => {
    it("returns project with chapters", async () => {
      const proj = await seedProject(userId, { title: "My Book" });
      await seedChapter(proj.id, { title: "Chapter 1", sortOrder: 1, wordCount: 50 });
      await seedChapter(proj.id, { title: "Chapter 2", sortOrder: 2, wordCount: 75 });

      const result = await service.getProject(userId, proj.id);

      expect(result.title).toBe("My Book");
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0].title).toBe("Chapter 1");
      expect(result.totalWordCount).toBe(125);
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.getProject(userId, "nonexistent")).rejects.toThrow("Project not found");
    });

    it("throws NOT_FOUND for another user's project", async () => {
      const proj = await seedProject(userId);
      const other = await seedUser({ id: "other-user" });
      await expect(service.getProject(other.id, proj.id)).rejects.toThrow("Project not found");
    });

    it("throws NOT_FOUND for archived project", async () => {
      const archived = await seedProject(userId, { status: "archived" });
      await seedChapter(archived.id, { sortOrder: 1 });

      await expect(service.getProject(userId, archived.id)).rejects.toThrow("Project not found");
    });
  });

  describe("deleteProject", () => {
    it("soft-deletes by setting status to 'archived'", async () => {
      const proj = await seedProject(userId);
      await seedChapter(proj.id); // need at least one chapter

      await service.deleteProject(userId, proj.id);

      // Should no longer appear in active list
      const projects = await service.listProjects(userId);
      expect(projects).toHaveLength(0);

      // But the row still exists in DB
      const row = await env.DB.prepare(`SELECT status FROM projects WHERE id = ?`)
        .bind(proj.id)
        .first<{ status: string }>();
      expect(row!.status).toBe("archived");
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.deleteProject(userId, "nonexistent")).rejects.toThrow(
        "Project not found",
      );
    });
  });

  describe("updateProject", () => {
    it("updates title", async () => {
      const proj = await seedProject(userId, { title: "Old Title" });
      const updated = await service.updateProject(userId, proj.id, { title: "New Title" });
      expect(updated.title).toBe("New Title");
    });

    it("updates description", async () => {
      const proj = await seedProject(userId);
      const updated = await service.updateProject(userId, proj.id, {
        description: "New description",
      });
      expect(updated.description).toBe("New description");
    });

    it("rejects empty title", async () => {
      const proj = await seedProject(userId);
      await expect(service.updateProject(userId, proj.id, { title: "   " })).rejects.toThrow(
        "Title cannot be empty",
      );
    });
  });
});
