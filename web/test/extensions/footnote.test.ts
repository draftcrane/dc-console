import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import {
  FootnoteRef,
  FootnoteContent,
  FootnoteSection,
  FootnotePlugin,
  insertFootnote,
} from "@/extensions";

/**
 * Tests for the DraftCrane footnote extension system (#196).
 *
 * These tests exercise:
 * - FootnoteRef node creation and HTML serialization
 * - FootnoteContent node creation and HTML serialization
 * - FootnoteSection container behavior
 * - FootnotePlugin auto-renumbering
 * - FootnotePlugin orphan cleanup (linked deletion)
 * - insertFootnote command
 * - HTML round-trip (serialization + deserialization)
 */

/** Create a minimal Tiptap editor with footnote extensions */
function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      HorizontalRule,
      FootnoteRef,
      FootnoteContent,
      FootnoteSection,
      FootnotePlugin,
    ],
    content: content || "<p>Hello world</p>",
  });
}

describe("FootnoteRef", () => {
  it("is registered as a node type in the schema", () => {
    const editor = createEditor();
    expect(editor.schema.nodes.footnoteRef).toBeDefined();
    editor.destroy();
  });

  it("is an inline atom node", () => {
    const editor = createEditor();
    const nodeType = editor.schema.nodes.footnoteRef;
    expect(nodeType.isInline).toBe(true);
    expect(nodeType.isAtom).toBe(true);
    editor.destroy();
  });

  it("serializes to HTML with data attributes", () => {
    const editor = createEditor(
      '<p>Text<sup data-footnote-id="fn-1" data-footnote-label="1">[1]</sup></p>' +
        '<div class="footnotes"><div class="footnote-content" data-footnote-id="fn-1" data-footnote-label="1">Source A</div></div>',
    );
    const html = editor.getHTML();
    expect(html).toContain("data-footnote-id");
    expect(html).toContain("data-footnote-label");
    expect(html).toContain("footnote-ref");
    editor.destroy();
  });
});

describe("FootnoteContent", () => {
  it("is registered as a node type in the schema", () => {
    const editor = createEditor();
    expect(editor.schema.nodes.footnoteContent).toBeDefined();
    editor.destroy();
  });

  it("is a block node", () => {
    const editor = createEditor();
    const nodeType = editor.schema.nodes.footnoteContent;
    expect(nodeType.isBlock).toBe(true);
    editor.destroy();
  });

  it("accepts inline content", () => {
    const editor = createEditor(
      '<p>Text<sup data-footnote-id="fn-1" data-footnote-label="1">[1]</sup></p>' +
        '<div class="footnotes"><div class="footnote-content" data-footnote-id="fn-1" data-footnote-label="1">My Source Title</div></div>',
    );
    const html = editor.getHTML();
    expect(html).toContain("My Source Title");
    expect(html).toContain("footnote-content");
    editor.destroy();
  });
});

describe("FootnoteSection", () => {
  it("is registered as a node type in the schema", () => {
    const editor = createEditor();
    expect(editor.schema.nodes.footnoteSection).toBeDefined();
    editor.destroy();
  });

  it("wraps footnoteContent nodes", () => {
    const editor = createEditor(
      '<p>Text<sup data-footnote-id="fn-1" data-footnote-label="1">[1]</sup></p>' +
        '<div class="footnotes"><div class="footnote-content" data-footnote-id="fn-1" data-footnote-label="1">Source</div></div>',
    );
    const html = editor.getHTML();
    expect(html).toContain('<div class="footnotes">');
    editor.destroy();
  });
});

describe("insertFootnote", () => {
  it("inserts a footnoteRef at the cursor position", () => {
    const editor = createEditor("<p>Hello world</p>");
    // Place cursor at the end of "Hello world"
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    const result = insertFootnote(editor, "Test Source");
    expect(result).toBe(true);

    const html = editor.getHTML();
    expect(html).toContain("footnote-ref");
    expect(html).toContain("data-footnote-id");
    editor.destroy();
  });

  it("creates a footnoteSection with the footnote content", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertFootnote(editor, "My Research Paper");

    const html = editor.getHTML();
    expect(html).toContain("footnotes");
    expect(html).toContain("My Research Paper");
    editor.destroy();
  });

  it("creates a horizontal rule before the footnote section", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertFootnote(editor, "Source A");

    const html = editor.getHTML();
    expect(html).toContain("<hr>");
    editor.destroy();
  });

  it("appends to existing footnote section on second insert", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertFootnote(editor, "Source A");
    // Move cursor back into the text area (before the hr)
    editor.commands.setTextSelection(6);
    insertFootnote(editor, "Source B");

    const html = editor.getHTML();
    expect(html).toContain("Source A");
    expect(html).toContain("Source B");

    // Should only have one footnotes section
    const footnoteSections = (html.match(/class="footnotes"/g) || []).length;
    expect(footnoteSections).toBe(1);

    editor.destroy();
  });

  it("returns false when editor is null-ish", () => {
    // Type assertion to test the null guard
    const result = insertFootnote(null as unknown as Editor, "Source");
    expect(result).toBe(false);
  });
});

describe("FootnotePlugin - auto-renumbering", () => {
  it("assigns label 1 to the first footnote", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertFootnote(editor, "Source A");

    const html = editor.getHTML();
    expect(html).toContain('data-footnote-label="1"');
    expect(html).toContain("[1]");
    editor.destroy();
  });

  it("assigns sequential labels to multiple footnotes", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertFootnote(editor, "Source A");
    // Move cursor back before the footnote ref
    editor.commands.setTextSelection(6);
    insertFootnote(editor, "Source B");

    const html = editor.getHTML();

    // Should have labels 1 and 2 for the refs
    const labelMatches = html.match(/data-footnote-label="(\d+)"/g) || [];
    // There are 2 refs + 2 contents = 4 label attributes
    expect(labelMatches.length).toBe(4);

    // Check that [1] and [2] appear in the ref text
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");

    editor.destroy();
  });
});

describe("FootnotePlugin - orphan cleanup", () => {
  it("removes footnoteContent when footnoteRef is deleted", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertFootnote(editor, "Source A");

    // Verify footnote exists
    let html = editor.getHTML();
    expect(html).toContain("Source A");
    expect(html).toContain("footnote-ref");

    // Find and delete the footnoteRef node
    let refPos: number | null = null;
    let refSize = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "footnoteRef" && refPos === null) {
        refPos = pos;
        refSize = node.nodeSize;
      }
    });

    expect(refPos).not.toBeNull();

    // Delete the ref node
    const { tr } = editor.state;
    tr.delete(refPos!, refPos! + refSize);
    editor.view.dispatch(tr);

    // After the plugin runs, the content should be cleaned up too
    html = editor.getHTML();
    expect(html).not.toContain("footnote-content");
    expect(html).not.toContain("Source A");

    editor.destroy();
  });

  it("removes footnoteRef when footnoteContent is deleted", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertFootnote(editor, "Source A");

    // Find and delete the footnoteContent node
    let contentPos: number | null = null;
    let contentSize = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "footnoteContent" && contentPos === null) {
        contentPos = pos;
        contentSize = node.nodeSize;
      }
    });

    expect(contentPos).not.toBeNull();

    // Delete the content node
    const { tr } = editor.state;
    tr.delete(contentPos!, contentPos! + contentSize);
    editor.view.dispatch(tr);

    // After the plugin runs, the ref should be cleaned up too
    const html = editor.getHTML();
    expect(html).not.toContain("footnote-ref");

    editor.destroy();
  });

  it("renumbers remaining footnotes after deletion", () => {
    const editor = createEditor("<p>Hello world</p>");

    // Insert 3 footnotes
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    insertFootnote(editor, "Source A");

    // Place cursor in the text, not in the footnote section
    editor.commands.setTextSelection(6);
    insertFootnote(editor, "Source B");

    editor.commands.setTextSelection(3);
    insertFootnote(editor, "Source C");

    // Verify we have 3 footnotes with labels 1, 2, 3
    let html = editor.getHTML();
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");
    expect(html).toContain("[3]");

    // Delete the first footnoteRef (the one appearing first in document order)
    let firstRefPos: number | null = null;
    let firstRefSize = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "footnoteRef" && firstRefPos === null) {
        firstRefPos = pos;
        firstRefSize = node.nodeSize;
      }
    });

    const { tr } = editor.state;
    tr.delete(firstRefPos!, firstRefPos! + firstRefSize);
    editor.view.dispatch(tr);

    // After deletion and renumbering, should have [1] and [2] (not [2] and [3])
    html = editor.getHTML();
    expect(html).toContain("[1]");
    expect(html).toContain("[2]");
    expect(html).not.toContain("[3]");

    editor.destroy();
  });
});

describe("HTML round-trip", () => {
  it("preserves footnotes through getHTML() and setContent()", () => {
    const editor1 = createEditor("<p>Hello world</p>");
    editor1.commands.setTextSelection(editor1.state.doc.content.size - 1);
    insertFootnote(editor1, "My Source Document");

    const savedHtml = editor1.getHTML();
    editor1.destroy();

    // Create a new editor with the saved HTML
    const editor2 = createEditor(savedHtml);
    const restoredHtml = editor2.getHTML();

    // The footnote data should survive the round-trip
    expect(restoredHtml).toContain("footnote-ref");
    expect(restoredHtml).toContain("footnote-content");
    expect(restoredHtml).toContain("My Source Document");
    expect(restoredHtml).toContain("data-footnote-id");
    expect(restoredHtml).toContain('data-footnote-label="1"');

    editor2.destroy();
  });

  it("preserves multiple footnotes through round-trip", () => {
    const editor1 = createEditor("<p>Hello world</p>");
    editor1.commands.setTextSelection(editor1.state.doc.content.size - 1);
    insertFootnote(editor1, "Source A");
    editor1.commands.setTextSelection(6);
    insertFootnote(editor1, "Source B");

    const savedHtml = editor1.getHTML();
    editor1.destroy();

    const editor2 = createEditor(savedHtml);
    const restoredHtml = editor2.getHTML();

    expect(restoredHtml).toContain("Source A");
    expect(restoredHtml).toContain("Source B");
    expect(restoredHtml).toContain("[1]");
    expect(restoredHtml).toContain("[2]");

    editor2.destroy();
  });

  it("produces clean HTML suitable for Google Docs import", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    insertFootnote(editor, "Research Paper Title");

    const html = editor.getHTML();

    // Verify the HTML structure is clean and standard
    expect(html).toContain("<sup");
    expect(html).toContain("<hr>");
    expect(html).toContain('<div class="footnotes">');
    expect(html).toContain('class="footnote-content"');
    // No ProseMirror-specific garbage
    expect(html).not.toContain("ProseMirror");
    expect(html).not.toContain("contenteditable");

    editor.destroy();
  });
});
