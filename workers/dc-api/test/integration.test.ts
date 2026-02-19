import { describe, it, expect, beforeEach } from "vitest";
import { SELF, env } from "cloudflare:test";
import { seedUser, seedProject, seedChapter, cleanAll } from "./helpers/seed.js";

/**
 * Integration tests — exercise authenticated CRUD flows end-to-end through
 * the Worker HTTP layer. Uses the X-Test-User-Id header bypass (enabled by
 * ALLOW_TEST_AUTH=true in wrangler.test.toml) to authenticate as a seeded user.
 *
 * Unlike service-level tests (project.test.ts, chapter.test.ts, etc.), these
 * tests verify route mounting, middleware wiring, HTTP status codes, and
 * response shapes as a real client would see them.
 */

const BASE = "http://localhost";

/** Convenience helper: build headers that authenticate as the given userId. */
function authHeaders(userId: string, extra?: Record<string, string>): Record<string, string> {
  return {
    "X-Test-User-Id": userId,
    ...extra,
  };
}

/** JSON POST/PATCH/PUT/DELETE helper. */
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
// Health endpoint (public, no auth)
// ---------------------------------------------------------------------------
describe("Integration: Health", () => {
  it("GET /health returns 200 with service info", async () => {
    const res = await SELF.fetch(`${BASE}/health`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("dc-api");
  });
});

// ---------------------------------------------------------------------------
// Project CRUD (authenticated)
// ---------------------------------------------------------------------------
describe("Integration: Projects", () => {
  let userId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
  });

  it("POST /projects → 201 with default chapter", async () => {
    const res = await jsonRequest("POST", "/projects", userId, {
      title: "My Integration Book",
      description: "Written by tests",
    });

    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      id: string;
      title: string;
      description: string;
      status: string;
      chapters: Array<{ title: string; sortOrder: number }>;
    };

    expect(body.title).toBe("My Integration Book");
    expect(body.description).toBe("Written by tests");
    expect(body.status).toBe("active");
    expect(body.chapters).toHaveLength(1);
    expect(body.chapters[0].title).toBe("Chapter 1");
    expect(body.chapters[0].sortOrder).toBe(1);
  });

  it("GET /projects → lists created project", async () => {
    // Seed a project via DB so the list has something
    await seedProject(userId, { title: "Seeded Project" });

    const res = await SELF.fetch(`${BASE}/projects`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      projects: Array<{ title: string; wordCount: number; chapterCount: number }>;
    };

    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].title).toBe("Seeded Project");
  });

  it("POST then GET /projects round-trip", async () => {
    // Create via HTTP
    const createRes = await jsonRequest("POST", "/projects", userId, {
      title: "Round-Trip Project",
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; title: string };

    // List via HTTP — should contain the new project
    const listRes = await SELF.fetch(`${BASE}/projects`, {
      headers: authHeaders(userId),
    });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as {
      projects: Array<{ id: string; title: string }>;
    };

    expect(list.projects.some((p) => p.id === created.id)).toBe(true);
  });

  it("GET /projects/:id → 200 with project detail", async () => {
    const proj = await seedProject(userId, { title: "Detail Project" });
    await seedChapter(proj.id, { title: "Ch One", sortOrder: 1, wordCount: 50 });
    await seedChapter(proj.id, { title: "Ch Two", sortOrder: 2, wordCount: 75 });

    const res = await SELF.fetch(`${BASE}/projects/${proj.id}`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      id: string;
      title: string;
      chapters: Array<{ title: string; sortOrder: number }>;
      totalWordCount: number;
    };

    expect(body.id).toBe(proj.id);
    expect(body.title).toBe("Detail Project");
    expect(body.chapters).toHaveLength(2);
    expect(body.totalWordCount).toBe(125);
  });

  it("GET /projects/:id → 404 for non-existent project", async () => {
    const res = await SELF.fetch(`${BASE}/projects/nonexistent`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });

  it("PATCH /projects/:id → 200 updates title", async () => {
    const proj = await seedProject(userId, { title: "Old Title" });

    const res = await jsonRequest("PATCH", `/projects/${proj.id}`, userId, {
      title: "New Title",
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("New Title");
  });

  it("DELETE /projects/:id → 200 soft-deletes", async () => {
    const proj = await seedProject(userId, { title: "To Delete" });
    await seedChapter(proj.id); // Need at least one chapter

    const delRes = await jsonRequest("DELETE", `/projects/${proj.id}`, userId);
    expect(delRes.status).toBe(200);

    const delBody = (await delRes.json()) as { success: boolean };
    expect(delBody.success).toBe(true);

    // Verify project no longer appears in active list
    const listRes = await SELF.fetch(`${BASE}/projects`, {
      headers: authHeaders(userId),
    });
    const list = (await listRes.json()) as { projects: Array<{ id: string }> };
    expect(list.projects.some((p) => p.id === proj.id)).toBe(false);
  });

  it("returns 401 without auth header", async () => {
    const res = await SELF.fetch(`${BASE}/projects`);
    expect(res.status).toBe(401);
  });

  it("isolates projects between users", async () => {
    const otherUser = await seedUser({ id: "other-user-iso" });
    await seedProject(userId, { title: "User A Project" });
    await seedProject(otherUser.id, { title: "User B Project" });

    // User A should only see their own project
    const resA = await SELF.fetch(`${BASE}/projects`, {
      headers: authHeaders(userId),
    });
    const listA = (await resA.json()) as { projects: Array<{ title: string }> };
    expect(listA.projects).toHaveLength(1);
    expect(listA.projects[0].title).toBe("User A Project");

    // User B should only see their own project
    const resB = await SELF.fetch(`${BASE}/projects`, {
      headers: authHeaders(otherUser.id),
    });
    const listB = (await resB.json()) as { projects: Array<{ title: string }> };
    expect(listB.projects).toHaveLength(1);
    expect(listB.projects[0].title).toBe("User B Project");
  });
});

// ---------------------------------------------------------------------------
// Chapter CRUD (authenticated)
// ---------------------------------------------------------------------------
describe("Integration: Chapters", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId, { title: "Chapter Test Project" });
    projectId = project.id;
  });

  it("POST /projects/:projectId/chapters → 201 creates chapter", async () => {
    const res = await jsonRequest("POST", `/projects/${projectId}/chapters`, userId, {
      title: "New Chapter",
    });

    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      id: string;
      title: string;
      sortOrder: number;
      status: string;
      version: number;
      wordCount: number;
    };

    expect(body.title).toBe("New Chapter");
    expect(body.status).toBe("draft");
    expect(body.version).toBe(1);
    expect(body.wordCount).toBe(0);
  });

  it("GET /projects/:projectId/chapters → lists chapters in order", async () => {
    await seedChapter(projectId, { title: "Beta", sortOrder: 2 });
    await seedChapter(projectId, { title: "Alpha", sortOrder: 1 });

    const res = await SELF.fetch(`${BASE}/projects/${projectId}/chapters`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      chapters: Array<{ title: string; sortOrder: number }>;
    };

    expect(body.chapters).toHaveLength(2);
    expect(body.chapters[0].title).toBe("Alpha");
    expect(body.chapters[1].title).toBe("Beta");
  });

  it("POST then GET chapters round-trip", async () => {
    const createRes = await jsonRequest("POST", `/projects/${projectId}/chapters`, userId, {
      title: "Created via API",
    });
    expect(createRes.status).toBe(201);

    const listRes = await SELF.fetch(`${BASE}/projects/${projectId}/chapters`, {
      headers: authHeaders(userId),
    });
    const list = (await listRes.json()) as {
      chapters: Array<{ title: string }>;
    };

    expect(list.chapters.some((c) => c.title === "Created via API")).toBe(true);
  });

  it("GET /chapters/:chapterId → 200 returns chapter", async () => {
    const ch = await seedChapter(projectId, { title: "Single Chapter" });

    const res = await SELF.fetch(`${BASE}/chapters/${ch.id}`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { id: string; title: string; projectId: string };
    expect(body.id).toBe(ch.id);
    expect(body.title).toBe("Single Chapter");
    expect(body.projectId).toBe(projectId);
  });

  it("PATCH /chapters/:chapterId → 200 updates title", async () => {
    const ch = await seedChapter(projectId, { title: "Old Chapter Title" });

    const res = await jsonRequest("PATCH", `/chapters/${ch.id}`, userId, {
      title: "Updated Chapter Title",
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Updated Chapter Title");
  });

  it("PATCH /chapters/:chapterId → 200 updates status", async () => {
    const ch = await seedChapter(projectId);

    const res = await jsonRequest("PATCH", `/chapters/${ch.id}`, userId, {
      status: "review",
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("review");
  });

  it("DELETE /chapters/:chapterId → 200 removes chapter", async () => {
    await seedChapter(projectId, { sortOrder: 1 });
    const ch2 = await seedChapter(projectId, { sortOrder: 2 });

    const delRes = await jsonRequest("DELETE", `/chapters/${ch2.id}`, userId);
    expect(delRes.status).toBe(200);

    const delBody = (await delRes.json()) as { success: boolean };
    expect(delBody.success).toBe(true);

    // Verify chapter is gone from list
    const listRes = await SELF.fetch(`${BASE}/projects/${projectId}/chapters`, {
      headers: authHeaders(userId),
    });
    const list = (await listRes.json()) as { chapters: Array<{ id: string }> };
    expect(list.chapters.some((c) => c.id === ch2.id)).toBe(false);
  });

  it("DELETE /chapters/:chapterId → 400 rejects deleting last chapter", async () => {
    const ch = await seedChapter(projectId);

    const res = await jsonRequest("DELETE", `/chapters/${ch.id}`, userId);
    expect(res.status).toBe(400);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("LAST_CHAPTER");
  });

  it("PATCH reorder → 200 updates sort order", async () => {
    const ch1 = await seedChapter(projectId, { title: "First", sortOrder: 1 });
    const ch2 = await seedChapter(projectId, { title: "Second", sortOrder: 2 });

    const res = await jsonRequest("PATCH", `/projects/${projectId}/chapters/reorder`, userId, {
      chapterIds: [ch2.id, ch1.id],
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      chapters: Array<{ id: string; title: string; sortOrder: number }>;
    };

    expect(body.chapters[0].title).toBe("Second");
    expect(body.chapters[0].sortOrder).toBe(1);
    expect(body.chapters[1].title).toBe("First");
    expect(body.chapters[1].sortOrder).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Content save/load (authenticated)
// ---------------------------------------------------------------------------
describe("Integration: Content", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  it("PUT then GET /chapters/:id/content round-trips HTML content", async () => {
    const ch = await seedChapter(projectId, { version: 1 });
    const html = "<p>Hello <strong>world</strong></p>";

    // Save content
    const putRes = await jsonRequest("PUT", `/chapters/${ch.id}/content`, userId, {
      content: html,
      version: 1,
    });

    expect(putRes.status).toBe(200);

    const putBody = (await putRes.json()) as { version: number; wordCount: number };
    expect(putBody.version).toBe(2);
    expect(putBody.wordCount).toBe(2);

    // Load content
    const getRes = await SELF.fetch(`${BASE}/chapters/${ch.id}/content`, {
      headers: authHeaders(userId),
    });

    expect(getRes.status).toBe(200);

    const getBody = (await getRes.json()) as { content: string; version: number };
    expect(getBody.content).toBe(html);
    expect(getBody.version).toBe(2);
  });

  it("PUT /chapters/:id/content → 409 on version mismatch", async () => {
    const ch = await seedChapter(projectId, { version: 3 });

    const res = await jsonRequest("PUT", `/chapters/${ch.id}/content`, userId, {
      content: "<p>Stale</p>",
      version: 2, // behind current
    });

    expect(res.status).toBe(409);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CONFLICT");
  });

  it("GET /chapters/:id/content → empty content for new chapter", async () => {
    const ch = await seedChapter(projectId);

    const res = await SELF.fetch(`${BASE}/chapters/${ch.id}/content`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { content: string; version: number };
    expect(body.content).toBe("");
    expect(body.version).toBe(1);
  });

  it("content is isolated between users", async () => {
    const ch = await seedChapter(projectId, { version: 1 });

    // Save as owning user
    const putRes = await jsonRequest("PUT", `/chapters/${ch.id}/content`, userId, {
      content: "<p>Secret content</p>",
      version: 1,
    });
    expect(putRes.status).toBe(200);

    // Try to read as different user
    const otherUser = await seedUser({ id: "other-user-content" });
    const getRes = await SELF.fetch(`${BASE}/chapters/${ch.id}/content`, {
      headers: authHeaders(otherUser.id),
    });

    expect(getRes.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Export (authenticated) — EPUB only (PDF requires Browser Rendering API)
// ---------------------------------------------------------------------------
describe("Integration: Export", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId, { title: "Export Test Book" });
    projectId = project.id;
  });

  it("POST /projects/:id/export → 201 creates EPUB export job", async () => {
    const ch = await seedChapter(projectId, {
      title: "Export Chapter",
      sortOrder: 1,
      wordCount: 5,
    });

    // Put content in R2 for the export
    const r2Key = `chapters/${ch.id}/content.html`;
    await env.EXPORTS_BUCKET.put(r2Key, "<p>Content for export testing.</p>");
    await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`).bind(r2Key, ch.id).run();

    const res = await jsonRequest("POST", `/projects/${projectId}/export`, userId, {
      format: "epub",
    });

    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      jobId: string;
      status: string;
      fileName: string;
      downloadUrl: string;
      error: string | null;
    };

    expect(body.status).toBe("completed");
    expect(body.fileName).toContain("Export Test Book");
    expect(body.fileName).toContain(".epub");
    expect(body.error).toBeNull();
    expect(body.jobId).toBeTruthy();
  });

  it("GET /exports/:jobId → 200 returns export status", async () => {
    const ch = await seedChapter(projectId, { sortOrder: 1, wordCount: 3 });
    const r2Key = `chapters/${ch.id}/content.html`;
    await env.EXPORTS_BUCKET.put(r2Key, "<p>Status check content.</p>");
    await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`).bind(r2Key, ch.id).run();

    // Create an export first
    const createRes = await jsonRequest("POST", `/projects/${projectId}/export`, userId, {
      format: "epub",
    });
    const created = (await createRes.json()) as { jobId: string };

    // Check status
    const statusRes = await SELF.fetch(`${BASE}/exports/${created.jobId}`, {
      headers: authHeaders(userId),
    });

    expect(statusRes.status).toBe(200);

    const statusBody = (await statusRes.json()) as {
      jobId: string;
      status: string;
      format: string;
    };

    expect(statusBody.jobId).toBe(created.jobId);
    expect(statusBody.status).toBe("completed");
    expect(statusBody.format).toBe("epub");
  });

  it("GET /exports/:jobId/download → 200 streams EPUB file", async () => {
    const ch = await seedChapter(projectId, { sortOrder: 1, wordCount: 2 });
    const r2Key = `chapters/${ch.id}/content.html`;
    await env.EXPORTS_BUCKET.put(r2Key, "<p>Download test.</p>");
    await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`).bind(r2Key, ch.id).run();

    // Create export
    const createRes = await jsonRequest("POST", `/projects/${projectId}/export`, userId, {
      format: "epub",
    });
    const created = (await createRes.json()) as { jobId: string };

    // Download
    const dlRes = await SELF.fetch(`${BASE}/exports/${created.jobId}/download`, {
      headers: authHeaders(userId),
    });

    expect(dlRes.status).toBe(200);
    expect(dlRes.headers.get("Content-Type")).toBe("application/epub+zip");
    expect(dlRes.headers.get("Content-Disposition")).toContain("Export Test Book");

    // Verify the body is non-empty (valid ZIP starts with PK header)
    const buf = await dlRes.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
    // ZIP magic number: PK (0x50 0x4B)
    const view = new Uint8Array(buf);
    expect(view[0]).toBe(0x50);
    expect(view[1]).toBe(0x4b);
  });
});

// ---------------------------------------------------------------------------
// Backup & Import (authenticated)
// ---------------------------------------------------------------------------
describe("Integration: Backup", () => {
  let userId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
  });

  it("GET /projects/:id/backup → 200 downloads ZIP", async () => {
    const proj = await seedProject(userId, { title: "Backup Book" });
    const ch = await seedChapter(proj.id, { title: "Backup Chapter", sortOrder: 1 });

    // Put content in R2
    const r2Key = `chapters/${ch.id}/content.html`;
    await env.EXPORTS_BUCKET.put(r2Key, "<p>Backup content here.</p>");
    await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`).bind(r2Key, ch.id).run();

    const res = await SELF.fetch(`${BASE}/projects/${proj.id}/backup`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain("Backup Book");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
    // ZIP magic number
    const view = new Uint8Array(buf);
    expect(view[0]).toBe(0x50);
    expect(view[1]).toBe(0x4b);
  });
});

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------
describe("Integration: 404", () => {
  let userId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
  });

  it("GET /nonexistent → 404 NOT_FOUND", async () => {
    const res = await SELF.fetch(`${BASE}/nonexistent`, {
      headers: authHeaders(userId),
    });

    expect(res.status).toBe(404);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});
