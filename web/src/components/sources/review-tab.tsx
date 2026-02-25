"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { EmptyState } from "./empty-state";
import { useToast } from "@/components/toast";
import type { SourceContentResult } from "@/hooks/use-sources";

interface SourceDetailViewProps {
  /** Called when user taps back to return to the source list */
  onBack: () => void;
}

/**
 * SourceDetailView - View full parsed source content, select text, insert into chapter.
 *
 * Rendered inline in the Library tab's "detail" mode (source content viewer).
 *
 * Insert behavior:
 * 1. Insert at cursor position if one exists in the editor
 * 2. If no cursor, append to end of chapter
 * 3. Show toast confirmation
 * 4. On portrait (overlay), close panel after insertion
 */
export function SourceDetailView({ onBack }: SourceDetailViewProps) {
  const { selectedSourceId, sources, getContent, editorRef, closePanel, isPanelOpen } =
    useSourcesContext();

  const { showToast } = useToast();
  const [content, setContent] = useState<SourceContentResult | null>(null);
  const [isLoading, setIsLoading] = useState(!!selectedSourceId);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const source = sources.find((s) => s.id === selectedSourceId);

  // Adjust loading/content state when source changes (React render-phase pattern)
  const [prevSourceId, setPrevSourceId] = useState(selectedSourceId);
  if (selectedSourceId !== prevSourceId) {
    setPrevSourceId(selectedSourceId);
    if (!selectedSourceId) {
      setContent(null);
      setIsLoading(false);
      setError(null);
    } else {
      setIsLoading(true);
      setError(null);
    }
  }

  // Fetch content when source changes
  useEffect(() => {
    if (!selectedSourceId) return;

    let cancelled = false;

    getContent(selectedSourceId)
      .then((result) => {
        if (!cancelled) {
          setContent(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load content");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSourceId, getContent]);

  // Listen for text selection (selectionchange is more reliable on iPad than mouseup)
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectedText("");
        return;
      }

      // Only track selection within our content area
      if (contentRef.current && contentRef.current.contains(selection.anchorNode)) {
        setSelectedText(selection.toString());
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const insertContent = useCallback(
    (html: string) => {
      const editor = editorRef.current?.getEditor();
      if (!editor) return;

      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      const hasCursor = from === to && from > 0;

      if (hasCursor || hasSelection) {
        // Insert at cursor/replace selection
        editor.chain().focus().insertContent(html).run();
        showToast("Inserted at cursor");
      } else {
        // Append to end
        editor.chain().focus("end").insertContent(html).run();
        showToast("Added to end of chapter");
      }

      // On portrait (overlay), close panel so user sees result
      const isPortrait = window.matchMedia("(max-width: 1023px)").matches;
      if (isPortrait && isPanelOpen) {
        closePanel();
      }
    },
    [editorRef, showToast, isPanelOpen, closePanel],
  );

  const handleInsertSelected = useCallback(() => {
    if (!selectedText) return;
    insertContent(`<p>${selectedText}</p>`);
    // Clear selection
    document.getSelection()?.removeAllRanges();
    setSelectedText("");
  }, [selectedText, insertContent]);

  const handleInsertAll = useCallback(() => {
    if (!content?.content) return;
    insertContent(content.content);
  }, [content, insertContent]);

  // Empty state: no source selected
  if (!selectedSourceId || !source) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        }
        message="Select a source to view its content"
        action={{
          label: "Back to Library",
          onClick: onBack,
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back to Library"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-[var(--dc-color-text-primary)] truncate">
              {source.title}
            </h3>
            {content && (
              <p className="text-xs text-[var(--dc-color-text-muted)]">
                {content.wordCount.toLocaleString()} words
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto px-4 py-4 relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--dc-color-text-muted)]">Loading content...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : content ? (
          <div
            ref={contentRef}
            className="source-content"
            dangerouslySetInnerHTML={{ __html: content.content }}
          />
        ) : null}

        {/* Floating insert button for text selection */}
        {selectedText && (
          <div className="fixed bottom-24 right-8 z-50">
            <button
              onClick={handleInsertSelected}
              className="h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-full
                         shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Insert Selected
            </button>
          </div>
        )}
      </div>

      {/* Action bar */}
      {content && (
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            onClick={handleInsertAll}
            className="flex-1 h-10 rounded-lg border border-blue-300 text-sm font-medium text-blue-700
                       hover:bg-blue-50 transition-colors min-h-[44px]"
          >
            Insert All
          </button>
        </div>
      )}
    </div>
  );
}
