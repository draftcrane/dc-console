import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { ResearchClipService } from "../src/services/research-clip.js";
import {
  seedUser,
  seedProject,
  seedChapter,
  seedSource,
  seedClip,
  cleanAll,
} from "./helpers/seed.js";

describe("ResearchClipService", () => {
  let service: ResearchClipService;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new ResearchClipService(env.DB);
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  describe("createClip", () => {
    it("creates a new clip", async () => {
      const { clip, isNew } = await service.createClip(userId, projectId, {
        sourceTitle: "Interview Notes",
        snippetText: "This is a test snippet from the interview.",
      });

      expect(isNew).toBe(true);
      expect(clip.projectId).toBe(projectId);
      expect(clip.sourceTitle).toBe("Interview Notes");
      expect(clip.snippetText).toBe("This is a test snippet from the interview.");
      expect(clip.sourceId).toBeNull();
      expect(clip.chapterId).toBeNull();
      expect(clip.id).toBeTruthy();
    });

    it("creates a clip with sourceId and chapterId", async () => {
      const source = await seedSource(projectId);
      const chapter = await seedChapter(projectId);

      const { clip, isNew } = await service.createClip(userId, projectId, {
        sourceId: source.id,
        sourceTitle: source.title,
        snippetText: "Snippet with source and chapter",
        chapterId: chapter.id,
      });

      expect(isNew).toBe(true);
      expect(clip.sourceId).toBe(source.id);
      expect(clip.chapterId).toBe(chapter.id);
    });

    it("deduplicates on same snippet text", async () => {
      const text = "Exact same text for dedup test.";

      const first = await service.createClip(userId, projectId, {
        sourceTitle: "Source A",
        snippetText: text,
      });
      expect(first.isNew).toBe(true);

      const second = await service.createClip(userId, projectId, {
        sourceTitle: "Source B",
        snippetText: text,
      });
      expect(second.isNew).toBe(false);
      expect(second.clip.id).toBe(first.clip.id);
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(
        service.createClip(userId, "fake-project-id", {
          sourceTitle: "Test",
          snippetText: "Test",
        }),
      ).rejects.toThrow("Project not found");
    });

    it("throws NOT_FOUND for project owned by different user", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const otherProject = await seedProject(otherUser.id);

      await expect(
        service.createClip(userId, otherProject.id, {
          sourceTitle: "Test",
          snippetText: "Test",
        }),
      ).rejects.toThrow("Project not found");
    });
  });

  describe("listClips", () => {
    it("returns clips ordered by created_at DESC (most recent first)", async () => {
      await seedClip(projectId, userId, {
        snippetText: "First clip",
        createdAt: "2026-01-01T00:00:00Z",
      });
      await seedClip(projectId, userId, {
        snippetText: "Second clip",
        createdAt: "2026-01-02T00:00:00Z",
      });
      await seedClip(projectId, userId, {
        snippetText: "Third clip",
        createdAt: "2026-01-03T00:00:00Z",
      });

      const { clips, count } = await service.listClips(userId, projectId);

      expect(count).toBe(3);
      expect(clips[0].snippetText).toBe("Third clip");
      expect(clips[1].snippetText).toBe("Second clip");
      expect(clips[2].snippetText).toBe("First clip");
    });

    it("filters by chapterId", async () => {
      const chapter = await seedChapter(projectId, { title: "Chapter 1" });
      await seedClip(projectId, userId, { snippetText: "Tagged clip", chapterId: chapter.id });
      await seedClip(projectId, userId, { snippetText: "Untagged clip" });

      const { clips } = await service.listClips(userId, projectId, chapter.id);

      expect(clips).toHaveLength(1);
      expect(clips[0].snippetText).toBe("Tagged clip");
    });

    it("includes chapter title via JOIN", async () => {
      const chapter = await seedChapter(projectId, { title: "Chapter 3: Discussion" });
      await seedClip(projectId, userId, { chapterId: chapter.id });

      const { clips } = await service.listClips(userId, projectId);

      expect(clips[0].chapterTitle).toBe("Chapter 3: Discussion");
    });

    it("returns empty array for project with no clips", async () => {
      const { clips, count } = await service.listClips(userId, projectId);

      expect(clips).toHaveLength(0);
      expect(count).toBe(0);
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.listClips(userId, "fake-project")).rejects.toThrow("Project not found");
    });

    it("does not leak clips from other users", async () => {
      await seedClip(projectId, userId, { snippetText: "My clip" });

      const otherUser = await seedUser({ id: "other-user-list" });
      const otherProject = await seedProject(otherUser.id);
      await seedClip(otherProject.id, otherUser.id, { snippetText: "Other user clip" });

      const { clips } = await service.listClips(userId, projectId);
      expect(clips).toHaveLength(1);
      expect(clips[0].snippetText).toBe("My clip");
    });
  });

  describe("deleteClip", () => {
    it("deletes a clip", async () => {
      const clip = await seedClip(projectId, userId);

      await service.deleteClip(userId, clip.id);

      const { clips } = await service.listClips(userId, projectId);
      expect(clips).toHaveLength(0);
    });

    it("throws NOT_FOUND for non-existent clip", async () => {
      await expect(service.deleteClip(userId, "fake-clip-id")).rejects.toThrow("Clip not found");
    });

    it("prevents deleting another user's clip", async () => {
      const otherUser = await seedUser({ id: "other-user-delete" });
      const otherProject = await seedProject(otherUser.id);
      const otherClip = await seedClip(otherProject.id, otherUser.id);

      await expect(service.deleteClip(userId, otherClip.id)).rejects.toThrow("Clip not found");
    });
  });
});
