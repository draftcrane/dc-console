/**
 * Text extraction service -- extracts plain text and HTML from various document formats.
 *
 * Handles:
 * - .txt files (plain text)
 * - .md files (Markdown)
 * - .docx files (via mammoth.js)
 * - .pdf files (via unpdf)
 * - Google Docs (HTML already available via Drive export)
 *
 * After extraction, stores both HTML (for viewer) and plain text (for AI/FTS)
 * in R2, then populates the source_content_fts FTS5 table.
 *
 * ADR-008 defines the library choices and sanitization whitelist.
 *
 * NOTE: mammoth and unpdf are dynamically imported to avoid module resolution
 * issues in the vitest pool-workers test environment (mammoth requires node:os
 * at import time). Dynamic import defers loading to actual usage in production.
 */

import sanitizeHtml from "sanitize-html";
import { countWords } from "../utils/word-count.js";
import { textToHtml, markdownToHtml } from "./source-local.js";

/** Mammoth HTML sanitization whitelist per ADR-008 */
const MAMMOTH_ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "br",
  "sup",
  "sub",
  "blockquote",
];

const MAMMOTH_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href"],
};

/** Result of text extraction */
export interface ExtractionResult {
  html: string;
  plainText: string;
  wordCount: number;
}

/**
 * Strip HTML tags to produce plain text.
 * Used for FTS indexing and AI queries.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract text and HTML from a .txt file.
 */
export function extractFromTxt(content: ArrayBuffer): ExtractionResult {
  const text = new TextDecoder().decode(content);
  const html = textToHtml(text);
  const plainText = text.trim();
  return { html, plainText, wordCount: countWords(html) };
}

/**
 * Extract text and HTML from a .md file.
 */
export function extractFromMarkdown(content: ArrayBuffer): ExtractionResult {
  const text = new TextDecoder().decode(content);
  const html = markdownToHtml(text);
  const plainText = htmlToPlainText(html);
  return { html, plainText, wordCount: countWords(html) };
}

/**
 * Extract text and HTML from a .docx file using mammoth.js.
 * HTML output is sanitized per ADR-008 whitelist.
 * Uses dynamic import to avoid module resolution issues in test environment.
 */
export async function extractFromDocx(content: ArrayBuffer): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.default.convertToHtml({ arrayBuffer: content });
  const html = sanitizeHtml(result.value, {
    allowedTags: MAMMOTH_ALLOWED_TAGS,
    allowedAttributes: MAMMOTH_ALLOWED_ATTRIBUTES,
  });
  const plainText = htmlToPlainText(html);
  return { html, plainText, wordCount: countWords(html) };
}

/**
 * Extract text and HTML from a .pdf file using unpdf.
 * PDF text is flat (no structural info) per ADR-008 known limitations.
 * Uses dynamic import to avoid module resolution issues in test environment.
 */
export async function extractFromPdf(content: ArrayBuffer): Promise<ExtractionResult> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(content));
  const { text } = await extractText(doc, { mergePages: true });
  const plainText = text.trim();
  const html = textToHtml(plainText);
  return { html, plainText, wordCount: countWords(html) };
}

/**
 * Extract plain text from existing HTML (for Google Docs and re-extraction).
 * Used when we already have HTML but need the plain text version for FTS/AI.
 */
export function extractPlainTextFromHtml(html: string): ExtractionResult {
  const plainText = htmlToPlainText(html);
  return { html, plainText, wordCount: countWords(html) };
}

/** File extension to extraction format mapping */
const EXTRACTION_MAP: Record<string, "txt" | "md" | "docx" | "pdf"> = {
  ".txt": "txt",
  ".md": "md",
  ".docx": "docx",
  ".pdf": "pdf",
};

/**
 * Extract content from a file based on its extension.
 *
 * @param content - Raw file content as ArrayBuffer
 * @param extension - File extension including dot (e.g. ".pdf")
 * @returns Extraction result with HTML, plain text, and word count
 * @throws Error if the extension is not supported
 */
export async function extractFromFile(
  content: ArrayBuffer,
  extension: string,
): Promise<ExtractionResult> {
  const format = EXTRACTION_MAP[extension.toLowerCase()];
  if (!format) {
    throw new Error(`Unsupported file extension: ${extension}`);
  }

  switch (format) {
    case "txt":
      return extractFromTxt(content);
    case "md":
      return extractFromMarkdown(content);
    case "docx":
      return extractFromDocx(content);
    case "pdf":
      return extractFromPdf(content);
  }
}

/**
 * Store extraction results in R2 (HTML + plain text) and update FTS index.
 *
 * R2 storage pattern:
 *   - sources/{sourceId}/content.html (for viewer display)
 *   - sources/{sourceId}/content.txt  (for AI queries and FTS)
 *
 * @param sourceId - Source material ID
 * @param title - Source title (indexed in FTS)
 * @param result - Extraction result
 * @param bucket - R2 bucket binding
 * @param db - D1 database binding
 */
export async function storeExtractionResult(
  sourceId: string,
  title: string,
  result: ExtractionResult,
  bucket: R2Bucket,
  db: D1Database,
): Promise<{ r2Key: string; cachedAt: string }> {
  const now = new Date().toISOString();
  const r2KeyHtml = `sources/${sourceId}/content.html`;
  const r2KeyTxt = `sources/${sourceId}/content.txt`;

  // Write HTML and plain text to R2 in parallel
  await Promise.all([
    bucket.put(r2KeyHtml, result.html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
      customMetadata: { sourceId, cachedAt: now },
    }),
    bucket.put(r2KeyTxt, result.plainText, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
      customMetadata: { sourceId, cachedAt: now },
    }),
  ]);

  // Update FTS index (delete old entry first, then insert new)
  await db.batch([
    db.prepare(`DELETE FROM source_content_fts WHERE source_id = ?`).bind(sourceId),
    db
      .prepare(`INSERT INTO source_content_fts (source_id, title, content) VALUES (?, ?, ?)`)
      .bind(sourceId, title, result.plainText),
  ]);

  return { r2Key: r2KeyHtml, cachedAt: now };
}

/**
 * Remove FTS index entry for a source.
 * Called when a source is archived/deleted.
 */
export async function removeFtsEntry(sourceId: string, db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM source_content_fts WHERE source_id = ?`).bind(sourceId).run();
}
