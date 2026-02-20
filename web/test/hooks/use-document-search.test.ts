import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocumentSearch } from "@/hooks/use-document-search";

/**
 * Tests for useDocumentSearch hook.
 *
 * The hook performs DOM text search using TreeWalker, wraps matches in <mark>
 * elements, and provides navigation between matches. We test:
 * - Query state management
 * - Match counting
 * - Navigation (next/prev) cycling
 * - Clear behavior
 * - Minimum query length threshold (2 chars)
 */

function createContainerWithText(text: string): HTMLDivElement {
  const container = document.createElement("div");
  container.textContent = text;
  // jsdom does not implement scrollTo; stub it for tests
  container.scrollTo = vi.fn();
  document.body.appendChild(container);
  return container;
}

describe("useDocumentSearch", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = createContainerWithText("");
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
  });

  it("initializes with empty query and zero matches", () => {
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    expect(result.current.query).toBe("");
    expect(result.current.matchCount).toBe(0);
    expect(result.current.activeIndex).toBe(0);
  });

  it("updates query state when setQuery is called", () => {
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("hello");
    });

    expect(result.current.query).toBe("hello");
  });

  it("does not search when query is less than 2 characters", () => {
    container.textContent = "a b c d e";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("a");
      vi.advanceTimersByTime(200);
    });

    expect(result.current.matchCount).toBe(0);
  });

  it("finds matches when query is 2+ characters", () => {
    container.textContent = "hello world hello again hello";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("hello");
      vi.advanceTimersByTime(200);
    });

    expect(result.current.matchCount).toBe(3);
    expect(result.current.activeIndex).toBe(0);
  });

  it("performs case-insensitive search", () => {
    container.textContent = "Hello HELLO hello";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("hello");
      vi.advanceTimersByTime(200);
    });

    expect(result.current.matchCount).toBe(3);
  });

  it("wraps matches in mark elements with search-highlight class", () => {
    container.textContent = "find this word in text";
    const ref = { current: container };
    renderHook(() => useDocumentSearch({ containerRef: ref }));

    // We'll use the result to trigger search
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("this");
      vi.advanceTimersByTime(200);
    });

    const marks = container.querySelectorAll("mark.search-highlight");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("this");
  });

  it("navigates to next match with goToNext", () => {
    container.textContent = "ab ab ab";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("ab");
      vi.advanceTimersByTime(200);
    });

    expect(result.current.activeIndex).toBe(0);

    act(() => {
      result.current.goToNext();
    });
    expect(result.current.activeIndex).toBe(1);

    act(() => {
      result.current.goToNext();
    });
    expect(result.current.activeIndex).toBe(2);

    // Wraps around
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.activeIndex).toBe(0);
  });

  it("navigates to previous match with goToPrev", () => {
    container.textContent = "ab ab ab";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("ab");
      vi.advanceTimersByTime(200);
    });

    expect(result.current.activeIndex).toBe(0);

    // Wraps to last match
    act(() => {
      result.current.goToPrev();
    });
    expect(result.current.activeIndex).toBe(2);

    act(() => {
      result.current.goToPrev();
    });
    expect(result.current.activeIndex).toBe(1);
  });

  it("clears search state with clearSearch", () => {
    container.textContent = "hello world hello";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("hello");
      vi.advanceTimersByTime(200);
    });

    expect(result.current.matchCount).toBe(2);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.query).toBe("");
    expect(result.current.matchCount).toBe(0);
    expect(result.current.activeIndex).toBe(0);
    expect(container.querySelectorAll("mark.search-highlight").length).toBe(0);
  });

  it("reports zero matches for non-existent text", () => {
    container.textContent = "hello world";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("xyz");
      vi.advanceTimersByTime(200);
    });

    expect(result.current.matchCount).toBe(0);
  });

  it("does not search when enabled is false", () => {
    container.textContent = "hello world hello";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref, enabled: false }));

    act(() => {
      result.current.setQuery("hello");
      vi.advanceTimersByTime(200);
    });

    // Query state updates but no search is performed
    expect(result.current.query).toBe("hello");
    expect(result.current.matchCount).toBe(0);
  });

  it("debounces search by 150ms", () => {
    container.textContent = "hello world hello";
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    act(() => {
      result.current.setQuery("hello");
      // Advance less than debounce time
      vi.advanceTimersByTime(100);
    });

    // Search should not have executed yet
    expect(result.current.matchCount).toBe(0);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now it should have executed
    expect(result.current.matchCount).toBe(2);
  });

  it("goToNext and goToPrev are no-ops when no matches", () => {
    const ref = { current: container };
    const { result } = renderHook(() => useDocumentSearch({ containerRef: ref }));

    // Should not throw
    act(() => {
      result.current.goToNext();
    });
    expect(result.current.activeIndex).toBe(0);

    act(() => {
      result.current.goToPrev();
    });
    expect(result.current.activeIndex).toBe(0);
  });
});
