/**
 * EpubGenerator - Builds valid EPUB 3.0 files using JSZip.
 *
 * Per ADR-004:
 * - EPUB is a ZIP containing XHTML, CSS, and an OPF manifest
 * - Custom implementation with JSZip (~200-300 lines), fully under our control
 * - No external service dependency; runs entirely in-Worker
 *
 * EPUB 3.0 structure:
 * - mimetype (uncompressed, first entry)
 * - META-INF/container.xml
 * - OEBPS/content.opf (OPF manifest)
 * - OEBPS/toc.xhtml (navigation document)
 * - OEBPS/title.xhtml (title page)
 * - OEBPS/chapter-{N}.xhtml (per-chapter content)
 * - OEBPS/style.css (default stylesheet)
 */

import JSZip from "jszip";
import type { BookMetadata, ChapterContent } from "./book-template.js";

/**
 * E-reader stylesheet for EPUB content.
 * Optimized for reflowable text on e-ink and tablet displays.
 */
const EPUB_CSS = `body {
  font-family: Georgia, serif;
  font-size: 1em;
  line-height: 1.5;
  margin: 1em;
  color: #1a1a1a;
}

h1 {
  font-size: 1.5em;
  margin-top: 2em;
  margin-bottom: 0.5em;
}

p {
  text-indent: 1.5em;
  margin: 0;
}

p:first-of-type,
h1 + p,
h2 + p,
h3 + p {
  text-indent: 0;
}

h2 {
  font-size: 1.25em;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

h3 {
  font-size: 1.1em;
  margin-top: 1.25em;
  margin-bottom: 0.5em;
}

blockquote {
  margin: 1em 2em;
  font-style: italic;
}

ul, ol {
  margin: 0.75em 0;
  padding-left: 1.5em;
}

li {
  margin-bottom: 0.25em;
}

hr {
  border: none;
  text-align: center;
  margin: 1.5em 0;
}

hr::before {
  content: "* * *";
  letter-spacing: 0.5em;
  color: #888;
}

.title-page {
  text-align: center;
  margin-top: 30%;
}

.title-page h1 {
  font-size: 2em;
  margin-bottom: 0.5em;
}

.title-page .author {
  font-size: 1.2em;
  margin-top: 1em;
  color: #444;
}

.title-page .date {
  font-size: 0.9em;
  margin-top: 2em;
  color: #888;
}
`;

/**
 * Escape XML entities in text content.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap content in a valid XHTML document for EPUB.
 */
function wrapXhtml(title: string, bodyContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Build the META-INF/container.xml pointing to content.opf.
 */
function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/**
 * Build the OPF manifest listing all resources and spine order.
 */
function buildContentOpf(
  metadata: BookMetadata,
  chapters: ChapterContent[],
  bookId: string,
): string {
  const manifestItems = [
    `    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `    <item id="title-page" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    `    <item id="style" href="style.css" media-type="text/css"/>`,
  ];

  const spineItems = [`    <itemref idref="title-page"/>`, `    <itemref idref="nav"/>`];

  chapters.forEach((ch, index) => {
    const itemId = `chapter-${index + 1}`;
    manifestItems.push(
      `    <item id="${itemId}" href="${itemId}.xhtml" media-type="application/xhtml+xml"/>`,
    );
    spineItems.push(`    <itemref idref="${itemId}"/>`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.authorName)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>${escapeXml(metadata.generatedDate)}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
${manifestItems.join("\n")}
  </manifest>
  <spine>
${spineItems.join("\n")}
  </spine>
</package>`;
}

/**
 * Build the EPUB 3 navigation document (table of contents).
 */
function buildTocXhtml(metadata: BookMetadata, chapters: ChapterContent[]): string {
  const tocEntries = chapters
    .map((ch, index) => {
      const href = `chapter-${index + 1}.xhtml`;
      return `      <li><a href="${href}">${escapeXml(ch.title)}</a></li>`;
    })
    .join("\n");

  const body = `  <nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">
    <h1>Contents</h1>
    <ol>
${tocEntries}
    </ol>
  </nav>`;

  return wrapXhtml(`${metadata.title} - Contents`, body);
}

/**
 * Build the title page XHTML.
 */
function buildTitleXhtml(metadata: BookMetadata): string {
  const body = `  <div class="title-page">
    <h1>${escapeXml(metadata.title)}</h1>
    <div class="author">${escapeXml(metadata.authorName)}</div>
    <div class="date">${escapeXml(metadata.generatedDate)}</div>
  </div>`;

  return wrapXhtml(metadata.title, body);
}

/**
 * Build a chapter XHTML file.
 * The chapter HTML from Tiptap is inserted as-is (it is already HTML from the editor).
 */
function buildChapterXhtml(chapter: ChapterContent): string {
  const body = `  <h1>${escapeXml(chapter.title)}</h1>
${chapter.html}`;

  return wrapXhtml(chapter.title, body);
}

/**
 * Generate a valid EPUB 3.0 file as an ArrayBuffer.
 *
 * @param metadata - Book metadata (title, author, date)
 * @param chapters - Ordered chapter content
 * @returns EPUB binary as ArrayBuffer
 */
export async function generateEpub(
  metadata: BookMetadata,
  chapters: ChapterContent[],
): Promise<ArrayBuffer> {
  const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);

  // Generate a unique book identifier
  const bookId = `urn:draftcrane:${Date.now()}`;

  const zip = new JSZip();

  // 1. mimetype - MUST be first entry, uncompressed (EPUB spec requirement)
  zip.file("mimetype", "application/epub+zip", {
    compression: "STORE",
  });

  // 2. META-INF/container.xml
  zip.file("META-INF/container.xml", buildContainerXml());

  // 3. OEBPS/content.opf (OPF manifest)
  zip.file("OEBPS/content.opf", buildContentOpf(metadata, sorted, bookId));

  // 4. OEBPS/toc.xhtml (navigation document)
  zip.file("OEBPS/toc.xhtml", buildTocXhtml(metadata, sorted));

  // 5. OEBPS/title.xhtml (title page)
  zip.file("OEBPS/title.xhtml", buildTitleXhtml(metadata));

  // 6. OEBPS/chapter-{N}.xhtml (per-chapter content)
  sorted.forEach((chapter, index) => {
    zip.file(`OEBPS/chapter-${index + 1}.xhtml`, buildChapterXhtml(chapter));
  });

  // 7. OEBPS/style.css (default stylesheet)
  zip.file("OEBPS/style.css", EPUB_CSS);

  // Generate ZIP as ArrayBuffer
  return await zip.generateAsync({
    type: "arraybuffer",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
