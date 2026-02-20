import { Node, mergeAttributes } from "@tiptap/core";

/**
 * FootnoteRef - Inline node for superscript footnote references in text.
 *
 * Renders as `<sup class="footnote-ref" data-footnote-id="...">N</sup>` in the editor.
 * Serializes to `<sup data-footnote-id="..." data-footnote-label="N">[N]</sup>` for HTML output.
 *
 * Each FootnoteRef has a unique `footnoteId` linking it to its corresponding
 * FootnoteContent node. The `label` is computed by the FootnotePlugin and
 * represents the sequential footnote number within the chapter.
 *
 * Per design-spec.md Decision 9: blockquote + footnote insertion format.
 */
export const FootnoteRef = Node.create({
  name: "footnoteRef",

  group: "inline",
  inline: true,
  atom: true,

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
        tag: "sup[data-footnote-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const label = (HTMLAttributes["data-footnote-label"] as string) || "0";
    return ["sup", mergeAttributes(HTMLAttributes, { class: "footnote-ref" }), `[${label}]`];
  },
});
