import { Node, mergeAttributes } from "@tiptap/core";

/**
 * FootnoteContent - Block node for individual footnote entries rendered at the
 * bottom of the chapter.
 *
 * Each FootnoteContent is linked to a FootnoteRef via the shared `footnoteId`.
 * The `label` is computed by the FootnotePlugin for sequential numbering.
 *
 * Format: "[N] Source Title" per design-spec.md Principle 4.
 *
 * Renders as: `<div class="footnote-content" data-footnote-id="..." data-footnote-label="N">
 *               Source Title
 *             </div>`
 *
 * The label prefix "[N]" is displayed via CSS `::before` using the data-footnote-label
 * attribute. ProseMirror requires the content hole to be the sole child of its parent,
 * so the label cannot be rendered as a sibling DOM element in renderHTML.
 */
export const FootnoteContent = Node.create({
  name: "footnoteContent",

  group: "block",
  content: "inline*",

  // Not draggable, not isolating - allow normal text editing within
  draggable: false,
  defining: true,

  addAttributes() {
    return {
      footnoteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-footnote-id"),
        renderHTML: (attributes) => ({
          "data-footnote-id": attributes.footnoteId as string,
        }),
      },
      label: {
        default: "0",
        parseHTML: (element) => element.getAttribute("data-footnote-label") || "0",
        renderHTML: (attributes) => ({
          "data-footnote-label": attributes.label as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.footnote-content[data-footnote-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // The label is stored as data-footnote-label and rendered via CSS ::before.
    // ProseMirror requires the content hole (0) to be the sole child of its parent,
    // so we cannot place a sibling <span> alongside it here.
    return ["div", mergeAttributes(HTMLAttributes, { class: "footnote-content" }), 0];
  },
});
