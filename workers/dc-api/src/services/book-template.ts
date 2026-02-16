/**
 * BookTemplate - Assembles HTML documents for PDF export.
 *
 * Per ADR-004:
 * - Title page with book title, author name, generation date
 * - Table of contents with chapter titles (full-book export only)
 * - Chapter pages with H1 headings and page breaks
 * - Print-optimized CSS for US Trade 5.5" x 8.5" page size
 */

export interface BookMetadata {
  title: string;
  authorName: string;
  generatedDate: string;
}

export interface ChapterContent {
  id: string;
  title: string;
  sortOrder: number;
  html: string;
  wordCount: number;
}

/**
 * Core print stylesheet for US Trade 5.5" x 8.5" PDF output.
 * Per ADR-004: serif font, 11pt, 1.5 line height, proper margins.
 */
export const PRINT_CSS = `
@page {
  size: 5.5in 8.5in;
  margin: 0.875in 0.75in 1in 0.75in;
}

@page :first {
  margin-top: 2.5in;
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #1a1a1a;
  margin: 0;
  padding: 0;
}

/* Title page */
.title-page {
  text-align: center;
  page-break-after: always;
}

.title-page h1 {
  font-size: 28pt;
  margin-top: 2in;
  margin-bottom: 0.25in;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.title-page .author {
  font-size: 14pt;
  margin-top: 0.5in;
  color: #444;
}

.title-page .date {
  font-size: 10pt;
  margin-top: 1in;
  color: #888;
}

/* Table of contents */
.toc {
  page-break-after: always;
}

.toc h2 {
  font-size: 18pt;
  margin-top: 1in;
  margin-bottom: 0.5in;
  text-align: center;
}

.toc ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc li {
  font-size: 12pt;
  padding: 0.25em 0;
  border-bottom: 1px dotted #ccc;
}

.toc li a {
  text-decoration: none;
  color: #1a1a1a;
}

/* Chapter headings */
h1.chapter-title {
  font-size: 24pt;
  margin-top: 2in;
  margin-bottom: 0.5in;
  page-break-before: always;
  page-break-after: avoid;
}

h1.chapter-title:first-of-type {
  page-break-before: avoid;
}

/* Chapter content typography */
.chapter-content p {
  text-indent: 0.25in;
  margin: 0;
  orphans: 3;
  widows: 3;
}

.chapter-content p:first-of-type,
.chapter-content h1 + p,
.chapter-content h2 + p,
.chapter-content h3 + p,
.chapter-content blockquote + p {
  text-indent: 0;
}

.chapter-content h2 {
  font-size: 16pt;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}

.chapter-content h3 {
  font-size: 13pt;
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}

.chapter-content blockquote {
  margin: 1em 0.5in;
  font-style: italic;
  page-break-inside: avoid;
}

.chapter-content ul,
.chapter-content ol {
  margin: 0.75em 0;
  padding-left: 1.5em;
}

.chapter-content li {
  margin-bottom: 0.25em;
}

.chapter-content hr {
  border: none;
  text-align: center;
  margin: 1.5em 0;
  page-break-inside: avoid;
}

.chapter-content hr::before {
  content: '* * *';
  font-size: 11pt;
  letter-spacing: 0.5em;
  color: #888;
}
`;

/**
 * Escape HTML entities in text content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Assemble a full-book HTML document with title page, table of contents,
 * and all chapters.
 */
export function assembleBookHtml(metadata: BookMetadata, chapters: ChapterContent[]): string {
  const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);

  const titlePage = `
    <div class="title-page">
      <h1>${escapeHtml(metadata.title)}</h1>
      <div class="author">${escapeHtml(metadata.authorName)}</div>
      <div class="date">${escapeHtml(metadata.generatedDate)}</div>
    </div>
  `;

  const tocEntries = sorted
    .map((ch) => `<li><a href="#chapter-${escapeHtml(ch.id)}">${escapeHtml(ch.title)}</a></li>`)
    .join("\n      ");

  const toc = `
    <div class="toc">
      <h2>Contents</h2>
      <ul>
      ${tocEntries}
      </ul>
    </div>
  `;

  const chapterPages = sorted
    .map(
      (ch) => `
    <div class="chapter" id="chapter-${escapeHtml(ch.id)}">
      <h1 class="chapter-title">${escapeHtml(ch.title)}</h1>
      <div class="chapter-content">${ch.html}</div>
    </div>
  `,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata.title)}</title>
</head>
<body>
  ${titlePage}
  ${toc}
  ${chapterPages}
</body>
</html>`;
}

/**
 * Assemble a single-chapter HTML document with a title page
 * (book title + chapter title). No table of contents.
 */
export function assembleChapterHtml(metadata: BookMetadata, chapter: ChapterContent): string {
  const titlePage = `
    <div class="title-page">
      <h1>${escapeHtml(metadata.title)}</h1>
      <div class="author">${escapeHtml(chapter.title)}</div>
      <div class="date">${escapeHtml(metadata.authorName)} &mdash; ${escapeHtml(metadata.generatedDate)}</div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata.title)} - ${escapeHtml(chapter.title)}</title>
</head>
<body>
  ${titlePage}
  <div class="chapter">
    <h1 class="chapter-title">${escapeHtml(chapter.title)}</h1>
    <div class="chapter-content">${chapter.html}</div>
  </div>
</body>
</html>`;
}
