import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/**
 * Scans a ProseMirror document and collects all footnoteRef nodes in
 * document order. Returns an array of { footnoteId, pos } objects.
 */
function collectFootnoteRefs(doc: ProseMirrorNode): Array<{ footnoteId: string; pos: number }> {
  const refs: Array<{ footnoteId: string; pos: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "footnoteRef") {
      const id = node.attrs.footnoteId as string;
      if (id) {
        refs.push({ footnoteId: id, pos });
      }
    }
  });
  return refs;
}

/**
 * Scans a ProseMirror document and collects all footnoteContent nodes.
 * Includes nodes even if footnoteId is null/empty (for cleanup purposes).
 */
function collectFootnoteContents(
  doc: ProseMirrorNode,
): Array<{ footnoteId: string | null; pos: number; nodeSize: number }> {
  const contents: Array<{ footnoteId: string | null; pos: number; nodeSize: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "footnoteContent") {
      contents.push({
        footnoteId: (node.attrs.footnoteId as string) || null,
        pos,
        nodeSize: node.nodeSize,
      });
    }
  });
  return contents;
}

/**
 * Find the footnoteSection and the preceding HR in the given document.
 * Uses doc.forEach which gives offsets within the doc's content.
 * For the top-level doc node, these offsets ARE document positions.
 */
function findSectionAndHr(doc: ProseMirrorNode): {
  sectionPos: number;
  sectionSize: number;
  hrPos: number | null;
  hrSize: number;
} | null {
  let sectionPos: number | null = null;
  let sectionSize = 0;
  let hrPos: number | null = null;
  let hrSize = 0;
  let prevPos: number | null = null;
  let prevSize = 0;
  let prevType: string | null = null;

  doc.forEach((node, offset) => {
    if (node.type.name === "footnoteSection") {
      sectionPos = offset;
      sectionSize = node.nodeSize;
      if (prevType === "horizontalRule") {
        hrPos = prevPos;
        hrSize = prevSize;
      }
    }
    prevPos = offset;
    prevSize = node.nodeSize;
    prevType = node.type.name;
  });

  if (sectionPos === null) return null;
  return { sectionPos, sectionSize, hrPos, hrSize };
}

/**
 * Remove the entire footnote section and its preceding HR from the document.
 * Operates on tr.doc to get fresh positions.
 * Deletes HR first (earlier in doc), then section (with position mapping).
 */
function removeEntireSection(tr: Transaction): boolean {
  const info = findSectionAndHr(tr.doc);
  if (!info) return false;

  if (info.hrPos !== null) {
    // Delete the HR first (earlier in the doc)
    tr.delete(info.hrPos, info.hrPos + info.hrSize);
    // Now delete the section (positions shifted after HR deletion, use mapping)
    const mappedSectionPos = tr.mapping.map(info.sectionPos);
    const sectionNode = tr.doc.nodeAt(mappedSectionPos);
    if (sectionNode && sectionNode.type.name === "footnoteSection") {
      tr.delete(mappedSectionPos, mappedSectionPos + sectionNode.nodeSize);
    }
  } else {
    // No HR, just delete the section
    tr.delete(info.sectionPos, info.sectionPos + info.sectionSize);
  }

  return true;
}

const footnotePluginKey = new PluginKey("footnotePlugin");

/**
 * Renumber all footnoteRef and footnoteContent nodes to be sequential
 * based on the order of refs in the document. Returns true if any labels changed.
 */
function renumberFootnotes(tr: Transaction): boolean {
  const refs = collectFootnoteRefs(tr.doc);
  if (refs.length === 0) return false;

  const labelMap = new Map<string, string>();
  refs.forEach((ref, idx) => {
    labelMap.set(ref.footnoteId, String(idx + 1));
  });

  let modified = false;

  for (const ref of refs) {
    const node = tr.doc.nodeAt(ref.pos);
    if (node && node.type.name === "footnoteRef") {
      const expectedLabel = labelMap.get(ref.footnoteId);
      if (expectedLabel && node.attrs.label !== expectedLabel) {
        tr.setNodeMarkup(ref.pos, undefined, {
          ...node.attrs,
          label: expectedLabel,
        });
        modified = true;
      }
    }
  }

  const contents = collectFootnoteContents(tr.doc);
  for (const content of contents) {
    if (!content.footnoteId) continue;
    const node = tr.doc.nodeAt(content.pos);
    if (node && node.type.name === "footnoteContent") {
      const expectedLabel = labelMap.get(content.footnoteId);
      if (expectedLabel && node.attrs.label !== expectedLabel) {
        tr.setNodeMarkup(content.pos, undefined, {
          ...node.attrs,
          label: expectedLabel,
        });
        modified = true;
      }
    }
  }

  return modified;
}

/**
 * FootnotePlugin - ProseMirror plugin that manages footnote consistency:
 *
 * 1. **Auto-renumbering:** After any transaction, recomputes sequential labels
 *    for all footnoteRef and footnoteContent nodes based on document order.
 *
 * 2. **Orphan cleanup:** If a footnoteRef is deleted, removes the corresponding
 *    footnoteContent (and vice versa). Also removes the footnoteSection wrapper
 *    and its preceding HR if all footnotes are gone.
 *
 * This ensures:
 * - Footnotes are always numbered 1, 2, 3, ... in document order
 * - Deleting a footnote reference removes its content entry
 * - Deleting a footnote content entry removes its reference
 * - Undo/redo removes both footnoteRef and footnoteContent together
 *   because the cleanup appends to the same transaction
 */
export const FootnotePlugin = Extension.create({
  name: "footnotePlugin",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: footnotePluginKey,

        appendTransaction(_transactions, _oldState, newState) {
          const { doc, tr } = newState;

          const refs = collectFootnoteRefs(doc);
          const contents = collectFootnoteContents(doc);

          // Build set of ref IDs for detecting orphaned content
          const refIds = new Set(refs.map((r) => r.footnoteId));
          // Build set of content IDs (only those with valid IDs)
          const contentIds = new Set(
            contents.filter((c) => c.footnoteId).map((c) => c.footnoteId!),
          );

          // Detect orphans
          const orphanedRefs = refs.filter((r) => !contentIds.has(r.footnoteId));
          const hasOrphanedContents = contents.some(
            (c) => !c.footnoteId || !refIds.has(c.footnoteId),
          );
          const hasOrphans = orphanedRefs.length > 0 || hasOrphanedContents;

          if (!hasOrphans) {
            // No orphans - just check renumbering
            return renumberFootnotes(tr) ? tr : null;
          }

          let modified = false;

          // Count how many valid footnotes will survive cleanup
          const survivingContentCount = contents.filter(
            (c) => c.footnoteId && refIds.has(c.footnoteId),
          ).length;

          if (survivingContentCount === 0 && contents.length > 0) {
            // All footnote contents are orphaned -- remove the entire section + HR
            modified = removeEntireSection(tr);
            // Also remove any orphaned refs
            const remainingRefs = collectFootnoteRefs(tr.doc);
            for (let i = remainingRefs.length - 1; i >= 0; i--) {
              const ref = remainingRefs[i];
              const node = tr.doc.nodeAt(ref.pos);
              if (node && node.type.name === "footnoteRef") {
                tr.delete(ref.pos, ref.pos + node.nodeSize);
                modified = true;
              }
            }
          } else {
            // Remove individual orphaned content nodes (reverse order)
            const orphanedContents = contents.filter(
              (c) => !c.footnoteId || !refIds.has(c.footnoteId),
            );
            for (let i = orphanedContents.length - 1; i >= 0; i--) {
              const orphan = orphanedContents[i];
              tr.delete(orphan.pos, orphan.pos + orphan.nodeSize);
              modified = true;
            }

            // Remove orphaned refs after content cleanup (re-read positions)
            const currentRefs = collectFootnoteRefs(tr.doc);
            const currentContentIds = new Set(
              collectFootnoteContents(tr.doc)
                .filter((c) => c.footnoteId)
                .map((c) => c.footnoteId!),
            );
            for (let i = currentRefs.length - 1; i >= 0; i--) {
              const ref = currentRefs[i];
              if (!currentContentIds.has(ref.footnoteId)) {
                const node = tr.doc.nodeAt(ref.pos);
                if (node && node.type.name === "footnoteRef") {
                  tr.delete(ref.pos, ref.pos + node.nodeSize);
                  modified = true;
                }
              }
            }
          }

          // Renumber surviving footnotes
          if (renumberFootnotes(tr)) {
            modified = true;
          }

          return modified ? tr : null;
        },
      }),
    ];
  },
});
