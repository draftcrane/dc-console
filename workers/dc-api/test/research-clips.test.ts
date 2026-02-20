import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { ResearchClipService } from "../src/services/research-clip.js";
import {
  seedUser,
  seedProject,
  seedSource,
  seedChapter,
  seedClip,
  cleanAll,
} from "./helpers/seed.js";

const BASE = "http://localhost";

/** Convenience helper: build headers that authenticate as the given userId. */
function authHeaders(userId: string, extra?: Record<string, string>): Record<string, string> {
  return {
    "X-Test-User-Id": userId,
    ...extra,
  };
}

/** JSON request helper. */
async function jsonRequest(
  method: string,
  path: string,
  userId: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: authHeaders(userId, { "Content-Type": "application/json" }),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return SELF.fetch(`${BASE}${path}`, init);
}

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------
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
    it("creates a clip with required fields", async () => {
      const { clip, existed } = await service.createClip(userId, projectId, {
        content: "Important finding from research",
        sourceTitle: "Interview Notes",
      });

      expect(existed).toBe(false);
      expect(clip.id).toBeTruthy();
      expect(clip.projectId).toBe(projectId);
      expect(clip.content).toBe("Important finding from research");
      expect(clip.sourceTitle).toBe("Interview Notes");
      expect(clip.sourceId).toBeNull();
      expect(clip.sourceLocation).toBeNull();
      expect(clip.chapterId).toBeNull();
      expect(clip.chapterTitle).toBeNull();
      expect(clip.createdAt).toBeTruthy();
    });

    it("creates a clip with all optional fields", async () => {
      const source = await seedSource(projectId, { title: "Research Paper" });
      const chapter = await seedChapter(projectId, { title: "Chapter 3" });

      const { clip, existed } = await service.createClip(userId, projectId, {
        content: "Key insight about methodology",
        sourceTitle: "Research Paper",
        sourceId: source.id,
        sourceLocation: "Page 42, paragraph 3",
        chapterId: chapter.id,
      });

      expect(existed).toBe(false);
      expect(clip.sourceId).toBe(source.id);
      expect(clip.sourceLocation).toBe("Page 42, paragraph 3");
      expect(clip.chapterId).toBe(chapter.id);
      expect(clip.chapterTitle).toBe("Chapter 3");
    });

    it("deduplicates same content + sourceId in a project", async () => {
      const source = await seedSource(projectId);

      const first = await service.createClip(userId, projectId, {
        content: "Duplicate content",
        sourceTitle: "Source Doc",
        sourceId: source.id,
      });
      expect(first.existed).toBe(false);

      const second = await service.createClip(userId, projectId, {
        content: "Duplicate content",
        sourceTitle: "Source Doc",
        sourceId: source.id,
      });
      expect(second.existed).toBe(true);
      expect(second.clip.id).toBe(first.clip.id);
    });

    it("allows same content from different sources", async () => {
      const source1 = await seedSource(projectId, { title: "Source A", driveFileId: "a1" });
      const source2 = await seedSource(projectId, {
        title: "Source B",
        driveFileId: "b1",
        sortOrder: 2,
      });

      const first = await service.createClip(userId, projectId, {
        content: "Same content",
        sourceTitle: "Source A",
        sourceId: source1.id,
      });

      const second = await service.createClip(userId, projectId, {
        content: "Same content",
        sourceTitle: "Source B",
        sourceId: source2.id,
      });

      expect(first.existed).toBe(false);
      expect(second.existed).toBe(false);
      expect(first.clip.id).not.toBe(second.clip.id);
    });

    it("allows duplicate content when sourceId is null (no dedup)", async () => {
      const first = await service.createClip(userId, projectId, {
        content: "Unlinked content",
        sourceTitle: "Manual Clip",
      });

      const second = await service.createClip(userId, projectId, {
        content: "Unlinked content",
        sourceTitle: "Manual Clip",
      });

      expect(first.existed).toBe(false);
      expect(second.existed).toBe(false);
      expect(first.clip.id).not.toBe(second.clip.id);
    });

    it("rejects empty content", async () => {
      await expect(
        service.createClip(userId, projectId, {
          content: "",
          sourceTitle: "Source",
        }),
      ).rejects.toThrow("content is required");
    });

    it("rejects whitespace-only content", async () => {
      await expect(
        service.createClip(userId, projectId, {
          content: "   ",
          sourceTitle: "Source",
        }),
      ).rejects.toThrow("content is required");
    });

    it("rejects empty sourceTitle", async () => {
      await expect(
        service.createClip(userId, projectId, {
          content: "Some content",
          sourceTitle: "",
        }),
      ).rejects.toThrow("sourceTitle is required");
    });

    it("rejects content exceeding 10KB", async () => {
      const largeContent = "x".repeat(10 * 1024 + 1);

      await expect(
        service.createClip(userId, projectId, {
          content: largeContent,
          sourceTitle: "Source",
        }),
      ).rejects.toThrow("Content exceeds maximum size");
    });

    it("allows content at exactly 10KB", async () => {
      const maxContent = "x".repeat(10 * 1024);

      const { clip, existed } = await service.createClip(userId, projectId, {
        content: maxContent,
        sourceTitle: "Source",
      });

      expect(existed).toBe(false);
      expect(clip.content).toBe(maxContent);
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(
        service.createClip(userId, "nonexistent", {
          content: "Content",
          sourceTitle: "Source",
        }),
      ).rejects.toThrow("Project not found");
    });

    it("throws NOT_FOUND for project owned by another user", async () => {
      const other = await seedUser({ id: "other-user" });

      await expect(
        service.createClip(other.id, projectId, {
          content: "Content",
          sourceTitle: "Source",
        }),
      ).rejects.toThrow("Project not found");
    });
  });

  describe("listClips", () => {
    it("lists clips ordered by created_at DESC", async () => {
      await seedClip(projectId, {
        content: "Older clip",
        sourceTitle: "S1",
        createdAt: "2026-01-01T00:00:00Z",
      });
      await seedClip(projectId, {
        content: "Newer clip",
        sourceTitle: "S2",
        createdAt: "2026-02-01T00:00:00Z",
      });

      const clips = await service.listClips(userId, projectId);

      expect(clips).toHaveLength(2);
      expect(clips[0].content).toBe("Newer clip");
      expect(clips[1].content).toBe("Older clip");
    });

    it("returns empty array when no clips exist", async () => {
      const clips = await service.listClips(userId, projectId);
      expect(clips).toHaveLength(0);
    });

    it("filters by chapterId", async () => {
      const chapter = await seedChapter(projectId, { title: "Ch1" });
      await seedClip(projectId, {
        content: "Linked clip",
        chapterId: chapter.id,
      });
      await seedClip(projectId, { content: "Unlinked clip" });

      const filtered = await service.listClips(userId, projectId, chapter.id);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].content).toBe("Linked clip");
    });

    it("includes chapterTitle from joined chapters", async () => {
      const chapter = await seedChapter(projectId, { title: "My Chapter" });
      await seedClip(projectId, {
        content: "Clip with chapter",
        chapterId: chapter.id,
      });

      const clips = await service.listClips(userId, projectId);

      expect(clips[0].chapterTitle).toBe("My Chapter");
    });

    it("preserves sourceTitle when source is removed (sourceId becomes null)", async () => {
      const source = await seedSource(projectId, { title: "Original Source" });
      await seedClip(projectId, {
        content: "Clip from source",
        sourceId: source.id,
        sourceTitle: "Original Source",
      });

      // Simulate ON DELETE SET NULL by updating the clip
      await env.DB.prepare(`UPDATE research_clips SET source_id = NULL WHERE source_id = ?`)
        .bind(source.id)
        .run();

      const clips = await service.listClips(userId, projectId);

      expect(clips[0].sourceId).toBeNull();
      expect(clips[0].sourceTitle).toBe("Original Source");
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.listClips(userId, "nonexistent")).rejects.toThrow("Project not found");
    });
  });

  describe("deleteClip", () => {
    it("deletes a clip", async () => {
      const clip = await seedClip(projectId, { content: "To delete" });

      await service.deleteClip(userId, clip.id);

      const clips = await service.listClips(userId, projectId);
      expect(clips).toHaveLength(0);
    });

    it("hard deletes from the database", async () => {
      const clip = await seedClip(projectId);

      await service.deleteClip(userId, clip.id);

      const row = await env.DB.prepare(`SELECT id FROM research_clips WHERE id = ?`)
        .bind(clip.id)
        .first();
      expect(row).toBeNull();
    });

    it("throws NOT_FOUND for non-existent clip", async () => {
      await expect(service.deleteClip(userId, "nonexistent")).rejects.toThrow("Clip not found");
    });

    it("throws NOT_FOUND for clip in another user's project", async () => {
      const other = await seedUser({ id: "other-user" });
      const otherProject = await seedProject(other.id, { title: "Other Project" });
      const clip = await seedClip(otherProject.id, { content: "Other's clip" });

      await expect(service.deleteClip(userId, clip.id)).rejects.toThrow("Clip not found");
    });
  });
});

// ---------------------------------------------------------------------------
// Integration tests (HTTP layer)
// ---------------------------------------------------------------------------
describe("Integration: Research Clips", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  describe("POST /projects/:projectId/research/clips", () => {
    it("201 on new clip", async () => {
      const res = await jsonRequest("POST", `/projects/${projectId}/research/clips`, userId, {
        content: "Important finding",
        sourceTitle: "Interview Notes",
      });

      expect(res.status).toBe(201);

      const body = (await res.json()) as { id: string; content: string; sourceTitle: string };
      expect(body.id).toBeTruthy();
      expect(body.content).toBe("Important finding");
      expect(body.sourceTitle).toBe("Interview Notes");
    });

    it("200 on deduplicated clip", async () => {
      const source = await seedSource(projectId);

      const first = await jsonRequest("POST", `/projects/${projectId}/research/clips`, userId, {
        content: "Duplicate",
        sourceTitle: "Source Doc",
        sourceId: source.id,
      });
      expect(first.status).toBe(201);

      const second = await jsonRequest("POST", `/projects/${projectId}/research/clips`, userId, {
        content: "Duplicate",
        sourceTitle: "Source Doc",
        sourceId: source.id,
      });
      expect(second.status).toBe(200);

      const firstBody = (await first.json()) as { id: string };
      const secondBody = (await second.json()) as { id: string };
      expect(secondBody.id).toBe(firstBody.id);
    });

    it("400 when content is missing", async () => {
      const res = await jsonRequest("POST", `/projects/${projectId}/research/clips`, userId, {
        sourceTitle: "Source",
      });

      expect(res.status).toBe(400);
    });

    it("400 when sourceTitle is missing", async () => {
      const res = await jsonRequest("POST", `/projects/${projectId}/research/clips`, userId, {
        content: "Some content",
      });

      expect(res.status).toBe(400);
    });

    it("400 when content exceeds 10KB", async () => {
      const res = await jsonRequest("POST", `/projects/${projectId}/research/clips`, userId, {
        content: "x".repeat(10 * 1024 + 1),
        sourceTitle: "Source",
      });

      expect(res.status).toBe(400);
    });

    it("404 for non-existent project", async () => {
      const res = await jsonRequest("POST", `/projects/nonexistent/research/clips`, userId, {
        content: "Content",
        sourceTitle: "Source",
      });

      expect(res.status).toBe(404);
    });

    it("401 without auth", async () => {
      const res = await SELF.fetch(`${BASE}/projects/${projectId}/research/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Content", sourceTitle: "Source" }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /projects/:projectId/research/clips", () => {
    it("200 with clips array", async () => {
      await seedClip(projectId, { content: "Clip 1", sourceTitle: "S1" });
      await seedClip(projectId, { content: "Clip 2", sourceTitle: "S2" });

      const res = await SELF.fetch(`${BASE}/projects/${projectId}/research/clips`, {
        headers: authHeaders(userId),
      });

      expect(res.status).toBe(200);

      const body = (await res.json()) as { clips: Array<{ content: string }> };
      expect(body.clips).toHaveLength(2);
    });

    it("filters by chapterId query param", async () => {
      const chapter = await seedChapter(projectId, { title: "Ch1" });
      await seedClip(projectId, {
        content: "Linked",
        chapterId: chapter.id,
      });
      await seedClip(projectId, { content: "Unlinked" });

      const res = await SELF.fetch(
        `${BASE}/projects/${projectId}/research/clips?chapterId=${chapter.id}`,
        {
          headers: authHeaders(userId),
        },
      );

      expect(res.status).toBe(200);

      const body = (await res.json()) as { clips: Array<{ content: string }> };
      expect(body.clips).toHaveLength(1);
      expect(body.clips[0].content).toBe("Linked");
    });

    it("200 empty array when no clips", async () => {
      const res = await SELF.fetch(`${BASE}/projects/${projectId}/research/clips`, {
        headers: authHeaders(userId),
      });

      expect(res.status).toBe(200);

      const body = (await res.json()) as { clips: unknown[] };
      expect(body.clips).toHaveLength(0);
    });
  });

  describe("DELETE /research/clips/:clipId", () => {
    it("200 with success: true", async () => {
      const clip = await seedClip(projectId, { content: "To delete" });

      const res = await jsonRequest("DELETE", `/research/clips/${clip.id}`, userId);

      expect(res.status).toBe(200);

      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("clip is gone after deletion", async () => {
      const clip = await seedClip(projectId, { content: "Will be deleted" });

      await jsonRequest("DELETE", `/research/clips/${clip.id}`, userId);

      const listRes = await SELF.fetch(`${BASE}/projects/${projectId}/research/clips`, {
        headers: authHeaders(userId),
      });
      const body = (await listRes.json()) as { clips: unknown[] };
      expect(body.clips).toHaveLength(0);
    });

    it("404 for non-existent clip", async () => {
      const res = await jsonRequest("DELETE", `/research/clips/nonexistent`, userId);
      expect(res.status).toBe(404);
    });

    it("404 for clip owned by another user", async () => {
      const other = await seedUser({ id: "other-user" });
      const otherProject = await seedProject(other.id);
      const clip = await seedClip(otherProject.id);

      const res = await jsonRequest("DELETE", `/research/clips/${clip.id}`, userId);
      expect(res.status).toBe(404);
    });
  });
});
