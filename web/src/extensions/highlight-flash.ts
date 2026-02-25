import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const HIGHLIGHT_DURATION_MS = 1500;

const highlightFlashKey = new PluginKey("highlightFlash");

interface HighlightFlashStorage {
  from: number;
  to: number;
  startTime: number;
}

// Shared storage reference for the plugin
let sharedStorage: { activeHighlight: HighlightFlashStorage | null } | null = null;

/**
 * HighlightFlash - Temporary inline decoration for AI rewrite feedback.
 *
 * Creates a short-lived highlight on a text range to provide visual feedback
 * when AI rewrite is accepted. The highlight fades out using CSS animation.
 *
 * Usage:
 *   editor.commands.flashHighlight({ from, to })
 *
 * The decoration auto-removes after 1.5s. Respects prefers-reduced-motion
 * via CSS (animation disabled in editor.css).
 */
export const HighlightFlash = Extension.create({
  name: "highlightFlash",

  addStorage() {
    const storage = {
      activeHighlight: null as HighlightFlashStorage | null,
    };
    sharedStorage = storage;
    return storage;
  },

  addCommands() {
    return {
      flashHighlight:
        ({ from, to }: { from: number; to: number }) =>
        ({ editor, tr }) => {
          // Store the highlight range
          const startTime = Date.now();
          this.storage.activeHighlight = {
            from,
            to,
            startTime,
          };

          // Force a view update by dispatching a transaction
          editor.view.dispatch(tr);

          // Schedule removal after animation duration
          setTimeout(() => {
            if (this.storage.activeHighlight?.startTime === startTime) {
              this.storage.activeHighlight = null;
              // Force another update to remove the decoration
              if (editor.view && !editor.isDestroyed) {
                editor.view.dispatch(editor.state.tr);
              }
            }
          }, HIGHLIGHT_DURATION_MS);

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: highlightFlashKey,

        props: {
          decorations(state) {
            const highlight = sharedStorage?.activeHighlight;
            if (!highlight) return DecorationSet.empty;

            // Validate range is within document bounds
            const docSize = state.doc.content.size;
            const from = Math.max(0, Math.min(highlight.from, docSize));
            const to = Math.max(from, Math.min(highlight.to, docSize));

            if (from >= to) return DecorationSet.empty;

            const decoration = Decoration.inline(from, to, {
              class: "ai-rewrite-highlight",
            });

            return DecorationSet.create(state.doc, [decoration]);
          },
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlightFlash: {
      /**
       * Flash a temporary highlight on a text range.
       * Used for AI rewrite accept feedback.
       */
      flashHighlight: (options: { from: number; to: number }) => ReturnType;
    };
  }
}
