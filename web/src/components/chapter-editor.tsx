"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import { useTextSelection } from "@/hooks/use-text-selection";

/** Handle exposed by ChapterEditor for programmatic operations */
export interface ChapterEditorHandle {
  /** Get the Tiptap editor instance */
  getEditor: () => Editor | null;
  /**
   * Replace a text range with new content.
   * Uses the Tiptap transaction system so Cmd+Z undo is supported.
   * Returns true if the replacement was applied.
   */
  replaceText: (searchText: string, replacementText: string) => boolean;
}

interface ChapterEditorProps {
  /** Initial content (HTML string) */
  content?: string;
  /** Callback when content changes */
  onUpdate?: (html: string) => void;
  /** Callback for Cmd+S save shortcut */
  onSave?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether editor is editable */
  editable?: boolean;
  /** Callback when editor instance is ready */
  onEditorReady?: (editor: Editor) => void;
  /** Callback when selection word count changes (0 when no selection) */
  onSelectionWordCountChange?: (selectionWordCount: number) => void;
}

/**
 * ChapterEditor - Tiptap-based rich text editor for chapter content
 *
 * Per PRD US-011:
 * - Formatting: Bold, Italic, H2, H3, Bulleted list, Numbered list, Block quote
 * - 18px base font, max width ~680-720px (CSS pixels, equivalent to pt on iPad)
 * - Keyboard shortcuts: Cmd+B, Cmd+I, Cmd+Z, Cmd+Shift+Z, Cmd+S
 * - Placeholder: "Start writing, or paste your existing notes here..."
 * - Paste from Google Docs preserves supported formatting
 * - Unsupported formatting silently stripped on paste
 * - Input latency under 100ms on iPad Safari
 * - Works with virtual keyboard (cursor visible via visualViewport API)
 *
 * Per ADR-001: Tiptap selected for iPad Safari reliability.
 * Styles are in globals.css under .chapter-editor-content.
 * Ref: Exposes ChapterEditorHandle for programmatic operations (e.g., AI rewrite text replacement)
 */
export const ChapterEditor = forwardRef<ChapterEditorHandle, ChapterEditorProps>(
  function ChapterEditor(
    {
      content = "",
      onUpdate,
      onSave,
      placeholder = "Start writing, or paste your existing notes here...",
      editable = true,
      onEditorReady,
      onSelectionWordCountChange,
    },
    ref,
  ) {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [2, 3],
          },
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass: "is-editor-empty",
        }),
      ],
      content,
      editable,
      editorProps: {
        attributes: {
          class: "chapter-editor-content outline-none",
        },
        handlePaste: (_view, event) => {
          const html = event.clipboardData?.getData("text/html");
          if (html?.includes("docs-internal-guid")) {
            return false;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        onUpdate?.(ed.getHTML());
      },
    });

    // Track text selection for floating action bar (200ms delay per US-016)
    const textSelection = useTextSelection(editor, editorContainerRef, 200);

    // Notify parent of selection word count changes (US-024)
    useEffect(() => {
      onSelectionWordCountChange?.(textSelection.wordCount);
    }, [textSelection.wordCount, onSelectionWordCountChange]);

    // Notify parent when editor is ready
    useEffect(() => {
      if (editor && onEditorReady) {
        onEditorReady(editor);
      }
    }, [editor, onEditorReady]);

    // Handle Cmd+S for save
    useEffect(() => {
      if (!editor || !onSave) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          onSave();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [editor, onSave]);

    // Virtual keyboard handling for iPad Safari
    useEffect(() => {
      if (typeof window === "undefined" || !window.visualViewport) return;

      const viewport = window.visualViewport;
      const handleResize = () => {
        const keyboardHeight = window.innerHeight - viewport.height;
        document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
      };

      viewport.addEventListener("resize", handleResize);
      viewport.addEventListener("scroll", handleResize);

      return () => {
        viewport.removeEventListener("resize", handleResize);
        viewport.removeEventListener("scroll", handleResize);
      };
    }, []);

    // Expose imperative handle for programmatic operations (AI rewrite text replacement)
    useImperativeHandle(
      ref,
      () => ({
        getEditor: () => editor,
        replaceText: (searchText: string, replacementText: string): boolean => {
          if (!editor) return false;

          const { doc } = editor.state;
          let found = false;

          doc.descendants((node, pos) => {
            if (found) return false;
            if (!node.isText || !node.text) return;

            const index = node.text.indexOf(searchText);
            if (index !== -1) {
              const from = pos + index;
              const to = from + searchText.length;

              editor
                .chain()
                .focus()
                .setTextSelection({ from, to })
                .deleteSelection()
                .insertContent(replacementText)
                .run();

              requestAnimationFrame(() => {
                const editorElement = editor.view.dom;
                const { from: cursorPos } = editor.state.selection;
                const highlightFrom = cursorPos - replacementText.length;

                editor.chain().setTextSelection({ from: highlightFrom, to: cursorPos }).run();

                editorElement.classList.add("ai-rewrite-highlight");
                setTimeout(() => {
                  editorElement.classList.remove("ai-rewrite-highlight");
                  editor.chain().setTextSelection(cursorPos).run();
                }, 1500);
              });

              found = true;
              return false;
            }
          });

          return found;
        },
      }),
      [editor],
    );

    if (!editor) {
      return <div className="min-h-[400px] animate-pulse bg-gray-100 rounded-lg" />;
    }

    return (
      <div className="chapter-editor relative" ref={editorContainerRef}>
        <EditorToolbar editor={editor} />

        <EditorContent
          editor={editor}
          className="prose prose-lg max-w-none
                     [&_.chapter-editor-content]:min-h-[400px]
                     [&_.chapter-editor-content]:text-lg
                     [&_.chapter-editor-content]:leading-relaxed
                     [&_.is-editor-empty]:before:content-[attr(data-placeholder)]
                     [&_.is-editor-empty]:before:text-gray-400
                     [&_.is-editor-empty]:before:float-left
                     [&_.is-editor-empty]:before:pointer-events-none
                     [&_.is-editor-empty]:before:h-0"
        />

      </div>
    );
  },
);

function EditorToolbar({ editor }: { editor: Editor }) {
  const buttonClass = useCallback(
    (isActive: boolean) =>
      `p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center
       ${isActive ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-600"}`,
    [],
  );

  return (
    <div
      className="flex flex-wrap items-center gap-1 p-2 mb-4 border border-gray-200 rounded-lg bg-white sticky top-0 z-10"
      role="toolbar"
      aria-label="Formatting toolbar"
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={buttonClass(editor.isActive("bold"))}
        title="Bold (Cmd+B)"
        aria-label="Bold"
        aria-pressed={editor.isActive("bold")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
          />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={buttonClass(editor.isActive("italic"))}
        title="Italic (Cmd+I)"
        aria-label="Italic"
        aria-pressed={editor.isActive("italic")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="14" y1="4" x2="10" y2="20" strokeWidth={2} />
          <line x1="10" y1="4" x2="18" y2="4" strokeWidth={2} />
          <line x1="6" y1="20" x2="14" y2="20" strokeWidth={2} />
        </svg>
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" aria-hidden="true" />
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={buttonClass(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
        aria-label="Heading 2"
        aria-pressed={editor.isActive("heading", { level: 2 })}
      >
        <span className="font-semibold text-sm">H2</span>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={buttonClass(editor.isActive("heading", { level: 3 }))}
        title="Heading 3"
        aria-label="Heading 3"
        aria-pressed={editor.isActive("heading", { level: 3 })}
      >
        <span className="font-semibold text-sm">H3</span>
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" aria-hidden="true" />
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={buttonClass(editor.isActive("bulletList"))}
        title="Bullet List"
        aria-label="Bullet List"
        aria-pressed={editor.isActive("bulletList")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 6h13M8 12h13M8 18h13"
          />
          <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={buttonClass(editor.isActive("orderedList"))}
        title="Numbered List"
        aria-label="Numbered List"
        aria-pressed={editor.isActive("orderedList")}
      >
        <svg className="w-5 h-5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            fill="none"
            d="M10 6h11M10 12h11M10 18h11"
          />
          <text x="2" y="8" fontSize="8" fontWeight="bold" stroke="none" fill="currentColor">
            1
          </text>
          <text x="2" y="14" fontSize="8" fontWeight="bold" stroke="none" fill="currentColor">
            2
          </text>
          <text x="2" y="20" fontSize="8" fontWeight="bold" stroke="none" fill="currentColor">
            3
          </text>
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={buttonClass(editor.isActive("blockquote"))}
        title="Block Quote"
        aria-label="Block Quote"
        aria-pressed={editor.isActive("blockquote")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 6h4l2 4v8H3V10l2-4zm12 0h4l2 4v8h-6V10l2-4z"
          />
        </svg>
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" aria-hidden="true" />
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`${buttonClass(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
        title="Undo (Cmd+Z)"
        aria-label="Undo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`${buttonClass(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
        title="Redo (Cmd+Shift+Z)"
        aria-label="Redo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
          />
        </svg>
      </button>
    </div>
  );
}

export default ChapterEditor;
export type { ChapterEditorProps };
