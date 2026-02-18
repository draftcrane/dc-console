import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { ExportService } from "../src/services/export.js";
import { seedUser, seedProject, seedChapter } from "./helpers/seed.js";
import type { PdfGeneratorConfig } from "../src/services/pdf-generator.js";
import JSZip from "jszip";

/**
 * Dummy PDF config — the EPUB path never calls the Browser Rendering API,
 * so these values are never used in EPUB tests.
 */
const dummyPdfConfig: PdfGeneratorConfig = {
  accountId: "test-account-id",
  apiToken: "test-api-token",
};

const apiBaseUrl = "https://api.test.local";

describe("ExportService", () => {
  let service: ExportService;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    // Clean all tables in proper FK order
    await env.DB.exec(`
      DELETE FROM ai_interactions;
      DELETE FROM export_jobs;
      DELETE FROM chapters;
      DELETE FROM projects;
      DELETE FROM users;
    `);

    service = new ExportService(env.DB, env.EXPORTS_BUCKET, dummyPdfConfig, apiBaseUrl);

    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId, { title: "Test Book" });
    projectId = project.id;
  });

  describe("exportBook (EPUB)", () => {
    it("creates an export job record in D1", async () => {
      const chapter = await seedChapter(projectId, {
        title: "Chapter 1",
        sortOrder: 1,
        wordCount: 10,
      });
      // Put chapter content in R2 so fetchChapterContents can find it
      const r2Key = `chapters/${chapter.id}/content.html`;
      await env.EXPORTS_BUCKET.put(r2Key, "<p>Some test content for export.</p>");
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key, chapter.id)
        .run();

      const result = await service.exportBook(userId, projectId, "epub");

      expect(result.status).toBe("completed");
      expect(result.jobId).toBeTruthy();
      expect(result.error).toBeNull();

      // Verify D1 export_jobs row
      const row = await env.DB.prepare(
        `SELECT id, project_id, user_id, format, status, chapter_count, total_word_count, r2_key, completed_at
         FROM export_jobs WHERE id = ?`,
      )
        .bind(result.jobId)
        .first<{
          id: string;
          project_id: string;
          user_id: string;
          format: string;
          status: string;
          chapter_count: number;
          total_word_count: number;
          r2_key: string | null;
          completed_at: string | null;
        }>();

      expect(row).not.toBeNull();
      expect(row!.project_id).toBe(projectId);
      expect(row!.user_id).toBe(userId);
      expect(row!.format).toBe("epub");
      expect(row!.status).toBe("completed");
      expect(row!.chapter_count).toBe(1);
      expect(row!.total_word_count).toBe(10);
      expect(row!.r2_key).toBe(`exports/${result.jobId}.epub`);
      expect(row!.completed_at).not.toBeNull();
    });

    it("generates valid EPUB content from chapters", async () => {
      const ch1 = await seedChapter(projectId, {
        title: "Introduction",
        sortOrder: 1,
        wordCount: 5,
      });
      const ch2 = await seedChapter(projectId, {
        title: "Main Story",
        sortOrder: 2,
        wordCount: 8,
      });

      // Store chapter content in R2
      const r2Key1 = `chapters/${ch1.id}/content.html`;
      const r2Key2 = `chapters/${ch2.id}/content.html`;
      await env.EXPORTS_BUCKET.put(r2Key1, "<p>This is the introduction.</p>");
      await env.EXPORTS_BUCKET.put(r2Key2, "<p>This is the main story content.</p>");
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key1, ch1.id)
        .run();
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key2, ch2.id)
        .run();

      const result = await service.exportBook(userId, projectId, "epub");

      expect(result.status).toBe("completed");
      expect(result.fileName).toContain("Test Book");
      expect(result.fileName).toContain(".epub");
      expect(result.downloadUrl).toBe(`${apiBaseUrl}/exports/${result.jobId}/download`);

      // Verify EPUB was stored in R2 and is a valid ZIP
      const r2Object = await env.EXPORTS_BUCKET.get(`exports/${result.jobId}.epub`);
      expect(r2Object).not.toBeNull();

      const epubBuffer = await r2Object!.arrayBuffer();
      expect(epubBuffer.byteLength).toBeGreaterThan(0);

      // Verify the EPUB is a valid ZIP containing the expected files
      const zip = await JSZip.loadAsync(epubBuffer);
      expect(zip.file("mimetype")).not.toBeNull();
      expect(zip.file("META-INF/container.xml")).not.toBeNull();
      expect(zip.file("OEBPS/content.opf")).not.toBeNull();
      expect(zip.file("OEBPS/toc.xhtml")).not.toBeNull();
      expect(zip.file("OEBPS/title.xhtml")).not.toBeNull();
      expect(zip.file("OEBPS/chapter-1.xhtml")).not.toBeNull();
      expect(zip.file("OEBPS/chapter-2.xhtml")).not.toBeNull();
      expect(zip.file("OEBPS/style.css")).not.toBeNull();

      // Verify chapter content is in the EPUB
      const ch1Xhtml = await zip.file("OEBPS/chapter-1.xhtml")!.async("string");
      expect(ch1Xhtml).toContain("Introduction");
      expect(ch1Xhtml).toContain("This is the introduction.");

      const ch2Xhtml = await zip.file("OEBPS/chapter-2.xhtml")!.async("string");
      expect(ch2Xhtml).toContain("Main Story");
      expect(ch2Xhtml).toContain("This is the main story content.");

      // Verify title page contains book title and author name
      const titleXhtml = await zip.file("OEBPS/title.xhtml")!.async("string");
      expect(titleXhtml).toContain("Test Book");
      expect(titleXhtml).toContain("Test User");
    });

    it("marks job as completed with proper metadata", async () => {
      await seedChapter(projectId, { title: "Only Chapter", sortOrder: 1, wordCount: 42 });

      const result = await service.exportBook(userId, projectId, "epub");

      expect(result.status).toBe("completed");

      // Verify R2 custom metadata
      const r2Object = await env.EXPORTS_BUCKET.head(`exports/${result.jobId}.epub`);
      expect(r2Object).not.toBeNull();
      expect(r2Object!.customMetadata?.jobId).toBe(result.jobId);
      expect(r2Object!.customMetadata?.projectId).toBe(projectId);
      expect(r2Object!.customMetadata?.userId).toBe(userId);
    });

    it("throws NOT_FOUND for wrong user's project", async () => {
      await seedChapter(projectId, { sortOrder: 1 });
      const other = await seedUser({ id: "other-user" });

      await expect(service.exportBook(other.id, projectId, "epub")).rejects.toThrow(
        "Project not found",
      );
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.exportBook(userId, "nonexistent-project", "epub")).rejects.toThrow(
        "Project not found",
      );
    });

    it("handles chapters without R2 content gracefully", async () => {
      // Chapter with no r2_key — should still be included with empty HTML
      await seedChapter(projectId, {
        title: "Empty Chapter",
        sortOrder: 1,
        wordCount: 0,
      });

      const result = await service.exportBook(userId, projectId, "epub");

      expect(result.status).toBe("completed");

      // Verify the EPUB still contains the chapter heading
      const r2Object = await env.EXPORTS_BUCKET.get(`exports/${result.jobId}.epub`);
      const zip = await JSZip.loadAsync(await r2Object!.arrayBuffer());
      const chXhtml = await zip.file("OEBPS/chapter-1.xhtml")!.async("string");
      expect(chXhtml).toContain("Empty Chapter");
    });

    it("includes multiple chapters in correct sort order", async () => {
      // Seed chapters in reverse order to verify sorting
      const ch3 = await seedChapter(projectId, { title: "Epilogue", sortOrder: 3, wordCount: 3 });
      const ch1 = await seedChapter(projectId, { title: "Prologue", sortOrder: 1, wordCount: 5 });
      const ch2 = await seedChapter(projectId, { title: "Body", sortOrder: 2, wordCount: 7 });

      const r2Key1 = `chapters/${ch1.id}/content.html`;
      const r2Key2 = `chapters/${ch2.id}/content.html`;
      const r2Key3 = `chapters/${ch3.id}/content.html`;
      await env.EXPORTS_BUCKET.put(r2Key1, "<p>Prologue content</p>");
      await env.EXPORTS_BUCKET.put(r2Key2, "<p>Body content</p>");
      await env.EXPORTS_BUCKET.put(r2Key3, "<p>Epilogue content</p>");
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key1, ch1.id)
        .run();
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key2, ch2.id)
        .run();
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key3, ch3.id)
        .run();

      const result = await service.exportBook(userId, projectId, "epub");
      expect(result.status).toBe("completed");

      const row = await env.DB.prepare(
        `SELECT chapter_count, total_word_count FROM export_jobs WHERE id = ?`,
      )
        .bind(result.jobId)
        .first<{ chapter_count: number; total_word_count: number }>();
      expect(row!.chapter_count).toBe(3);
      expect(row!.total_word_count).toBe(15);

      // Verify chapter order in the OPF manifest
      const r2Object = await env.EXPORTS_BUCKET.get(`exports/${result.jobId}.epub`);
      const zip = await JSZip.loadAsync(await r2Object!.arrayBuffer());
      const opf = await zip.file("OEBPS/content.opf")!.async("string");
      const ch1Pos = opf.indexOf("chapter-1");
      const ch2Pos = opf.indexOf("chapter-2");
      const ch3Pos = opf.indexOf("chapter-3");
      expect(ch1Pos).toBeLessThan(ch2Pos);
      expect(ch2Pos).toBeLessThan(ch3Pos);
    });
  });

  describe("exportChapter (EPUB)", () => {
    it("exports a single chapter as EPUB", async () => {
      const chapter = await seedChapter(projectId, {
        title: "Standalone Chapter",
        sortOrder: 1,
        wordCount: 20,
      });
      const r2Key = `chapters/${chapter.id}/content.html`;
      await env.EXPORTS_BUCKET.put(r2Key, "<p>Standalone chapter content here.</p>");
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key, chapter.id)
        .run();

      const result = await service.exportChapter(userId, projectId, chapter.id, "epub");

      expect(result.status).toBe("completed");
      expect(result.fileName).toContain("Test Book");
      expect(result.fileName).toContain("Standalone Chapter");
      expect(result.fileName).toContain(".epub");
      expect(result.downloadUrl).toBe(`${apiBaseUrl}/exports/${result.jobId}/download`);
      expect(result.error).toBeNull();

      // Verify D1 export_jobs row has chapter_id set
      const row = await env.DB.prepare(
        `SELECT chapter_id, chapter_count, total_word_count FROM export_jobs WHERE id = ?`,
      )
        .bind(result.jobId)
        .first<{ chapter_id: string; chapter_count: number; total_word_count: number }>();
      expect(row!.chapter_id).toBe(chapter.id);
      expect(row!.chapter_count).toBe(1);
      expect(row!.total_word_count).toBe(20);

      // Verify EPUB content
      const r2Object = await env.EXPORTS_BUCKET.get(`exports/${result.jobId}.epub`);
      const zip = await JSZip.loadAsync(await r2Object!.arrayBuffer());
      const chXhtml = await zip.file("OEBPS/chapter-1.xhtml")!.async("string");
      expect(chXhtml).toContain("Standalone Chapter");
      expect(chXhtml).toContain("Standalone chapter content here.");
    });

    it("throws NOT_FOUND for wrong user's project", async () => {
      const chapter = await seedChapter(projectId, { sortOrder: 1 });
      const other = await seedUser({ id: "other-user-export" });

      await expect(service.exportChapter(other.id, projectId, chapter.id, "epub")).rejects.toThrow(
        "Project not found",
      );
    });

    it("throws NOT_FOUND for chapter not in the specified project", async () => {
      const otherProject = await seedProject(userId, { title: "Other Book" });
      const chapterInOtherProject = await seedChapter(otherProject.id, { sortOrder: 1 });

      await expect(
        service.exportChapter(userId, projectId, chapterInOtherProject.id, "epub"),
      ).rejects.toThrow("Chapter not found");
    });

    it("throws NOT_FOUND for non-existent chapter", async () => {
      await expect(
        service.exportChapter(userId, projectId, "nonexistent-chapter", "epub"),
      ).rejects.toThrow("Chapter not found");
    });
  });

  describe("getExportStatus", () => {
    it("returns status for a completed export job", async () => {
      const chapter = await seedChapter(projectId, {
        title: "Status Test",
        sortOrder: 1,
        wordCount: 5,
      });
      const r2Key = `chapters/${chapter.id}/content.html`;
      await env.EXPORTS_BUCKET.put(r2Key, "<p>Status test content.</p>");
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key, chapter.id)
        .run();

      const exportResult = await service.exportBook(userId, projectId, "epub");

      const status = await service.getExportStatus(userId, exportResult.jobId);

      expect(status.jobId).toBe(exportResult.jobId);
      expect(status.status).toBe("completed");
      expect(status.format).toBe("epub");
      expect(status.chapterCount).toBe(1);
      expect(status.totalWordCount).toBe(5);
      expect(status.error).toBeNull();
      expect(status.fileName).toContain("Test Book");
      expect(status.downloadUrl).toBe(`${apiBaseUrl}/exports/${exportResult.jobId}/download`);
      expect(status.completedAt).not.toBeNull();
    });

    it("throws NOT_FOUND for another user's export job", async () => {
      const chapter = await seedChapter(projectId, { sortOrder: 1 });
      const r2Key = `chapters/${chapter.id}/content.html`;
      await env.EXPORTS_BUCKET.put(r2Key, "<p>Content</p>");
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key, chapter.id)
        .run();

      const exportResult = await service.exportBook(userId, projectId, "epub");
      const other = await seedUser({ id: "other-user-status" });

      await expect(service.getExportStatus(other.id, exportResult.jobId)).rejects.toThrow(
        "Export not found",
      );
    });

    it("throws NOT_FOUND for non-existent export job", async () => {
      await expect(service.getExportStatus(userId, "nonexistent-job")).rejects.toThrow(
        "Export not found",
      );
    });
  });
});
