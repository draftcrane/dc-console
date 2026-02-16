import { describe, it, expect } from "vitest";
import { assembleBookHtml, assembleChapterHtml, PRINT_CSS } from "../src/services/book-template.js";

describe("Book Template", () => {
  const metadata = {
    title: "My Test Book",
    authorName: "Jane Author",
    generatedDate: "2026-02-16",
  };

  const chapters = [
    {
      id: "ch-1",
      title: "Chapter One",
      sortOrder: 1,
      html: "<p>First chapter content.</p>",
      wordCount: 3,
    },
    {
      id: "ch-2",
      title: "Chapter Two",
      sortOrder: 2,
      html: "<p>Second chapter content.</p>",
      wordCount: 3,
    },
  ];

  describe("assembleBookHtml", () => {
    it("generates a complete HTML document", () => {
      const html = assembleBookHtml(metadata, chapters);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("</html>");
    });

    it("includes title page with book title, author, and date", () => {
      const html = assembleBookHtml(metadata, chapters);

      expect(html).toContain("My Test Book");
      expect(html).toContain("Jane Author");
      expect(html).toContain("2026-02-16");
      expect(html).toContain('class="title-page"');
    });

    it("includes table of contents with chapter links", () => {
      const html = assembleBookHtml(metadata, chapters);

      expect(html).toContain('class="toc"');
      expect(html).toContain("Contents");
      expect(html).toContain('href="#chapter-ch-1"');
      expect(html).toContain('href="#chapter-ch-2"');
      expect(html).toContain("Chapter One");
      expect(html).toContain("Chapter Two");
    });

    it("includes all chapter content with headings", () => {
      const html = assembleBookHtml(metadata, chapters);

      expect(html).toContain('class="chapter-title"');
      expect(html).toContain("First chapter content.");
      expect(html).toContain("Second chapter content.");
    });

    it("sorts chapters by sortOrder", () => {
      const reversed = [chapters[1], chapters[0]];
      const html = assembleBookHtml(metadata, reversed);

      const ch1Pos = html.indexOf("Chapter One");
      const ch2Pos = html.indexOf("Chapter Two");
      expect(ch1Pos).toBeLessThan(ch2Pos);
    });

    it("escapes HTML entities in title", () => {
      const meta = { ...metadata, title: "Book <script>alert(1)</script>" };
      const html = assembleBookHtml(meta, chapters);

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("assembleChapterHtml", () => {
    it("generates a complete HTML document for a single chapter", () => {
      const html = assembleChapterHtml(metadata, chapters[0]);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("My Test Book");
      expect(html).toContain("Chapter One");
    });

    it("includes title page with book and chapter title", () => {
      const html = assembleChapterHtml(metadata, chapters[0]);

      expect(html).toContain('class="title-page"');
      expect(html).toContain("My Test Book");
      expect(html).toContain("Chapter One");
      expect(html).toContain("Jane Author");
    });

    it("does not include table of contents", () => {
      const html = assembleChapterHtml(metadata, chapters[0]);

      expect(html).not.toContain('class="toc"');
      expect(html).not.toContain("Contents");
    });

    it("includes chapter content", () => {
      const html = assembleChapterHtml(metadata, chapters[0]);

      expect(html).toContain("First chapter content.");
    });
  });

  describe("PRINT_CSS", () => {
    it("defines US Trade page size", () => {
      expect(PRINT_CSS).toContain("5.5in 8.5in");
    });

    it("uses serif font family", () => {
      expect(PRINT_CSS).toContain("Georgia");
      expect(PRINT_CSS).toContain("serif");
    });

    it("sets 11pt font size", () => {
      expect(PRINT_CSS).toContain("11pt");
    });

    it("sets 1.5 line height", () => {
      expect(PRINT_CSS).toContain("line-height: 1.5");
    });

    it("includes page-break rules for chapters", () => {
      expect(PRINT_CSS).toContain("page-break-before: always");
      expect(PRINT_CSS).toContain("page-break-after: avoid");
    });
  });
});
