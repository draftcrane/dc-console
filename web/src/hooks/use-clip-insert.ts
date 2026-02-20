"use client";

import { useRef, useCallback, useEffect, useMemo } from "react";
import type { ChapterEditorHandle } from "@/components/editor/chapter-editor";
import { insertClipWithFootnote } from "@/extensions/footnote-commands";

/**
 * Result from calling insertClip().
 * - "inserted": blockquote + footnote inserted at stored cursor position
 * - "appended": no cursor stored, appended at end of chapter with fallback message
 * - "no-editor": no active editor (no chapter selected)
 */
export type InsertResult = "inserted" | "appended" | "no-editor";

export interface UseClipInsertOptions {
  /** Ref to the ChapterEditor's imperative handle */
  editorRef: React.RefObject<ChapterEditorHandle | null>;
  /** Active chapter ID (null = no chapter selected) */
  activeChapterId: string | null | undefined;
}

export interface UseClipInsertReturn {
  /** Whether insert is available (editor exists and chapter is selected) */
  canInsert: boolean;
  /**
   * Insert a clip into the editor as a blockquote with an auto-created footnote.
   * Uses the last stored cursor position, or appends to end if none stored.
   *
   * @param text - The clip/snippet text to insert as a blockquote
   * @param sourceTitle - The source title for the footnote reference
   * @returns InsertResult indicating what happened
   */
  insertClip: (text: string, sourceTitle: string) => InsertResult;
  /**
   * Call this to track the editor's selection whenever it changes.
   * Should be called from the editor's onSelectionUpdate or onTransaction callback.
   */
  trackSelection: () => void;
}

/**
 * Hook that manages clip insertion into the Tiptap editor.
 *
 * Tracks the editor's cursor position via lastSelectionRef so that when the
 * Research Panel has focus, we know where to insert. Uses requestAnimationFrame
 * on editor.commands.focus() to prevent iPad viewport jumping.
 *
 * The insertion is a single ProseMirror transaction: blockquote + footnoteRef
 * in the text, footnoteContent appended to the footnote section. This ensures
 * Cmd+Z undoes the entire operation atomically.
 *
 * Per design-spec.md Flow 6 (Insert a Snippet) and Decision 9 (blockquote + footnote).
 */
export function useClipInsert({
  editorRef,
  activeChapterId,
}: UseClipInsertOptions): UseClipInsertReturn {
  // Track last known cursor position (ProseMirror document position).
  // This is updated whenever the editor selection changes, even when the
  // Research Panel subsequently takes focus.
  const lastSelectionRef = useRef<number | null>(null);

  const canInsert = !!activeChapterId;

  // Reset stored position when chapter changes
  useEffect(() => {
    lastSelectionRef.current = null;
  }, [activeChapterId]);

  const trackSelection = useCallback(() => {
    const editor = editorRef.current?.getEditor();
    if (!editor) return;
    const { from } = editor.state.selection;
    lastSelectionRef.current = from;
  }, [editorRef]);

  const insertClip = useCallback(
    (text: string, sourceTitle: string): InsertResult => {
      const editor = editorRef.current?.getEditor();
      if (!editor || !activeChapterId) return "no-editor";

      const storedPos = lastSelectionRef.current;

      // Use requestAnimationFrame to prevent iPad viewport jumping (#200 AC)
      // Focus the editor first, then perform the insertion
      requestAnimationFrame(() => {
        if (storedPos !== null) {
          // Restore cursor to stored position
          editor.commands.focus(null, { scrollIntoView: false });
          const maxPos = editor.state.doc.content.size;
          const safePos = Math.min(storedPos, maxPos);
          editor.commands.setTextSelection(safePos);
        } else {
          // No stored position -- move to end of document content.
          // We need to find the end of the "body" content (before any
          // footnoteSection / HR).
          editor.commands.focus("end", { scrollIntoView: false });
        }

        // Perform the insertion as a single transaction
        insertClipWithFootnote(editor, text, sourceTitle);

        // Scroll into view after insertion
        requestAnimationFrame(() => {
          editor.commands.scrollIntoView();
        });
      });

      return storedPos !== null ? "inserted" : "appended";
    },
    [editorRef, activeChapterId],
  );

  return useMemo(
    () => ({ canInsert, insertClip, trackSelection }),
    [canInsert, insertClip, trackSelection],
  );
}
