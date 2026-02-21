import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { SourceMaterialService } from "../src/services/source-material.js";
import { seedUser, seedProject, seedSource, seedChapter, cleanAll } from "./helpers/seed.js";

describe("SourceMaterialService", () => {
  let service: SourceMaterialService;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new SourceMaterialService(env.DB, env.EXPORTS_BUCKET);
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  describe("addSources", () => {
    it("adds Google Docs as sources", async () => {
      const files = [
        {
          driveFileId: "abc123",
          title: "Interview Notes",
          mimeType: "application/vnd.google-apps.document",
        },
        {
          driveFileId: "def456",
          title: "Research Paper",
          mimeType: "application/vnd.google-apps.document",
        },
      ];

      const created = await service.addSources(userId, projectId, files);

      expect(created.sources).toHaveLength(2);
      expect(created.sources[0].title).toBe("Interview Notes");
      expect(created.sources[0].driveFileId).toBe("abc123");
      expect(created.sources[0].status).toBe("active");
      expect(created.sources[0].wordCount).toBe(0);
      expect(created.sources[0].cachedAt).toBeNull();
      expect(created.sources[1].sortOrder).toBe(2);
    });

    it("ignores unsupported non-doc, non-folder files", async () => {
      const files = [
        {
          driveFileId: "sheet123",
          title: "Spreadsheet",
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
      ];

      const created = await service.addSources(userId, projectId, files);
      expect(created.sources).toHaveLength(0);
    });

    it("silently deduplicates re-selected files", async () => {
      const files = [
        {
          driveFileId: "abc123",
          title: "My Doc",
          mimeType: "application/vnd.google-apps.document",
        },
      ];

      const first = await service.addSources(userId, projectId, files);
      expect(first.sources).toHaveLength(1);

      const second = await service.addSources(userId, projectId, files);
      expect(second.sources).toHaveLength(0); // Already exists, no new rows
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      const files = [
        {
          driveFileId: "abc123",
          title: "Doc",
          mimeType: "application/vnd.google-apps.document",
        },
      ];

      await expect(service.addSources(userId, "nonexistent", files)).rejects.toThrow(
        "Project not found",
      );
    });

    it("throws NOT_FOUND for project owned by another user", async () => {
      const other = await seedUser({ id: "other-user" });
      const files = [
        {
          driveFileId: "abc123",
          title: "Doc",
          mimeType: "application/vnd.google-apps.document",
        },
      ];

      await expect(service.addSources(other.id, projectId, files)).rejects.toThrow(
        "Project not found",
      );
    });

    it("rejects empty files array", async () => {
      await expect(service.addSources(userId, projectId, [])).rejects.toThrow(
        "At least one file is required",
      );
    });

    it("rejects more than 50 files", async () => {
      const files = Array.from({ length: 51 }, (_, i) => ({
        driveFileId: `file-${i}`,
        title: `Doc ${i}`,
        mimeType: "application/vnd.google-apps.document",
      }));

      await expect(service.addSources(userId, projectId, files)).rejects.toThrow(
        "Maximum 50 files per request",
      );
    });

    it("assigns incrementing sort_order after existing sources", async () => {
      await seedSource(projectId, { sortOrder: 5 });

      const files = [
        {
          driveFileId: "new-file",
          title: "New Source",
          mimeType: "application/vnd.google-apps.document",
        },
      ];

      const created = await service.addSources(userId, projectId, files);
      expect(created.sources[0].sortOrder).toBe(6);
    });

    it("expands selected folders recursively into docs", async () => {
      // Seed a drive connection for FK integrity
      const connId = "test-conn-1";
      const ts = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO drive_connections (id, user_id, access_token, refresh_token, token_expires_at, drive_email, created_at, updated_at)
         VALUES (?, ?, 'enc-access', 'enc-refresh', ?, 'test@example.com', ?, ?)`,
      )
        .bind(connId, userId, ts, ts, ts)
        .run();

      const files = [
        {
          driveFileId: "folder123",
          title: "Folder",
          mimeType: "application/vnd.google-apps.folder",
        },
      ];

      const mockDriveService = {
        getValidTokensByConnection: async () => ({
          accessToken: "access",
          refreshToken: "refresh",
          expiresAt: new Date(Date.now() + 3600000),
          wasRefreshed: false,
        }),
        listDocsInFoldersRecursive: async () => [
          { id: "doc-1", name: "Doc One", mimeType: "application/vnd.google-apps.document" },
          { id: "doc-2", name: "Doc Two", mimeType: "application/vnd.google-apps.document" },
        ],
      } as any;

      const created = await service.addSources(userId, projectId, files, mockDriveService, connId);
      expect(created.sources).toHaveLength(2);
      expect(created.expandedCounts).toEqual({
        selectedFolders: 1,
        docsDiscovered: 2,
        docsInserted: 2,
      });
    });

    it("requires DriveService and connectionId when folder sources are selected", async () => {
      const files = [
        {
          driveFileId: "folder123",
          title: "Folder",
          mimeType: "application/vnd.google-apps.folder",
        },
      ];

      await expect(service.addSources(userId, projectId, files)).rejects.toThrow(
        "DriveService and connectionId are required",
      );
    });

    it("requires valid Drive connection when expanding folders", async () => {
      const files = [
        {
          driveFileId: "folder123",
          title: "Folder",
          mimeType: "application/vnd.google-apps.folder",
        },
      ];

      const mockDriveService = {
        getValidTokensByConnection: async () => null,
      } as any;

      await expect(
        service.addSources(userId, projectId, files, mockDriveService, "conn-1"),
      ).rejects.toThrow("Google Drive is not connected");
    });
  });

  describe("listSources", () => {
    it("lists active sources in sort order", async () => {
      await seedSource(projectId, { title: "B", sortOrder: 2 });
      await seedSource(projectId, { title: "A", sortOrder: 1 });

      const sources = await service.listSources(userId, projectId);

      expect(sources).toHaveLength(2);
      expect(sources[0].title).toBe("A");
      expect(sources[1].title).toBe("B");
    });

    it("excludes archived sources", async () => {
      await seedSource(projectId, { title: "Active", status: "active" });
      await seedSource(projectId, { title: "Archived", status: "archived", driveFileId: "x" });

      const sources = await service.listSources(userId, projectId);

      expect(sources).toHaveLength(1);
      expect(sources[0].title).toBe("Active");
    });

    it("includes error-status sources", async () => {
      await seedSource(projectId, { title: "Error", status: "error" });

      const sources = await service.listSources(userId, projectId);

      expect(sources).toHaveLength(1);
      expect(sources[0].status).toBe("error");
    });

    it("returns empty array for project with no sources", async () => {
      const sources = await service.listSources(userId, projectId);
      expect(sources).toHaveLength(0);
    });
  });

  describe("getSource", () => {
    it("returns source with ownership check", async () => {
      const seeded = await seedSource(projectId, { title: "My Source" });

      const source = await service.getSource(userId, seeded.id);

      expect(source.title).toBe("My Source");
      expect(source.projectId).toBe(projectId);
    });

    it("throws NOT_FOUND for non-existent source", async () => {
      await expect(service.getSource(userId, "nonexistent")).rejects.toThrow("Source not found");
    });

    it("throws NOT_FOUND for source in another user's project", async () => {
      const other = await seedUser({ id: "other-user" });
      const otherProject = await seedProject(other.id, { title: "Other Project" });
      const source = await seedSource(otherProject.id, { title: "Other Source" });

      await expect(service.getSource(userId, source.id)).rejects.toThrow("Source not found");
    });

    it("throws NOT_FOUND for archived source", async () => {
      const source = await seedSource(projectId, { status: "archived" });
      await expect(service.getSource(userId, source.id)).rejects.toThrow("Source not found");
    });
  });

  describe("removeSource", () => {
    it("soft deletes a source", async () => {
      const source = await seedSource(projectId, { title: "To Remove" });

      await service.removeSource(userId, source.id);

      // Should not appear in list
      const sources = await service.listSources(userId, projectId);
      expect(sources).toHaveLength(0);

      // Verify it's archived, not hard deleted
      const row = await env.DB.prepare(`SELECT status FROM source_materials WHERE id = ?`)
        .bind(source.id)
        .first<{ status: string }>();
      expect(row?.status).toBe("archived");
    });

    it("throws NOT_FOUND for source not owned by user", async () => {
      const other = await seedUser({ id: "other-user" });
      const otherProject = await seedProject(other.id);
      const source = await seedSource(otherProject.id);

      await expect(service.removeSource(userId, source.id)).rejects.toThrow("Source not found");
    });
  });

  describe("importAsChapter", () => {
    it("creates a chapter from cached source content", async () => {
      const sourceId = "source-import-test";
      await seedSource(projectId, {
        id: sourceId,
        title: "Research Notes",
        cachedAt: new Date().toISOString(),
        wordCount: 42,
        r2Key: `sources/${sourceId}/content.html`,
      });

      // Write content to R2 at the source's cache location
      const html = "<p>This is the research content with enough words to count properly.</p>";
      await env.EXPORTS_BUCKET.put(`sources/${sourceId}/content.html`, html, {
        httpMetadata: { contentType: "text/html; charset=utf-8" },
      });

      // Seed an existing chapter so we can verify sort_order increments
      await seedChapter(projectId, { sortOrder: 1 });

      // Create a mock DriveService that returns null tokens (Drive not connected)
      const mockDriveService = {
        getValidTokensByConnection: async () => null,
        getValidTokens: async () => null,
        exportFile: async () => "",
        getFileMetadata: async () => ({ id: "", name: "", mimeType: "" }),
      } as any;

      const result = await service.importAsChapter(userId, sourceId, mockDriveService);

      expect(result.title).toBe("Research Notes");
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.chapterId).toBeTruthy();

      // Verify chapter exists in D1
      const chapter = await env.DB.prepare(`SELECT * FROM chapters WHERE id = ?`)
        .bind(result.chapterId)
        .first<{ title: string; sort_order: number; r2_key: string; version: number }>();

      expect(chapter).toBeTruthy();
      expect(chapter!.title).toBe("Research Notes");
      expect(chapter!.sort_order).toBe(2); // After existing chapter
      expect(chapter!.version).toBe(1);
      expect(chapter!.r2_key).toContain("chapters/");

      // Verify content was written to R2 at the chapter location
      const r2Object = await env.EXPORTS_BUCKET.get(chapter!.r2_key);
      expect(r2Object).toBeTruthy();
      const content = await r2Object!.text();
      expect(content).toContain("research content");
    });
  });
});
