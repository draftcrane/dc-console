import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";

/**
 * Generates a unique footnote ID for linking footnoteRef and footnoteContent.
 * Uses a compact random string to avoid collisions.
 */
function generateFootnoteId(): string {
  return `fn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Find the position and node of the footnoteSection in the document, if any.
 */
function findFootnoteSection(doc: ProseMirrorNode): { pos: number; node: ProseMirrorNode } | null {
  let result: { pos: number; node: ProseMirrorNode } | null = null;
  doc.forEach((node, offset) => {
    if (node.type.name === "footnoteSection") {
      result = { pos: offset, node };
    }
  });
  return result;
}

/**
 * Insert a footnote into the editor.
 *
 * This is the primary API for creating footnotes. It:
 * 1. Inserts a footnoteRef (superscript [N]) at the current cursor position
 * 2. Appends a footnoteContent entry to the footnoteSection at the bottom
 * 3. Creates the footnoteSection (with <hr> separator) if it doesn't exist
 *
 * The footnoteRef and footnoteContent share a `footnoteId` for linking.
 * The FootnotePlugin auto-assigns sequential labels after the transaction.
 *
 * Per design-spec.md Flow 6: "Text inserted at cursor. Footnote auto-created."
 * Per design-spec.md Decision 9: blockquote + footnote insertion format.
 *
 * @param editor - The Tiptap editor instance
 * @param sourceTitle - The source document title for the footnote content
 * @returns true if the footnote was successfully inserted
 */
export function insertFootnote(editor: Editor, sourceTitle: string): boolean {
  if (!editor) return false;

  const footnoteId = generateFootnoteId();
  const { doc, schema } = editor.state;

  // Check if a footnoteSection already exists
  const existingSection = findFootnoteSection(doc);

  // Build the transaction as a single chain for undo/redo atomicity
  const { tr } = editor.state;

  // Step 1: Insert the footnoteRef at the current selection
  const refNodePM = schema.nodes.footnoteRef.create({
    footnoteId,
    label: "0",
  });
  tr.insert(tr.selection.from, refNodePM);

  // Step 2: Add the footnoteContent to the section
  const contentNodePM = schema.nodes.footnoteContent.create(
    { footnoteId, label: "0" },
    schema.text(sourceTitle),
  );

  if (existingSection) {
    // Append the new footnoteContent inside the existing footnoteSection.
    // The section end position is: sectionPos + sectionNodeSize - 1
    // (just before the section's closing boundary)
    const sectionEndPos = existingSection.pos + existingSection.node.nodeSize - 1;
    const mappedEnd = tr.mapping.map(sectionEndPos);
    tr.insert(mappedEnd, contentNodePM);
  } else {
    // Create a new footnoteSection at the end of the document.
    // Build an HR + footnoteSection and insert them as adjacent blocks
    // at the end of the document's content.
    const sectionNodePM = schema.nodes.footnoteSection.create(null, contentNodePM);
    const hrNode = schema.nodes.horizontalRule.create();

    // doc.content.size is the position just before the doc's closing tag.
    // In ProseMirror, content position inside the top-level doc ranges from 0 to doc.content.size.
    // The actual doc position to insert at is doc.content.size (the end of the doc node's content).
    const insertPos = tr.mapping.map(doc.content.size);
    // Use replaceWith to place nodes at the end of the document content
    tr.insert(insertPos, Fragment.from([hrNode, sectionNodePM]));
  }

  // Dispatch as a single transaction for atomic undo/redo
  editor.view.dispatch(tr);

  return true;
}
