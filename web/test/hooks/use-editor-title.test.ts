import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorTitle } from "@/hooks/use-editor-title";

/**
 * Tests for useEditorTitle — the chapter title editing state machine.
 *
 * State flow:
 *   display mode -> editing mode (handleTitleEdit)
 *   editing mode -> display mode (handleTitleSave)
 *
 * Responsibilities:
 * - Manages editingTitle boolean
 * - Populates titleValue from activeChapter on edit start
 * - Calls handleChapterRename on save
 * - Falls back gracefully when activeChapterId is null
 */

function makeOptions(overrides?: Partial<Parameters<typeof useEditorTitle>[0]>) {
  return {
    activeChapter: { id: "ch-1", title: "Chapter 1" },
    activeChapterId: "ch-1",
    handleChapterRename: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("useEditorTitle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────
  // Initial state
  // ────────────────────────────────────────────

  it("starts in display mode (not editing)", () => {
    const { result } = renderHook(() => useEditorTitle(makeOptions()));

    expect(result.current.editingTitle).toBe(false);
    expect(result.current.titleValue).toBe("");
  });

  // ────────────────────────────────────────────
  // handleTitleEdit
  // ────────────────────────────────────────────

  it("handleTitleEdit enters editing mode and populates title from active chapter", () => {
    const { result } = renderHook(() => useEditorTitle(makeOptions()));

    act(() => {
      result.current.handleTitleEdit();
    });

    expect(result.current.editingTitle).toBe(true);
    expect(result.current.titleValue).toBe("Chapter 1");
  });

  it("handleTitleEdit is a no-op when activeChapter is undefined", () => {
    const { result } = renderHook(() => useEditorTitle(makeOptions({ activeChapter: undefined })));

    act(() => {
      result.current.handleTitleEdit();
    });

    expect(result.current.editingTitle).toBe(false);
    expect(result.current.titleValue).toBe("");
  });

  // ────────────────────────────────────────────
  // handleTitleSave
  // ────────────────────────────────────────────

  it("handleTitleSave calls handleChapterRename and exits editing mode", async () => {
    const handleChapterRename = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useEditorTitle(makeOptions({ handleChapterRename })));

    // Enter edit mode
    act(() => {
      result.current.handleTitleEdit();
    });
    expect(result.current.editingTitle).toBe(true);

    // Change the title
    act(() => {
      result.current.setTitleValue("New Chapter Name");
    });
    expect(result.current.titleValue).toBe("New Chapter Name");

    // Save
    await act(async () => {
      await result.current.handleTitleSave();
    });

    expect(handleChapterRename).toHaveBeenCalledWith("ch-1", "New Chapter Name");
    expect(result.current.editingTitle).toBe(false);
  });

  it("handleTitleSave exits editing mode without calling rename when activeChapterId is null", async () => {
    const handleChapterRename = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useEditorTitle(
        makeOptions({
          activeChapterId: null,
          handleChapterRename,
        }),
      ),
    );

    // Force into editing mode
    act(() => {
      result.current.setEditingTitle(true);
    });

    await act(async () => {
      await result.current.handleTitleSave();
    });

    expect(handleChapterRename).not.toHaveBeenCalled();
    expect(result.current.editingTitle).toBe(false);
  });

  // ────────────────────────────────────────────
  // setTitleValue
  // ────────────────────────────────────────────

  it("setTitleValue updates the title value", () => {
    const { result } = renderHook(() => useEditorTitle(makeOptions()));

    act(() => {
      result.current.setTitleValue("Draft Title");
    });

    expect(result.current.titleValue).toBe("Draft Title");
  });

  // ────────────────────────────────────────────
  // setEditingTitle
  // ────────────────────────────────────────────

  it("setEditingTitle directly controls editing state", () => {
    const { result } = renderHook(() => useEditorTitle(makeOptions()));

    act(() => {
      result.current.setEditingTitle(true);
    });
    expect(result.current.editingTitle).toBe(true);

    act(() => {
      result.current.setEditingTitle(false);
    });
    expect(result.current.editingTitle).toBe(false);
  });

  // ────────────────────────────────────────────
  // Full lifecycle
  // ────────────────────────────────────────────

  it("full lifecycle: display -> edit -> type -> save -> display", async () => {
    const handleChapterRename = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useEditorTitle(
        makeOptions({
          activeChapter: { id: "ch-1", title: "Original Title" },
          handleChapterRename,
        }),
      ),
    );

    // Start in display mode
    expect(result.current.editingTitle).toBe(false);

    // Click title to edit
    act(() => {
      result.current.handleTitleEdit();
    });
    expect(result.current.editingTitle).toBe(true);
    expect(result.current.titleValue).toBe("Original Title");

    // User types a new title
    act(() => {
      result.current.setTitleValue("Revised Title");
    });
    expect(result.current.titleValue).toBe("Revised Title");

    // User saves (blur or Enter)
    await act(async () => {
      await result.current.handleTitleSave();
    });

    expect(handleChapterRename).toHaveBeenCalledWith("ch-1", "Revised Title");
    expect(result.current.editingTitle).toBe(false);
  });

  it("edit -> cancel (Escape) lifecycle via setEditingTitle(false)", () => {
    const handleChapterRename = vi.fn();
    const { result } = renderHook(() => useEditorTitle(makeOptions({ handleChapterRename })));

    // Enter editing mode
    act(() => {
      result.current.handleTitleEdit();
    });
    expect(result.current.editingTitle).toBe(true);

    // User presses Escape (component calls setEditingTitle(false))
    act(() => {
      result.current.setEditingTitle(false);
    });

    expect(result.current.editingTitle).toBe(false);
    // handleChapterRename should NOT have been called
    expect(handleChapterRename).not.toHaveBeenCalled();
  });
});
