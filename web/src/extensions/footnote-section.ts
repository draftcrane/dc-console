import { Node, mergeAttributes } from "@tiptap/core";

/**
 * FootnoteSection - Block wrapper node that contains all FootnoteContent nodes.
 *
 * Rendered at the bottom of the chapter content, separated by a horizontal rule.
 * The section is a single container node holding one or more footnoteContent children.
 *
 * HTML output: `<hr class="footnotes-separator"><div class="footnotes">...</div>`
 *
 * This ensures clean HTML serialization for Google Drive write-through, and
 * groups all footnotes visually at the bottom of the chapter.
 */
export const FootnoteSection = Node.create({
  name: "footnoteSection",

  group: "block",
  content: "footnoteContent+",

  // The footnote section is not directly editable as a whole - users edit
  // individual footnoteContent nodes within it.
  draggable: false,
  defining: true,
  isolating: false,

  parseHTML() {
    return [
      {
        tag: "div.footnotes",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "footnotes" }), 0];
  },
});
