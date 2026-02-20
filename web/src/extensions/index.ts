/**
 * Tiptap extensions for DraftCrane.
 *
 * Footnote system:
 * - FootnoteRef: Inline superscript reference [N] in text
 * - FootnoteContent: Block entry at bottom of chapter
 * - FootnoteSection: Wrapper container for all footnote entries
 * - FootnotePlugin: Auto-renumbering and orphan cleanup
 */

export { FootnoteRef } from "./footnote-ref";
export { FootnoteContent } from "./footnote-content";
export { FootnoteSection } from "./footnote-section";
export { FootnotePlugin } from "./footnote-plugin";
export { insertFootnote, insertClipWithFootnote } from "./footnote-commands";
