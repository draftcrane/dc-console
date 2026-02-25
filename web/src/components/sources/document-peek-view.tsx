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
  onTagged?: () => void;
}

/**
 * DocumentPeekView — view a Drive document's content with tag and insert actions.
 *
 * "Add to Desk" tags the document (creates a source_materials record) and eagerly
 * triggers content extraction so it becomes available on the Desk.
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
  onTagged,
}: DocumentPeekViewProps) {
  const { content, format, wordCount, isLoading, error } = useDriveContent(connectionId, fileId);
  const { addDriveSources, sources, removeSource, editorRef, isPanelOpen, closePanel } =
    useSourcesContext();
  const { showToast } = useToast();

  const [selectedText, setSelectedText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Derive tag state from sources
  const existingSource = sources.find((s) => s.driveFileId === fileId && s.status === "active");
  const isOnDesk = !!existingSource;

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
      if (!editor) {
        showToast("Editor not available - click in your chapter first");
        return;
      }

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

  const handleAddToDesk = useCallback(async () => {
    setIsAdding(true);
    try {
      await addDriveSources([{ driveFileId: fileId, title: fileName, mimeType }], connectionId);
      showToast(`Added "${fileName}" to desk`);
      onTagged?.();
    } catch {
      showToast("Couldn't add to desk - try again");
    } finally {
      setIsAdding(false);
    }
  }, [addDriveSources, fileId, fileName, mimeType, connectionId, showToast, onTagged]);

  const handleRemoveFromDesk = useCallback(async () => {
    if (!existingSource) return;
    setIsRemoving(true);
    try {
      await removeSource(existingSource.id);
      showToast(`Removed "${fileName}" from desk`);
    } catch {
      showToast("Couldn't remove from desk — try again");
    } finally {
      setIsRemoving(false);
    }
  }, [existingSource, removeSource, fileName, showToast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-muted)] min-h-[44px] min-w-[44px] flex items-center justify-center"
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
            <h3 className="text-sm font-medium text-[var(--dc-color-text-primary)] truncate">
              {fileName}
            </h3>
            {!isLoading && !error && (
              <p className="text-xs text-[var(--dc-color-text-muted)]">
                {wordCount.toLocaleString()} words
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--dc-color-text-muted)]">Loading content...</p>
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
              <pre className="whitespace-pre-wrap text-sm text-[var(--dc-color-text-primary)] font-sans">
                {content}
              </pre>
            )}
          </div>
        ) : null}
      </div>

      {/* Action bar */}
      {content && (
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            onClick={isOnDesk ? handleRemoveFromDesk : handleAddToDesk}
            disabled={isAdding || isRemoving}
            className={`h-10 px-4 rounded-lg border text-sm font-medium transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-default ${
                         isOnDesk
                           ? "border-blue-300 text-blue-700 hover:bg-blue-50"
                           : "border-[var(--dc-color-border-strong)] text-[var(--dc-color-text-secondary)] hover:bg-[var(--dc-color-surface-secondary)]"
                       }`}
          >
            {isAdding
              ? "Adding..."
              : isRemoving
                ? "Removing..."
                : isOnDesk
                  ? "Remove from Desk"
                  : "Add to Desk"}
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
