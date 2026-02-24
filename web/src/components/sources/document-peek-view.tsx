"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDriveContent } from "@/hooks/use-drive-content";
import { useSourcesContext } from "@/contexts/sources-context";
import { useToast } from "@/components/toast";

interface DocumentPeekViewProps {
  fileId: string;
  fileName: string;
  mimeType: string;
  connectionId: string;
  onBack: () => void;
  onStudied?: () => void;
}

/**
 * DocumentPeekView — view a Drive document's content with Study and insert actions.
 *
 * "Study This" adds the document to the project's working set (source_materials)
 * and eagerly triggers content extraction so it becomes searchable in the Ask tab.
 *
 * Text selection replaces "Insert All" with "Insert Selected" in the action bar
 * (no floating button — avoids iPad positioning conflicts).
 */
export function DocumentPeekView({
  fileId,
  fileName,
  mimeType,
  connectionId,
  onBack,
  onStudied,
}: DocumentPeekViewProps) {
  const { content, format, wordCount, isLoading, error } = useDriveContent(connectionId, fileId);
  const { addDriveSources, sources, getContent, editorRef, isPanelOpen, closePanel } =
    useSourcesContext();
  const { showToast } = useToast();

  const [selectedText, setSelectedText] = useState("");
  const [isStudying, setIsStudying] = useState(false);
  const [isStudied, setIsStudied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if this document is already in the working set
  useEffect(() => {
    const existing = sources.find((s) => s.driveFileId === fileId && s.status === "active");
    if (existing) setIsStudied(true);
  }, [sources, fileId]);

  // Listen for text selection (selectionchange is more reliable on iPad than mouseup)
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectedText("");
        return;
      }
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
        editor.chain().focus().insertContent(html).run();
        showToast("Inserted at cursor");
      } else {
        editor.chain().focus("end").insertContent(html).run();
        showToast("Added to end of chapter");
      }

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
    document.getSelection()?.removeAllRanges();
    setSelectedText("");
  }, [selectedText, insertContent]);

  const handleInsertAll = useCallback(() => {
    if (!content) return;
    if (format === "html") {
      insertContent(content);
    } else {
      insertContent(`<pre class="whitespace-pre-wrap">${content}</pre>`);
    }
  }, [content, format, insertContent]);

  const handleStudy = useCallback(async () => {
    setIsStudying(true);
    try {
      await addDriveSources([{ driveFileId: fileId, title: fileName, mimeType }], connectionId);
      setIsStudied(true);
      showToast("DraftCrane will study this document");
      onStudied?.();

      // Eagerly trigger content extraction in the background.
      // After addDriveSources, sources state is updated. Find the new source by driveFileId.
      const newSource = sources.find((s) => s.driveFileId === fileId && s.status === "active");
      if (newSource) {
        getContent(newSource.id).catch(() => {
          // Non-critical — extraction will happen lazily on next access
        });
      }
    } catch {
      showToast("Couldn't study this document — try again");
    } finally {
      setIsStudying(false);
    }
  }, [
    addDriveSources,
    fileId,
    fileName,
    mimeType,
    connectionId,
    showToast,
    onStudied,
    sources,
    getContent,
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back to browser"
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
            <h3 className="text-sm font-medium text-gray-900 truncate">{fileName}</h3>
            {!isLoading && !error && (
              <p className="text-xs text-gray-500">{wordCount.toLocaleString()} words</p>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-500">Loading content...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : content ? (
          <div ref={contentRef}>
            {format === "html" ? (
              <div className="source-content" dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{content}</pre>
            )}
          </div>
        ) : null}
      </div>

      {/* Action bar */}
      {content && (
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            onClick={handleStudy}
            disabled={isStudied || isStudying}
            className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700
                       hover:bg-gray-50 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-default"
          >
            {isStudying ? "Studying..." : isStudied ? "Studied" : "Study This"}
          </button>

          <button
            onClick={selectedText ? handleInsertSelected : handleInsertAll}
            className="flex-1 h-10 rounded-lg border border-blue-300 text-sm font-medium text-blue-700
                       hover:bg-blue-50 transition-colors min-h-[44px]"
          >
            {selectedText ? "Insert Selected" : "Insert All"}
          </button>
        </div>
      )}
    </div>
  );
}
