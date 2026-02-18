import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChapterManagement } from "@/hooks/use-chapter-management";

function makeProjectData() {
  return {
    id: "proj-1",
    title: "Test Project",
    status: "active",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    chapters: [
      { id: "ch-1", title: "Chapter 1", sortOrder: 1, wordCount: 100, version: 1, status: "draft" },
      { id: "ch-2", title: "Chapter 2", sortOrder: 2, wordCount: 200, version: 1, status: "draft" },
    ],
  };
}

function makeOptions(overrides?: Record<string, unknown>) {
  return {
    projectId: "proj-1",
    apiUrl: "https://api.test",
    getToken: vi.fn().mockResolvedValue("test-token"),
    projectData: makeProjectData(),
    setProjectData: vi.fn(),
    activeChapterId: "ch-1",
    setActiveChapterId: vi.fn(),
    setMobileOverlayOpen: vi.fn(),
    saveNowRef: { current: vi.fn().mockResolvedValue(undefined) },
    currentContent: "<p>Test</p>",
    ...overrides,
  };
}

describe("useChapterManagement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handleAddChapter calls API and updates state", async () => {
    const setProjectData = vi.fn();
    const setActiveChapterId = vi.fn();
    const newChapter = {
      id: "ch-3",
      title: "Untitled Chapter",
      sortOrder: 3,
      wordCount: 0,
      version: 1,
      status: "draft",
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(newChapter),
    });

    const { result } = renderHook(() =>
      useChapterManagement(makeOptions({ setProjectData, setActiveChapterId })),
    );

    await act(async () => {
      await result.current.handleAddChapter();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/projects/proj-1/chapters",
      expect.objectContaining({ method: "POST" }),
    );
    expect(setProjectData).toHaveBeenCalled();
    expect(setActiveChapterId).toHaveBeenCalledWith("ch-3");
  });

  it("handleChapterRename calls API with final title", async () => {
    const setProjectData = vi.fn();
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useChapterManagement(makeOptions({ setProjectData })));

    await act(async () => {
      await result.current.handleChapterRename("ch-1", "New Name");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/chapters/ch-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "New Name" }),
      }),
    );
    expect(setProjectData).toHaveBeenCalled();
  });

  it("handleChapterRename falls back to 'Untitled Chapter' for empty title", async () => {
    const setProjectData = vi.fn();
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useChapterManagement(makeOptions({ setProjectData })));

    await act(async () => {
      await result.current.handleChapterRename("ch-1", "   ");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/chapters/ch-1",
      expect.objectContaining({
        body: JSON.stringify({ title: "Untitled Chapter" }),
      }),
    );
  });

  it("handleDeleteChapterRequest opens the dialog", () => {
    const { result } = renderHook(() => useChapterManagement(makeOptions()));

    act(() => {
      result.current.handleDeleteChapterRequest("ch-2");
    });

    expect(result.current.chapterToDelete).toBe("ch-2");
    expect(result.current.deleteChapterDialogOpen).toBe(true);
  });

  it("handleChapterSelect saves before switching", async () => {
    const saveNow = vi.fn().mockResolvedValue(undefined);
    const setActiveChapterId = vi.fn();
    const setMobileOverlayOpen = vi.fn();

    const { result } = renderHook(() =>
      useChapterManagement(
        makeOptions({
          saveNowRef: { current: saveNow },
          setActiveChapterId,
          setMobileOverlayOpen,
        }),
      ),
    );

    await act(async () => {
      await result.current.handleChapterSelect("ch-2");
    });

    expect(saveNow).toHaveBeenCalled();
    expect(setActiveChapterId).toHaveBeenCalledWith("ch-2");
    expect(setMobileOverlayOpen).toHaveBeenCalledWith(false);
  });
});
