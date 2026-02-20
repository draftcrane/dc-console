import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  FootnoteRef,
  FootnoteContent,
  FootnoteSection,
  FootnotePlugin,
  insertClipWithFootnote,
} from "@/extensions";

/**
 * Tests for insertClipWithFootnote (#200).
 *
 * This function inserts a blockquote + footnote as a single ProseMirror transaction,
 * ensuring Cmd+Z undoes the entire operation atomically.
 *
 * Uses StarterKit (which includes Document, Paragraph, Text, HorizontalRule,
 * Blockquote, History, etc.) for a realistic editor environment.
 */

/** Create a Tiptap editor with StarterKit + footnote extensions */
function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      FootnoteRef,
      FootnoteContent,
      FootnoteSection,
      FootnotePlugin,
    ],
    content: content || "<p>Hello world</p>",
  });
}

describe("insertClipWithFootnote", () => {
  it("inserts a blockquote containing the clip text", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    const result = insertClipWithFootnote(editor, "Test clip text", "Source Title");
    expect(result).toBe(true);

    const html = editor.getHTML();
    expect(html).toContain("<blockquote>");
    expect(html).toContain("Test clip text");
    editor.destroy();
  });

  it("creates a footnoteRef after the blockquote", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertClipWithFootnote(editor, "Quote from source", "My Research Paper");

    const html = editor.getHTML();
    expect(html).toContain("footnote-ref");
    expect(html).toContain("data-footnote-id");
    editor.destroy();
  });

  it("creates a footnoteContent with source title", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertClipWithFootnote(editor, "Quote text", "My Research Paper");

    const html = editor.getHTML();
    expect(html).toContain("footnote-content");
    expect(html).toContain("My Research Paper");
    editor.destroy();
  });

  it("creates a footnoteSection with HR when none exists", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertClipWithFootnote(editor, "Quote text", "Source A");

    const html = editor.getHTML();
    expect(html).toContain("<hr>");
    expect(html).toContain('<div class="footnotes">');
    editor.destroy();
  });

  it("appends to existing footnote section on second insert", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertClipWithFootnote(editor, "First quote", "Source A");
    // Move cursor back to the paragraph
    editor.commands.setTextSelection(6);
    insertClipWithFootnote(editor, "Second quote", "Source B");

    const html = editor.getHTML();
    expect(html).toContain("First quote");
    expect(html).toContain("Second quote");
    expect(html).toContain("Source A");
    expect(html).toContain("Source B");

    // Only one footnotes section
    const footnoteSections = (html.match(/class="footnotes"/g) || []).length;
    expect(footnoteSections).toBe(1);

    editor.destroy();
  });

  it("assigns sequential labels via FootnotePlugin", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertClipWithFootnote(editor, "Quote A", "Source A");
    editor.commands.setTextSelection(6);
    insertClipWithFootnote(editor, "Quote B", "Source B");

    const html = editor.getHTML();
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");

    editor.destroy();
  });

  it("returns false when editor is null-ish", () => {
    const result = insertClipWithFootnote(null as unknown as Editor, "text", "source");
    expect(result).toBe(false);
  });

  it("undo removes both blockquote and footnote together", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertClipWithFootnote(editor, "Quote text", "Source A");

    // Verify content was inserted
    let html = editor.getHTML();
    expect(html).toContain("<blockquote>");
    expect(html).toContain("footnote-ref");
    expect(html).toContain("Source A");

    // Undo should remove everything (blockquote + footnote section + hr)
    editor.commands.undo();

    html = editor.getHTML();
    expect(html).not.toContain("<blockquote>");
    expect(html).not.toContain("footnote-ref");
    // The footnote content is cleaned up by the FootnotePlugin after ref removal
    expect(html).not.toContain("footnote-content");

    editor.destroy();
  });

  it("produces clean HTML for Drive export", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertClipWithFootnote(editor, "Important finding", "Research Paper Title");

    const html = editor.getHTML();

    // Clean HTML structure
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<sup");
    expect(html).toContain("<hr>");
    expect(html).toContain('<div class="footnotes">');
    expect(html).toContain('class="footnote-content"');

    // No ProseMirror-specific garbage
    expect(html).not.toContain("ProseMirror");
    expect(html).not.toContain("contenteditable");

    editor.destroy();
  });

  it("survives HTML round-trip", () => {
    const editor1 = createEditor("<p>Hello world</p>");
    editor1.commands.setTextSelection(editor1.state.doc.content.size - 1);
    insertClipWithFootnote(editor1, "Quote text", "My Source");

    const savedHtml = editor1.getHTML();
    editor1.destroy();

    // Restore into a new editor
    const editor2 = createEditor(savedHtml);
    const restoredHtml = editor2.getHTML();

    expect(restoredHtml).toContain("<blockquote>");
    expect(restoredHtml).toContain("Quote text");
    expect(restoredHtml).toContain("footnote-ref");
    expect(restoredHtml).toContain("footnote-content");
    expect(restoredHtml).toContain("My Source");
    expect(restoredHtml).toContain('data-footnote-label="1"');

    editor2.destroy();
  });
});
