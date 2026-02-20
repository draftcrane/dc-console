import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env } from "cloudflare:test";
import JSZip from "jszip";
import { BackupService, IMPORT_LIMITS } from "../src/services/backup.js";
import { seedUser, seedProject, seedChapter, cleanAll } from "./helpers/seed.js";

describe("BackupService", () => {
  let service: BackupService;
  let userId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new BackupService(env.DB, env.EXPORTS_BUCKET);
    const user = await seedUser();
    userId = user.id;
  });

  describe("generateBackup", () => {
    it("generates a ZIP with manifest and chapter files", async () => {
      const proj = await seedProject(userId, { title: "My Book" });
      const ch = await seedChapter(proj.id, { title: "Introduction", sortOrder: 1, wordCount: 5 });

      // Put some content in R2
      const r2Key = `chapters/${ch.id}/content.html`;
      await env.EXPORTS_BUCKET.put(r2Key, "<p>Hello world content here now</p>");
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`).bind(r2Key, ch.id).run();

      const result = await service.generateBackup(userId, proj.id);

      expect(result.fileName).toContain("My Book");
      expect(result.fileName).toMatch(/\.zip$/);

      // Parse the ZIP
      const zip = await JSZip.loadAsync(result.data);
      const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));

      expect(manifest.version).toBe(1);
      expect(manifest.app).toBe("DraftCrane");
      expect(manifest.project.title).toBe("My Book");
      expect(manifest.chapters).toHaveLength(1);
      expect(manifest.chapters[0].title).toBe("Introduction");

      // Verify chapter content in ZIP
      const chapterFile = zip.file(`chapters/${manifest.chapters[0].fileName}`);
      expect(chapterFile).not.toBeNull();
      const html = await chapterFile!.async("text");
      expect(html).toContain("Hello world");
    });

    it("throws NOT_FOUND for another user's project", async () => {
      const proj = await seedProject(userId);
      await seedChapter(proj.id);
      const other = await seedUser({ id: "other-user" });

      await expect(service.generateBackup(other.id, proj.id)).rejects.toThrow("Project not found");
    });
  });

  describe("importBackup", () => {
    it("imports a ZIP backup as a new project", async () => {
      // Build a valid backup ZIP
      const zip = new JSZip();
      const chaptersFolder = zip.folder("chapters")!;
      chaptersFolder.file("01-intro.html", "<p>Imported content</p>");
      chaptersFolder.file("02-body.html", "<p>Second chapter</p>");

      zip.file(
        "manifest.json",
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          app: "DraftCrane",
          project: { title: "Imported Book", description: "A test import" },
          chapters: [
            { title: "Intro", sortOrder: 1, fileName: "01-intro.html", wordCount: 2 },
            { title: "Body", sortOrder: 2, fileName: "02-body.html", wordCount: 2 },
          ],
        }),
      );

      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
      const result = await service.importBackup(userId, zipBuffer);

      expect(result.title).toBe("Imported Book");
      expect(result.chapterCount).toBe(2);

      // Verify project exists in DB
      const row = await env.DB.prepare(`SELECT title FROM projects WHERE id = ?`)
        .bind(result.projectId)
        .first<{ title: string }>();
      expect(row!.title).toBe("Imported Book");

      // Verify chapters in DB
      const chapters = await env.DB.prepare(
        `SELECT title, sort_order FROM chapters WHERE project_id = ? ORDER BY sort_order`,
      )
        .bind(result.projectId)
        .all<{ title: string; sort_order: number }>();
      expect(chapters.results).toHaveLength(2);
      expect(chapters.results![0].title).toBe("Intro");
      expect(chapters.results![1].title).toBe("Body");
    });

    it("rejects ZIP without manifest", async () => {
      const zip = new JSZip();
      zip.file("random.txt", "nothing");
      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      await expect(service.importBackup(userId, zipBuffer)).rejects.toThrow(
        "missing manifest.json",
      );
    });

    it("rejects manifest with no chapters", async () => {
      const zip = new JSZip();
      zip.file(
        "manifest.json",
        JSON.stringify({
          version: 1,
          app: "DraftCrane",
          project: { title: "Empty" },
          chapters: [],
        }),
      );
      const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

      await expect(service.importBackup(userId, zipBuffer)).rejects.toThrow("no chapters found");
    });

    describe("zip-bomb guards", () => {
      // Save original limits and restore after each test
      const originalLimits = { ...IMPORT_LIMITS };
      afterEach(() => {
        Object.assign(IMPORT_LIMITS, originalLimits);
      });

      it("rejects ZIP exceeding max entry count", async () => {
        // Lower the limit so we don't need to create hundreds of files
        (IMPORT_LIMITS as Record<string, number>).MAX_ENTRY_COUNT = 3;

        const zip = new JSZip();
        const chapters = zip.folder("chapters")!;
        // 4 chapter files + manifest = 5 file entries, but limit is 3
        chapters.file("01-a.html", "<p>a</p>");
        chapters.file("02-b.html", "<p>b</p>");
        chapters.file("03-c.html", "<p>c</p>");
        chapters.file("04-d.html", "<p>d</p>");
        zip.file(
          "manifest.json",
          JSON.stringify({
            version: 1,
            app: "DraftCrane",
            project: { title: "Too Many" },
            chapters: [
              { title: "A", sortOrder: 1, fileName: "01-a.html", wordCount: 1 },
              { title: "B", sortOrder: 2, fileName: "02-b.html", wordCount: 1 },
              { title: "C", sortOrder: 3, fileName: "03-c.html", wordCount: 1 },
              { title: "D", sortOrder: 4, fileName: "04-d.html", wordCount: 1 },
            ],
          }),
        );

        const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

        await expect(service.importBackup(userId, zipBuffer)).rejects.toThrow(
          /exceeds maximum entry count/,
        );
      });

      it("rejects ZIP with a single entry exceeding max uncompressed size", async () => {
        // Lower the per-entry limit to 10 bytes for testing
        (IMPORT_LIMITS as Record<string, number>).MAX_ENTRY_UNCOMPRESSED_BYTES = 10;

        const zip = new JSZip();
        const chapters = zip.folder("chapters")!;
        // This entry is > 10 bytes uncompressed
        chapters.file("01-big.html", "<p>This content is way too large for the limit</p>");
        zip.file(
          "manifest.json",
          JSON.stringify({
            version: 1,
            app: "DraftCrane",
            project: { title: "Big Entry" },
            chapters: [{ title: "Big", sortOrder: 1, fileName: "01-big.html", wordCount: 1 }],
          }),
        );

        const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

        await expect(service.importBackup(userId, zipBuffer)).rejects.toThrow(
          /exceeds maximum uncompressed size/,
        );
      });

      it("rejects ZIP exceeding max total uncompressed size", async () => {
        // Lower the total limit to 50 bytes for testing
        (IMPORT_LIMITS as Record<string, number>).MAX_TOTAL_UNCOMPRESSED_BYTES = 50;
        // Keep per-entry limit high so individual entries pass
        (IMPORT_LIMITS as Record<string, number>).MAX_ENTRY_UNCOMPRESSED_BYTES = 100;

        const zip = new JSZip();
        const chapters = zip.folder("chapters")!;
        // Each entry is ~30 bytes; two of them + manifest exceeds 50 byte total
        chapters.file("01-a.html", "<p>Content chunk A here!</p>");
        chapters.file("02-b.html", "<p>Content chunk B here!</p>");
        zip.file(
          "manifest.json",
          JSON.stringify({
            version: 1,
            app: "DraftCrane",
            project: { title: "Big Total" },
            chapters: [
              { title: "A", sortOrder: 1, fileName: "01-a.html", wordCount: 1 },
              { title: "B", sortOrder: 2, fileName: "02-b.html", wordCount: 1 },
            ],
          }),
        );

        const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

        await expect(service.importBackup(userId, zipBuffer)).rejects.toThrow(
          /exceeds maximum total uncompressed size/,
        );
      });

      it("accepts a valid ZIP within all limits", async () => {
        // Use small limits that our test ZIP stays under
        (IMPORT_LIMITS as Record<string, number>).MAX_ENTRY_COUNT = 10;
        (IMPORT_LIMITS as Record<string, number>).MAX_ENTRY_UNCOMPRESSED_BYTES = 10000;
        (IMPORT_LIMITS as Record<string, number>).MAX_TOTAL_UNCOMPRESSED_BYTES = 50000;

        const zip = new JSZip();
        const chapters = zip.folder("chapters")!;
        chapters.file("01-intro.html", "<p>Valid content</p>");
        zip.file(
          "manifest.json",
          JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            app: "DraftCrane",
            project: { title: "Valid Import", description: "passes guards" },
            chapters: [{ title: "Intro", sortOrder: 1, fileName: "01-intro.html", wordCount: 2 }],
          }),
        );

        const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
        const result = await service.importBackup(userId, zipBuffer);

        expect(result.title).toBe("Valid Import");
        expect(result.chapterCount).toBe(1);
      });
    });
  });

  describe("round-trip", () => {
    it("export then import preserves content", async () => {
      // Setup: project with 2 chapters and content
      const proj = await seedProject(userId, { title: "Round-Trip Book" });
      const ch1 = await seedChapter(proj.id, { title: "Chapter One", sortOrder: 1 });
      const ch2 = await seedChapter(proj.id, { title: "Chapter Two", sortOrder: 2 });

      const html1 = "<p>First chapter content</p>";
      const html2 = "<p>Second chapter content</p>";
      const r2Key1 = `chapters/${ch1.id}/content.html`;
      const r2Key2 = `chapters/${ch2.id}/content.html`;

      await env.EXPORTS_BUCKET.put(r2Key1, html1);
      await env.EXPORTS_BUCKET.put(r2Key2, html2);
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key1, ch1.id)
        .run();
      await env.DB.prepare(`UPDATE chapters SET r2_key = ? WHERE id = ?`)
        .bind(r2Key2, ch2.id)
        .run();

      // Export
      const backup = await service.generateBackup(userId, proj.id);

      // Import (creates new project)
      const imported = await service.importBackup(userId, backup.data);

      expect(imported.title).toBe("Round-Trip Book");
      expect(imported.chapterCount).toBe(2);
      expect(imported.projectId).not.toBe(proj.id); // Must be a new project

      // Verify content in new project's R2 keys
      const newChapters = await env.DB.prepare(
        `SELECT id, title, r2_key FROM chapters WHERE project_id = ? ORDER BY sort_order`,
      )
        .bind(imported.projectId)
        .all<{ id: string; title: string; r2_key: string }>();

      expect(newChapters.results).toHaveLength(2);

      const newContent1 = await env.EXPORTS_BUCKET.get(newChapters.results![0].r2_key);
      const newContent2 = await env.EXPORTS_BUCKET.get(newChapters.results![1].r2_key);
      expect(await newContent1!.text()).toBe(html1);
      expect(await newContent2!.text()).toBe(html2);
    });
  });
});
