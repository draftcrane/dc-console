/**
 * Sanitize Google Docs HTML export for display and Tiptap import.
 *
 * Google Docs exports verbose HTML with inline styles, Google-specific
 * class names, and full document wrappers. This utility strips it down
 * to a clean subset compatible with Tiptap's schema.
 */

import sanitizeHtml from "sanitize-html";

/** Tags allowed through sanitization — matches Tiptap's editor schema. */
const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "blockquote",
  "br",
  "a",
];

/** Attributes allowed per tag. Only href on links. */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href"],
};

/**
 * Sanitize HTML from a Google Docs export.
 *
 * 1. Extracts <body> content if present (Google exports full documents)
 * 2. Strips Google-specific classes, styles, and wrapper elements
 * 3. Normalizes to Tiptap-compatible tag subset
 * 4. Removes empty paragraphs (Google spacing artifacts)
 *
 * @param rawHtml - Raw HTML from Google Docs export API
 * @returns Sanitized HTML safe for display and Tiptap import
 */
export function sanitizeGoogleDocsHtml(rawHtml: string): string {
  // Extract <body> content if this is a full document
  let html = rawHtml;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[1];
  }

  // Run through sanitize-html with strict allowlist
  let cleaned = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Convert <b> to <strong>, <i> to <em> for consistency
    transformTags: {
      b: "strong",
      i: "em",
    },
    // Strip all classes and styles — Google Docs injects hundreds
    allowedClasses: {},
    allowedStyles: {},
    // Discard <style> and <script> blocks entirely
    exclusiveFilter: (frame) => {
      return frame.tag === "style" || frame.tag === "script";
    },
  });

  // Remove empty paragraphs (Google Docs spacing artifacts)
  // Matches <p></p>, <p> </p>, <p><br></p>, <p>&nbsp;</p>, etc.
  cleaned = cleaned.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "");

  // Collapse excessive whitespace between tags
  cleaned = cleaned.replace(/>\s+</g, ">\n<");

  return cleaned.trim();
}
