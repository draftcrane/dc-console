"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useDocumentSearch } from "@/hooks/use-document-search";

interface SourceContentRendererProps {
  /** HTML content to render */
  content: string;
  /** Always-visible search field in header (default: true) */
  searchEnabled?: boolean;
  /** Character offset to scroll to on mount/change */
  scrollToOffset?: number;
  /** Text string to scroll to on mount/change (alternative to offset) */
  scrollToText?: string;
  /** Called when text is selected (for future "Save to Clips") */
  onTextSelect?: (selectedText: string) => void;
}

/**
 * Walk text nodes in a container, accumulating character count,
 * and return the text node + local offset for a given global character offset.
 */
function findTextNodeAtOffset(
  container: HTMLElement,
  targetOffset: number,
): { node: Text; localOffset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let accumulated = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node as Text;
    const len = text.textContent?.length || 0;
    if (accumulated + len > targetOffset) {
      return { node: text, localOffset: targetOffset - accumulated };
    }
    accumulated += len;
  }
  return null;
}

/**
 * Wrap a range of text in a span with the given class, and scroll it into view
 * centered in the container. Returns a cleanup function to remove the wrapper.
 */
function highlightAndScroll(
  container: HTMLElement,
  startNode: Text,
  startOffset: number,
  length: number,
  className: string,
): () => void {
  const range = document.createRange();
  range.setStart(startNode, startOffset);

  // Calculate end position — may span multiple text nodes
  let remaining = length;
  let endNode: Text = startNode;
  let endOffset = startOffset;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  // Advance walker to startNode
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === startNode) break;
  }

  const startRemaining = (startNode.textContent?.length || 0) - startOffset;
  if (startRemaining >= remaining) {
    endOffset = startOffset + remaining;
  } else {
    remaining -= startRemaining;
    while ((current = walker.nextNode())) {
      const len = current.textContent?.length || 0;
      if (len >= remaining) {
        endNode = current as Text;
        endOffset = remaining;
        break;
      }
      remaining -= len;
    }
  }

  range.setEnd(endNode, endOffset);

  const span = document.createElement("span");
  span.className = className;
  range.surroundContents(span);

  // Scroll to the span centered in container
  const top = span.offsetTop - container.clientHeight / 2;
  container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

  // Return cleanup
  return () => {
    if (span.parentNode) {
      span.replaceWith(...Array.from(span.childNodes));
      container.normalize();
    }
  };
}

/**
 * Generate a simple numeric key from content string for React remounting.
 */
function contentKey(content: string): number {
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 200); i++) {
    hash = (hash * 31 + content.charCodeAt(i)) | 0;
  }
  return hash;
}

export function SourceContentRenderer({
  content,
  searchEnabled = true,
  scrollToOffset,
  scrollToText,
  onTextSelect,
}: SourceContentRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [renderKey] = useState(() => contentKey(content));

  const search = useDocumentSearch({
    containerRef: scrollContainerRef,
    enabled: searchEnabled,
  });

  // Scroll-to-text: find the text in concatenated textContent, then map to DOM position
  useEffect(() => {
    if (!scrollToText || !contentRef.current || !scrollContainerRef.current) return;

    // Small delay to ensure dangerouslySetInnerHTML has rendered
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      const contentEl = contentRef.current;
      if (!container || !contentEl) return;

      const fullText = contentEl.textContent || "";
      const idx = fullText.toLowerCase().indexOf(scrollToText.toLowerCase());
      if (idx === -1) return;

      const result = findTextNodeAtOffset(contentEl, idx);
      if (!result) return;

      const cleanup = highlightAndScroll(
        container,
        result.node,
        result.localOffset,
        scrollToText.length,
        "scroll-target-flash",
      );

      // Remove highlight wrapper after animation completes
      const cleanupTimer = setTimeout(cleanup, 2000);
      return () => clearTimeout(cleanupTimer);
    }, 50);

    return () => clearTimeout(timer);
  }, [scrollToText, renderKey]);

  // Scroll-to-offset: directly walk text nodes to the offset
  useEffect(() => {
    if (scrollToOffset === undefined || !contentRef.current || !scrollContainerRef.current) return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      const contentEl = contentRef.current;
      if (!container || !contentEl) return;

      const result = findTextNodeAtOffset(contentEl, scrollToOffset);
      if (!result) return;

      // Highlight a short range around the offset (40 chars or rest of node)
      const remainingInNode = (result.node.textContent?.length || 0) - result.localOffset;
      const highlightLen = Math.min(40, remainingInNode);

      const cleanup = highlightAndScroll(
        container,
        result.node,
        result.localOffset,
        highlightLen,
        "scroll-target-flash",
      );

      const cleanupTimer = setTimeout(cleanup, 2000);
      return () => clearTimeout(cleanupTimer);
    }, 50);

    return () => clearTimeout(timer);
  }, [scrollToOffset, renderKey]);

  // Text selection handler
  const handleTextSelect = useCallback(() => {
    if (!onTextSelect) return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      onTextSelect(selection.toString().trim());
    }
  }, [onTextSelect]);

  // Keyboard shortcuts for search navigation
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          search.goToPrev();
        } else {
          search.goToNext();
        }
      } else if (e.key === "Escape") {
        search.clearSearch();
      }
    },
    [search],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search header — always visible per design spec */}
      {searchEnabled && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white shrink-0">
          <div className="relative flex-1">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search in document..."
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-400"
            />
          </div>

          {search.matchCount > 0 && (
            <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
              {search.activeIndex + 1} of {search.matchCount}
            </span>
          )}

          {search.query.length >= 2 && search.matchCount === 0 && (
            <span className="text-xs text-gray-400 whitespace-nowrap">No matches</span>
          )}

          <div className="flex items-center gap-0.5">
            <button
              onClick={search.goToPrev}
              disabled={search.matchCount === 0}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
              aria-label="Previous match"
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
            <button
              onClick={search.goToNext}
              disabled={search.matchCount === 0}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
              aria-label="Next match"
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Scrollable content area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div
          key={renderKey}
          ref={contentRef}
          className="source-content px-5 py-4"
          dangerouslySetInnerHTML={{ __html: content }}
          onMouseUp={handleTextSelect}
          onTouchEnd={handleTextSelect}
        />
      </div>
    </div>
  );
}

export default SourceContentRenderer;
