/**
 * Tiptap extensions for DraftCrane.
 *
 * Footnote system:
 * - FootnoteRef: Inline superscript reference [N] in text
 * - FootnoteContent: Block entry at bottom of chapter
 * - FootnoteSection: Wrapper container for all footnote entries
 * - FootnotePlugin: Auto-renumbering and orphan cleanup
 *
 * Highlight flash:
 * - HighlightFlash: Temporary decoration for AI rewrite feedback
 */

export { FootnoteRef } from "./footnote-ref";
export { FootnoteContent } from "./footnote-content";
export { FootnoteSection } from "./footnote-section";
export { FootnotePlugin } from "./footnote-plugin";
export { insertFootnote, insertClipWithFootnote } from "./footnote-commands";
export { HighlightFlash } from "./highlight-flash";
