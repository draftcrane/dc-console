import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChapterContent } from "@/hooks/use-chapter-content";

/**
 * Tests for useChapterContent — chapter content loading and word count.
 *
 * Responsibilities:
 * - Fetches chapter content from API when activeChapterId changes
 * - Sets content to empty string on 404
 * - Sets content to empty string on fetch error
 * - Cancels in-flight requests when activeChapterId changes
 * - Counts words from HTML content
 * - Tracks selection word count
 */

function makeOptions(overrides?: Partial<Parameters<typeof useChapterContent>[0]>) {
  return {
    activeChapterId: "ch-1",
    getToken: vi.fn().mockResolvedValue("test-token"),
    setContent: vi.fn(),
    currentContent: "",
    ...overrides,
  };
}

describe("useChapterContent", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ────────────────────────────────────────────
  // Content loading
  // ────────────────────────────────────────────

  it("fetches chapter content on mount when activeChapterId is provided", async () => {
    const setContent = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "<p>Chapter content</p>", version: 1 }),
    });

    renderHook(() => useChapterContent(makeOptions({ setContent })));

    await waitFor(() => {
      expect(setContent).toHaveBeenCalledWith("<p>Chapter content</p>");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/chapters/ch-1/content"),
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  it("does not fetch when activeChapterId is null", () => {
    global.fetch = vi.fn();

    renderHook(() => useChapterContent(makeOptions({ activeChapterId: null })));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sets content to empty string on 404 response", async () => {
    const setContent = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    renderHook(() => useChapterContent(makeOptions({ setContent })));

    await waitFor(() => {
      expect(setContent).toHaveBeenCalledWith("");
    });
  });

  it("sets content to empty string on network error", async () => {
    const setContent = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderHook(() => useChapterContent(makeOptions({ setContent })));

    await waitFor(() => {
      expect(setContent).toHaveBeenCalledWith("");
    });
  });

  it("sets content to empty string when API returns empty content", async () => {
    const setContent = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    renderHook(() => useChapterContent(makeOptions({ setContent })));

    await waitFor(() => {
      expect(setContent).toHaveBeenCalledWith("");
    });
  });

  it("re-fetches when activeChapterId changes", async () => {
    const setContent = vi.fn();
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            content: `<p>Content for fetch ${fetchCount}</p>`,
            version: fetchCount,
          }),
      });
    });

    const { rerender } = renderHook(
      (props: { chapterId: string }) =>
        useChapterContent(makeOptions({ activeChapterId: props.chapterId, setContent })),
      { initialProps: { chapterId: "ch-1" } },
    );

    await waitFor(() => {
      expect(setContent).toHaveBeenCalled();
    });

    setContent.mockClear();

    rerender({ chapterId: "ch-2" });

    await waitFor(() => {
      expect(setContent).toHaveBeenCalled();
    });

    // The second fetch should be for ch-2
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/chapters/ch-2/content"),
      expect.any(Object),
    );
  });

  // ────────────────────────────────────────────
  // Word counting
  // ────────────────────────────────────────────

  it("counts words from HTML content", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    const { result } = renderHook(() =>
      useChapterContent(makeOptions({ currentContent: "<p>Hello world this is a test</p>" })),
    );

    expect(result.current.currentWordCount).toBe(6);
  });

  it("returns 0 word count for empty content", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    const { result } = renderHook(() => useChapterContent(makeOptions({ currentContent: "" })));

    expect(result.current.currentWordCount).toBe(0);
  });

  it("strips HTML tags when counting words", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    const { result } = renderHook(() =>
      useChapterContent(
        makeOptions({
          currentContent:
            "<p>First paragraph</p><p>Second paragraph</p><h1>A heading</h1><ul><li>item one</li></ul>",
        }),
      ),
    );

    // "First paragraph Second paragraph A heading item one" = 8 words
    expect(result.current.currentWordCount).toBe(8);
  });

  it("handles &nbsp; entities in word counting", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    const { result } = renderHook(() =>
      useChapterContent(
        makeOptions({
          currentContent: "<p>Hello&nbsp;world&nbsp;test</p>",
        }),
      ),
    );

    expect(result.current.currentWordCount).toBe(3);
  });

  // ────────────────────────────────────────────
  // Selection word count
  // ────────────────────────────────────────────

  it("starts with 0 selection word count", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    const { result } = renderHook(() => useChapterContent(makeOptions()));

    expect(result.current.selectionWordCount).toBe(0);
  });

  it("updates selection word count via handleSelectionWordCountChange", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    const { result } = renderHook(() => useChapterContent(makeOptions()));

    act(() => {
      result.current.handleSelectionWordCountChange(42);
    });

    expect(result.current.selectionWordCount).toBe(42);
  });

  it("resets selection word count to 0 when callback is called with 0", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "", version: 1 }),
    });

    const { result } = renderHook(() => useChapterContent(makeOptions()));

    act(() => {
      result.current.handleSelectionWordCountChange(15);
    });
    expect(result.current.selectionWordCount).toBe(15);

    act(() => {
      result.current.handleSelectionWordCountChange(0);
    });
    expect(result.current.selectionWordCount).toBe(0);
  });
});
