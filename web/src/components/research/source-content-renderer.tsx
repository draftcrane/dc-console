"use client";

import { useRef, useEffect, useCallback, type RefObject } from "react";
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
  /** Ref to the search input element (for external focus, e.g. Cmd+F) */
  searchInputRef?: RefObject<HTMLInputElement | null>;
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
  scrollContainer: HTMLElement,
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

  const parent = startNode.parentElement?.closest(".source-content") || startNode.parentElement;
  if (!parent) {
    return () => {};
  }

  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null);
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

  // Scroll using getBoundingClientRect for iPad Safari reliability
  const spanRect = span.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const top =
    spanRect.top - containerRect.top + scrollContainer.scrollTop - scrollContainer.clientHeight / 2;
  scrollContainer.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

  // Return cleanup
  return () => {
    if (span.parentNode) {
      span.replaceWith(...Array.from(span.childNodes));
      span.parentElement?.normalize();
    }
  };
}

export function SourceContentRenderer({
  content,
  searchEnabled = true,
  scrollToOffset,
  scrollToText,
  onTextSelect,
  searchInputRef: externalSearchInputRef,
}: SourceContentRendererProps) {
  const internalSearchInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = externalSearchInputRef ?? internalSearchInputRef;
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const search = useDocumentSearch({
    containerRef: scrollContainerRef,
    enabled: searchEnabled,
  });

  // Set innerHTML via ref — outside React reconciliation so search marks survive re-renders.
  // clearSearch ref is stable (depends only on containerRef).
  const { clearSearch } = search;
  useEffect(() => {
    if (contentRef.current) {
      clearSearch();
      contentRef.current.innerHTML = content;
    }
  }, [content, clearSearch]);

  // Scroll-to-text: find the text in concatenated textContent, then map to DOM position
  useEffect(() => {
    if (!scrollToText || !contentRef.current || !scrollContainerRef.current) return;

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

      const cleanupTimer = setTimeout(cleanup, 2000);
      return () => clearTimeout(cleanupTimer);
    }, 50);

    return () => clearTimeout(timer);
  }, [scrollToText, content]);

  // Scroll-to-offset: directly walk text nodes to the offset
  useEffect(() => {
    if (scrollToOffset === undefined || !contentRef.current || !scrollContainerRef.current) return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      const contentEl = contentRef.current;
      if (!container || !contentEl) return;

      const result = findTextNodeAtOffset(contentEl, scrollToOffset);
      if (!result) return;

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
  }, [scrollToOffset, content]);

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
              ref={searchInputRef}
              type="text"
              placeholder="Search in document..."
              aria-label="Search within document"
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
              className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
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
              className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
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
          ref={contentRef}
          className="source-content px-5 py-4"
          onMouseUp={handleTextSelect}
          onTouchEnd={handleTextSelect}
        />
      </div>
    </div>
  );
}

export default SourceContentRenderer;
