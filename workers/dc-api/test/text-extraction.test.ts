import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  htmlToPlainText,
  extractFromTxt,
  extractFromMarkdown,
  extractPlainTextFromHtml,
  storeExtractionResult,
  removeFtsEntry,
} from "../src/services/text-extraction.js";
import { seedUser, seedProject, cleanAll } from "./helpers/seed.js";

describe("text-extraction", () => {
  describe("htmlToPlainText", () => {
    it("strips HTML tags", () => {
      const result = htmlToPlainText("<p>Hello <strong>world</strong></p>");
      expect(result).toBe("Hello world");
    });

    it("decodes HTML entities", () => {
      const result = htmlToPlainText("<p>A &amp; B &lt; C &gt; D &quot;E&quot; &#39;F&#39;</p>");
      expect(result).toBe("A & B < C > D \"E\" 'F'");
    });

    it("collapses whitespace", () => {
      const result = htmlToPlainText("<p>Hello</p>   <p>World</p>");
      expect(result).toBe("Hello World");
    });

    it("handles empty input", () => {
      expect(htmlToPlainText("")).toBe("");
    });

    it("handles &nbsp; entities", () => {
      const result = htmlToPlainText("<p>Hello&nbsp;World</p>");
      expect(result).toBe("Hello World");
    });
  });

  describe("extractFromTxt", () => {
    it("extracts text from plain text content", () => {
      const content = new TextEncoder().encode("Hello world.\n\nThis is a paragraph.");
      const result = extractFromTxt(content.buffer as ArrayBuffer);

      expect(result.html).toContain("<p>");
      expect(result.html).toContain("Hello world.");
      expect(result.plainText).toBe("Hello world.\n\nThis is a paragraph.");
      // "Hello world." (2) + "This is a paragraph." (4) = 6 words (countWords strips HTML)
      expect(result.wordCount).toBe(6);
    });

    it("handles empty text", () => {
      const content = new TextEncoder().encode("");
      const result = extractFromTxt(content.buffer as ArrayBuffer);
      expect(result.plainText).toBe("");
      expect(result.wordCount).toBe(0);
    });
  });

  describe("extractFromMarkdown", () => {
    it("extracts text and HTML from markdown", () => {
      const md = "# Title\n\nSome text with **bold** and *italic*.";
      const content = new TextEncoder().encode(md);
      const result = extractFromMarkdown(content.buffer as ArrayBuffer);

      expect(result.html).toContain("<h1>Title</h1>");
      expect(result.html).toContain("<strong>bold</strong>");
      expect(result.html).toContain("<em>italic</em>");
      expect(result.plainText).toContain("Title");
      expect(result.plainText).toContain("bold");
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it("escapes HTML in headings and list items", () => {
      const md = "# <img src=x onerror=alert(1)>\n- <script>alert(1)</script>";
      const content = new TextEncoder().encode(md);
      const result = extractFromMarkdown(content.buffer as ArrayBuffer);

      expect(result.html).toContain("<h1>&lt;img src=x onerror=alert(1)&gt;</h1>");
      expect(result.html).toContain("<li>&lt;script&gt;alert(1)&lt;/script&gt;</li>");
      expect(result.html).not.toContain("<script>");
      expect(result.html).not.toContain("<img ");
    });
  });

  describe("extractPlainTextFromHtml", () => {
    it("produces plain text from HTML", () => {
      const html = "<h1>Title</h1><p>Some <strong>content</strong> here.</p>";
      const result = extractPlainTextFromHtml(html);

      expect(result.plainText).toBe("Title Some content here.");
      expect(result.html).toBe(html); // HTML is passed through unchanged
      expect(result.wordCount).toBe(4);
    });
  });

  describe("storeExtractionResult", () => {
    beforeEach(async () => {
      await cleanAll();
    });

    it("stores HTML and plain text in R2 and populates FTS", async () => {
      const sourceId = "test-source-1";
      const title = "Test Document";
      const result = {
        html: "<p>Hello world from the test document.</p>",
        plainText: "Hello world from the test document.",
        wordCount: 6,
      };

      const { r2Key, cachedAt } = await storeExtractionResult(
        sourceId,
        title,
        result,
        env.EXPORTS_BUCKET,
        env.DB,
      );

      expect(r2Key).toBe(`sources/${sourceId}/content.html`);
      expect(cachedAt).toBeTruthy();

      // Verify HTML stored in R2
      const htmlObj = await env.EXPORTS_BUCKET.get(`sources/${sourceId}/content.html`);
      expect(htmlObj).toBeTruthy();
      expect(await htmlObj!.text()).toBe(result.html);

      // Verify plain text stored in R2
      const txtObj = await env.EXPORTS_BUCKET.get(`sources/${sourceId}/content.txt`);
      expect(txtObj).toBeTruthy();
      expect(await txtObj!.text()).toBe(result.plainText);

      // Verify FTS entry
      const ftsRow = await env.DB.prepare(`SELECT * FROM source_content_fts WHERE source_id = ?`)
        .bind(sourceId)
        .first<{ source_id: string; title: string; content: string }>();
      expect(ftsRow).toBeTruthy();
      expect(ftsRow!.title).toBe(title);
      expect(ftsRow!.content).toBe(result.plainText);
    });

    it("replaces FTS entry on re-extraction", async () => {
      const sourceId = "test-source-2";
      const title = "Test Document";

      // First extraction
      await storeExtractionResult(
        sourceId,
        title,
        { html: "<p>Version 1</p>", plainText: "Version 1", wordCount: 2 },
        env.EXPORTS_BUCKET,
        env.DB,
      );

      // Re-extraction (content refresh)
      await storeExtractionResult(
        sourceId,
        title,
        { html: "<p>Version 2</p>", plainText: "Version 2", wordCount: 2 },
        env.EXPORTS_BUCKET,
        env.DB,
      );

      // Should have exactly one FTS entry with updated content
      const rows = await env.DB.prepare(
        `SELECT content FROM source_content_fts WHERE source_id = ?`,
      )
        .bind(sourceId)
        .all<{ content: string }>();
      expect(rows.results).toHaveLength(1);
      expect(rows.results![0].content).toBe("Version 2");
    });
  });

  describe("removeFtsEntry", () => {
    beforeEach(async () => {
      await cleanAll();
    });

    it("removes FTS entry for a source", async () => {
      const sourceId = "test-source-remove";

      // Insert an FTS entry
      await env.DB.prepare(
        `INSERT INTO source_content_fts (source_id, title, content) VALUES (?, ?, ?)`,
      )
        .bind(sourceId, "Title", "Some content")
        .run();

      // Verify it exists
      const before = await env.DB.prepare(`SELECT * FROM source_content_fts WHERE source_id = ?`)
        .bind(sourceId)
        .first();
      expect(before).toBeTruthy();

      // Remove it
      await removeFtsEntry(sourceId, env.DB);

      // Verify it's gone
      const after = await env.DB.prepare(`SELECT * FROM source_content_fts WHERE source_id = ?`)
        .bind(sourceId)
        .first();
      expect(after).toBeNull();
    });

    it("does not error when removing non-existent entry", async () => {
      // Should not throw
      await removeFtsEntry("nonexistent-source", env.DB);
    });
  });

  describe("FTS search", () => {
    beforeEach(async () => {
      await cleanAll();
    });

    it("finds sources by keyword search", async () => {
      // Insert multiple FTS entries
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO source_content_fts (source_id, title, content) VALUES (?, ?, ?)`,
        ).bind("src-1", "Interview Notes", "The meeting covered revenue growth strategies"),
        env.DB.prepare(
          `INSERT INTO source_content_fts (source_id, title, content) VALUES (?, ?, ?)`,
        ).bind("src-2", "Research Paper", "Climate change impacts on agriculture"),
        env.DB.prepare(
          `INSERT INTO source_content_fts (source_id, title, content) VALUES (?, ?, ?)`,
        ).bind("src-3", "Book Draft", "The revenue model was discussed in chapter three"),
      ]);

      // Search for "revenue"
      const results = await env.DB.prepare(
        `SELECT source_id, title FROM source_content_fts WHERE source_content_fts MATCH ?`,
      )
        .bind("revenue")
        .all<{ source_id: string; title: string }>();

      expect(results.results).toHaveLength(2);
      const ids = results.results!.map((r) => r.source_id);
      expect(ids).toContain("src-1");
      expect(ids).toContain("src-3");
    });

    it("supports porter stemming", async () => {
      await env.DB.prepare(
        `INSERT INTO source_content_fts (source_id, title, content) VALUES (?, ?, ?)`,
      )
        .bind("src-stem", "Strategies", "running runners ran")
        .run();

      // "run" should match "running", "runners", "ran" via porter stemming
      const results = await env.DB.prepare(
        `SELECT source_id FROM source_content_fts WHERE source_content_fts MATCH ?`,
      )
        .bind("run")
        .all<{ source_id: string }>();

      expect(results.results!.length).toBeGreaterThan(0);
    });
  });
});
