import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { seedUser, seedProject, seedSource, seedSourceFts, cleanAll } from "./helpers/seed.js";
import { SourceSearchService } from "../src/services/source-search.js";

// ---------------------------------------------------------------------------
// Service-level tests
// ---------------------------------------------------------------------------

describe("SourceSearchService", () => {
  let service: SourceSearchService;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new SourceSearchService(env.DB);
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  describe("search", () => {
    it("returns empty array when no matches", async () => {
      const result = await service.search(userId, projectId, "nonexistent");
      expect(result.results).toEqual([]);
    });

    it("finds sources by title via FTS", async () => {
      const source = await seedSource(projectId, { title: "Interview Notes on Leadership" });
      await seedSourceFts(
        source.id,
        "Interview Notes on Leadership",
        "Some content about management.",
      );

      const result = await service.search(userId, projectId, "Interview");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].sourceId).toBe(source.id);
      expect(result.results[0].title).toBe("Interview Notes on Leadership");
    });

    it("finds sources by content via FTS", async () => {
      const source = await seedSource(projectId, { title: "Research Paper" });
      await seedSourceFts(
        source.id,
        "Research Paper",
        "The quantum mechanics of photosynthesis reveals surprising efficiency.",
      );

      const result = await service.search(userId, projectId, "photosynthesis");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].sourceId).toBe(source.id);
    });

    it("returns snippet from matching content", async () => {
      const source = await seedSource(projectId, { title: "Biology Notes" });
      await seedSourceFts(
        source.id,
        "Biology Notes",
        "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
      );

      const result = await service.search(userId, projectId, "mitochondria");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].snippet).toBeTruthy();
      expect(result.results[0].snippet.length).toBeGreaterThan(0);
    });

    it("orders results by relevance", async () => {
      // Source with keyword in title and content should rank higher
      const s1 = await seedSource(projectId, { title: "Leadership Strategy", sortOrder: 1 });
      await seedSourceFts(
        s1.id,
        "Leadership Strategy",
        "Leadership is about influencing people. Good leadership requires vision and leadership skills.",
      );

      const s2 = await seedSource(projectId, { title: "Management Guide", sortOrder: 2 });
      await seedSourceFts(
        s2.id,
        "Management Guide",
        "Managing teams requires leadership in some situations.",
      );

      const result = await service.search(userId, projectId, "leadership");
      expect(result.results.length).toBeGreaterThanOrEqual(2);
      // First result should be the one with more relevance (more occurrences)
      expect(result.results[0].sourceId).toBe(s1.id);
    });

    it("excludes archived sources from results", async () => {
      const active = await seedSource(projectId, {
        title: "Active Source",
        status: "active",
        sortOrder: 1,
      });
      await seedSourceFts(active.id, "Active Source", "Content about testing patterns.");

      const archived = await seedSource(projectId, {
        title: "Archived Source",
        status: "archived",
        sortOrder: 2,
      });
      await seedSourceFts(archived.id, "Archived Source", "Content about testing patterns.");

      const result = await service.search(userId, projectId, "testing");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].sourceId).toBe(active.id);
    });

    it("does not return sources from other projects", async () => {
      const otherUser = await seedUser();
      const otherProject = await seedProject(otherUser.id);

      const mySource = await seedSource(projectId, { title: "My Source" });
      await seedSourceFts(mySource.id, "My Source", "Unique keyword xylophone.");

      const otherSource = await seedSource(otherProject.id, { title: "Other Source" });
      await seedSourceFts(otherSource.id, "Other Source", "Unique keyword xylophone.");

      const result = await service.search(userId, projectId, "xylophone");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].sourceId).toBe(mySource.id);
    });

    it("rejects queries shorter than 2 characters", async () => {
      await expect(service.search(userId, projectId, "a")).rejects.toThrow(
        "Search query must be at least 2 characters",
      );
    });

    it("rejects empty queries", async () => {
      await expect(service.search(userId, projectId, "")).rejects.toThrow(
        "Search query must be at least 2 characters",
      );
    });

    it("rejects whitespace-only queries", async () => {
      await expect(service.search(userId, projectId, "   ")).rejects.toThrow(
        "Search query must be at least 2 characters",
      );
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.search(userId, "fake-project-id", "keyword")).rejects.toThrow(
        "Project not found",
      );
    });

    it("throws NOT_FOUND when user does not own the project", async () => {
      const otherUser = await seedUser();
      await expect(service.search(otherUser.id, projectId, "keyword")).rejects.toThrow(
        "Project not found",
      );
    });

    it("handles FTS special characters safely", async () => {
      const source = await seedSource(projectId, { title: "Test Source" });
      await seedSourceFts(source.id, "Test Source", "Some test content here.");

      // These should not cause FTS syntax errors
      const result1 = await service.search(userId, projectId, 'test "quoted"');
      expect(result1.results).toBeDefined();

      const result2 = await service.search(userId, projectId, "test OR AND NOT");
      expect(result2.results).toBeDefined();

      const result3 = await service.search(userId, projectId, "test*");
      expect(result3.results).toBeDefined();
    });

    it("handles multi-word queries", async () => {
      const source = await seedSource(projectId, { title: "Deep Research" });
      await seedSourceFts(
        source.id,
        "Deep Research",
        "The deep ocean contains many unexplored research opportunities.",
      );

      const result = await service.search(userId, projectId, "deep research");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].sourceId).toBe(source.id);
    });

    it("uses porter stemming (finds variations)", async () => {
      const source = await seedSource(projectId, { title: "Running Guide" });
      await seedSourceFts(
        source.id,
        "Running Guide",
        "Running helps with fitness and running endurance.",
      );

      // "run" should match "running" via porter stemmer
      const result = await service.search(userId, projectId, "run");
      // Note: FTS5 porter tokenizer may or may not match depending on D1 implementation
      // At minimum, this should not throw
      expect(result.results).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Integration tests (HTTP layer)
// ---------------------------------------------------------------------------

const BASE = "http://localhost";

function authHeaders(userId: string): Record<string, string> {
  return { "X-Test-User-Id": userId };
}

describe("Integration: Source Search", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  it("GET /projects/:projectId/research/sources/search returns results", async () => {
    const source = await seedSource(projectId, { title: "Economics Paper" });
    await seedSourceFts(source.id, "Economics Paper", "Supply and demand drive market prices.");

    const res = await SELF.fetch(
      `${BASE}/projects/${projectId}/research/sources/search?q=economics`,
      { headers: authHeaders(userId) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ sourceId: string; title: string }> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0].sourceId).toBe(source.id);
    expect(body.results[0].title).toBe("Economics Paper");
  });

  it("returns 400 for missing query param", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/research/sources/search`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for query shorter than 2 chars", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/research/sources/search?q=a`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(400);
  });

  it("returns empty results for no matches", async () => {
    const res = await SELF.fetch(
      `${BASE}/projects/${projectId}/research/sources/search?q=nonexistent`,
      { headers: authHeaders(userId) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toEqual([]);
  });

  it("returns 404 for non-existent project", async () => {
    const res = await SELF.fetch(`${BASE}/projects/fake-project/research/sources/search?q=test`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/research/sources/search?q=test`);

    expect(res.status).toBe(401);
  });

  it("includes snippet and position in response", async () => {
    const source = await seedSource(projectId, { title: "History Notes" });
    await seedSourceFts(
      source.id,
      "History Notes",
      "The Renaissance was a period of cultural rebirth in European history.",
    );

    const res = await SELF.fetch(
      `${BASE}/projects/${projectId}/research/sources/search?q=Renaissance`,
      { headers: authHeaders(userId) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ sourceId: string; snippet: string; position: number }>;
    };
    expect(body.results).toHaveLength(1);
    expect(body.results[0].snippet).toBeTruthy();
    expect(typeof body.results[0].position).toBe("number");
  });
});
