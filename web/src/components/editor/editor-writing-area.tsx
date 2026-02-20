"use client";

import type { RefObject } from "react";
import type { Chapter } from "@/types/editor";
import { ChapterEditor, type ChapterEditorHandle } from "./chapter-editor";

interface EditorWritingAreaProps {
  editorRef: RefObject<ChapterEditorHandle | null>;
  currentContent: string;
  onContentChange: (html: string) => void;
  onSelectionWordCountChange: (count: number) => void;

  // Title editing
  activeChapter: Chapter | undefined;
  editingTitle: boolean;
  titleValue: string;
  onTitleValueChange: (value: string) => void;
  onTitleEdit: () => void;
  onTitleSave: () => void;
  onTitleEditCancel: () => void;

  // Word count display
  currentWordCount: number;
  selectionWordCount: number;

  /** Callback when cursor/selection changes in the editor (#200) */
  onSelectionUpdate?: () => void;
}

/**
 * EditorWritingArea - The main writing surface.
 *
 * Contains the editable chapter title, the Tiptap rich text editor,
 * and the word count display.
 *
 * Per PRD Section 9: clean writing area with editable chapter title.
 * Per US-011: content width constrained to ~680-720px.
 */
export function EditorWritingArea({
  editorRef,
  currentContent,
  onContentChange,
  onSelectionWordCountChange,
  activeChapter,
  editingTitle,
  titleValue,
  onTitleValueChange,
  onTitleEdit,
  onTitleSave,
  onTitleEditCancel,
  currentWordCount,
  selectionWordCount,
  onSelectionUpdate,
}: EditorWritingAreaProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[700px] mx-auto px-6 py-8">
        {/* Chapter title - editable at top of editor (US-011) */}
        {editingTitle ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => onTitleValueChange(e.target.value)}
            onBlur={onTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") onTitleSave();
              if (e.key === "Escape") onTitleEditCancel();
            }}
            className="text-3xl font-semibold text-foreground mb-6 outline-none w-full
                       border-b-2 border-blue-500 bg-transparent"
            autoFocus
            maxLength={200}
          />
        ) : (
          <h1
            className="text-3xl font-semibold text-foreground mb-6 outline-none cursor-text
                       hover:bg-gray-50 focus:bg-gray-50 focus:ring-2 focus:ring-blue-500
                       rounded px-1 -mx-1 transition-colors"
            onClick={onTitleEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTitleEdit();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Edit chapter title: ${activeChapter?.title || "Untitled Chapter"}`}
            title="Click to edit title"
          >
            {activeChapter?.title || "Untitled Chapter"}
          </h1>
        )}

        <ChapterEditor
          ref={editorRef}
          content={currentContent}
          onUpdate={onContentChange}
          onSelectionWordCountChange={onSelectionWordCountChange}
          onSelectionUpdate={onSelectionUpdate}
        />

        <div className="mt-4 flex items-center justify-end">
          <span className="text-sm text-muted-foreground tabular-nums">
            {selectionWordCount > 0
              ? `${selectionWordCount.toLocaleString()} / ${currentWordCount.toLocaleString()} words`
              : `${currentWordCount.toLocaleString()} words`}
          </span>
        </div>
      </div>
    </div>
  );
}
