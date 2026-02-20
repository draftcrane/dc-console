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
 * Renders as: `<div class="footnote-content" data-footnote-id="...">
 *               <span class="footnote-label">[N]</span>
 *               <div class="footnote-body">Source Title</div>
 *             </div>`
 *
 * Serializes to HTML with data attributes for round-trip deserialization.
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
        // New structure: content lives inside .footnote-body
        tag: "div.footnote-content[data-footnote-id]",
        contentElement: (element: HTMLElement): HTMLElement => {
          const body = element.querySelector(".footnote-body") as HTMLElement | null;
          // Fall back to the element itself for legacy HTML without .footnote-body wrapper
          return body || element;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = (node.attrs.label as string) || "0";
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "footnote-content" }),
      ["span", { class: "footnote-label" }, `[${label}]`],
      ["div", { class: "footnote-body" }, 0],
    ];
  },
});
