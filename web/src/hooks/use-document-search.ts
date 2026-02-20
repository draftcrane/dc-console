"use client";

import { useState, useRef, useCallback, useEffect, type RefObject } from "react";

interface UseDocumentSearchOptions {
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

interface UseDocumentSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  matchCount: number;
  activeIndex: number;
  goToNext: () => void;
  goToPrev: () => void;
  clearSearch: () => void;
}

/**
 * DOM text search hook using TreeWalker.
 *
 * Walks text nodes in `containerRef`, wraps matches in <mark> elements,
 * and provides navigation between matches. Uses explicit container.scrollTo()
 * instead of scrollIntoView() to work reliably in iPad Safari overflow containers.
 */
export function useDocumentSearch({
  containerRef,
  enabled = true,
}: UseDocumentSearchOptions): UseDocumentSearchReturn {
  const [query, setQueryState] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const matchesRef = useRef<HTMLElement[]>([]);
  const searchCounterRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Remove all existing search marks and normalize text nodes. */
  const clearMarks = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const marks = container.querySelectorAll("mark.search-highlight");
    marks.forEach((mark) => {
      mark.replaceWith(...Array.from(mark.childNodes));
    });
    container.normalize();
    matchesRef.current = [];
  }, [containerRef]);

  /** Scroll a match element into view, centered in the container. */
  const scrollToMatch = useCallback(
    (el: HTMLElement) => {
      const container = containerRef.current;
      if (!container || !el) return;

      const top = el.offsetTop - container.clientHeight / 2;
      container.scrollTo({ top, behavior: "smooth" });
    },
    [containerRef],
  );

  /** Update which match has the active highlight class. */
  const updateActiveHighlight = useCallback(
    (index: number) => {
      const matches = matchesRef.current;

      // Remove active class from all
      matches.forEach((m) => m.classList.remove("search-highlight-active"));

      // Add to current
      if (matches[index]) {
        matches[index].classList.add("search-highlight-active");
        scrollToMatch(matches[index]);
      }
    },
    [scrollToMatch],
  );

  /** Perform the search: clear old marks, walk text nodes, wrap matches. */
  const performSearch = useCallback(
    (searchQuery: string, searchId: number) => {
      const container = containerRef.current;
      if (!container) return;

      clearMarks();

      if (!searchQuery || searchQuery.length < 2) {
        setMatchCount(0);
        setActiveIndex(0);
        return;
      }

      // Bail if a newer search has been triggered
      if (searchCounterRef.current !== searchId) return;

      const lowerQuery = searchQuery.toLowerCase();
      const newMatches: HTMLElement[] = [];

      // Collect text nodes via TreeWalker
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

      const textNodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
      }

      // Process text nodes — iterate in reverse to avoid index shifting
      for (let i = textNodes.length - 1; i >= 0; i--) {
        const textNode = textNodes[i];
        const text = textNode.textContent || "";
        const lowerText = text.toLowerCase();

        // Find all match positions in this text node
        const positions: number[] = [];
        let pos = lowerText.indexOf(lowerQuery);
        while (pos !== -1) {
          positions.push(pos);
          pos = lowerText.indexOf(lowerQuery, pos + 1);
        }

        if (positions.length === 0) continue;

        // Split and wrap — process positions in reverse order
        const parent = textNode.parentNode;
        if (!parent) continue;

        const remaining = textNode;
        for (let j = positions.length - 1; j >= 0; j--) {
          const matchPos = positions[j];
          const matchEnd = matchPos + searchQuery.length;

          // Split after the match end
          if (matchEnd < (remaining.textContent || "").length) {
            remaining.splitText(matchEnd);
          }

          // Split at match start to isolate the match
          const matchTextNode = remaining.splitText(matchPos);

          // Create mark element
          const mark = document.createElement("mark");
          mark.className = "search-highlight";
          mark.textContent = matchTextNode.textContent;
          parent.replaceChild(mark, matchTextNode);

          newMatches.unshift(mark);

          // `remaining` still refers to the text before the split
        }
      }

      // Bail if stale
      if (searchCounterRef.current !== searchId) return;

      matchesRef.current = newMatches;
      setMatchCount(newMatches.length);

      if (newMatches.length > 0) {
        setActiveIndex(0);
        newMatches[0].classList.add("search-highlight-active");
        scrollToMatch(newMatches[0]);
      } else {
        setActiveIndex(0);
      }
    },
    [containerRef, clearMarks, scrollToMatch],
  );

  /** Public setter: debounce the search by 150ms. */
  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);

      if (!enabled) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const searchId = ++searchCounterRef.current;
      debounceTimerRef.current = setTimeout(() => {
        performSearch(q, searchId);
      }, 150);
    },
    [enabled, performSearch],
  );

  const goToNext = useCallback(() => {
    const matches = matchesRef.current;
    if (matches.length === 0) return;
    const next = (activeIndex + 1) % matches.length;
    setActiveIndex(next);
    updateActiveHighlight(next);
  }, [activeIndex, updateActiveHighlight]);

  const goToPrev = useCallback(() => {
    const matches = matchesRef.current;
    if (matches.length === 0) return;
    const prev = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(prev);
    updateActiveHighlight(prev);
  }, [activeIndex, updateActiveHighlight]);

  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    searchCounterRef.current++;
    clearMarks();
    setQueryState("");
    setMatchCount(0);
    setActiveIndex(0);
  }, [clearMarks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    query,
    setQuery,
    matchCount,
    activeIndex,
    goToNext,
    goToPrev,
    clearSearch,
  };
}
