import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

/**
 * Tests for save-to-clips feature:
 *
 * 1. useResearchClips hook — save, fetch, dedup tracking, error states
 * 2. SelectionToolbar component — rendering, button interactions, chapter dropdown
 * 3. Toast (ToastProvider + useToast) — auto-dismiss, rendering
 */

// ============================================================
// Mock setup — must come before imports that reference them
// ============================================================

const mockGetToken = vi.fn().mockResolvedValue("test-token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

// The hook reads process.env.NEXT_PUBLIC_API_URL at module scope (line 6).
// We must set it before the hook module is loaded. vi.hoisted runs before imports.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
});

// ============================================================
// Imports (after hoisted env setup)
// ============================================================

import { useResearchClips, type ResearchClip } from "@/hooks/use-research-clips";
import { SelectionToolbar } from "@/components/research/selection-toolbar";
import { ToastProvider, useToast } from "@/components/toast";

// ============================================================
// useResearchClips tests
// ============================================================

function makeClip(overrides?: Partial<ResearchClip>): ResearchClip {
  return {
    id: "clip-1",
    projectId: "proj-1",
    sourceId: "src-1",
    sourceTitle: "Test Source",
    content: "Test clip content",
    sourceLocation: null,
    chapterId: null,
    chapterTitle: null,
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useResearchClips", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetToken.mockResolvedValue("test-token");
  });

  // ── saveClip: successful save ──

  it("saveClip returns clip and updates savedContents on success", async () => {
    const clip = makeClip();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(clip),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    let saveResult: { clip: ResearchClip; existed: boolean } | null = null;
    await act(async () => {
      saveResult = await result.current.saveClip({
        content: "Test clip content",
        sourceTitle: "Test Source",
        sourceId: "src-1",
      });
    });

    expect(saveResult).not.toBeNull();
    expect(saveResult!.clip).toEqual(clip);
    expect(saveResult!.existed).toBe(false);
    expect(result.current.savedContents.has("src-1::Test clip content")).toBe(true);
    expect(result.current.clipCount).toBe(1);
  });

  it("saveClip detects duplicate when API returns 200", async () => {
    const clip = makeClip();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(clip),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    let saveResult: { clip: ResearchClip; existed: boolean } | null = null;
    await act(async () => {
      saveResult = await result.current.saveClip({
        content: "Test clip content",
        sourceTitle: "Test Source",
        sourceId: "src-1",
      });
    });

    expect(saveResult!.existed).toBe(true);
    // Clip count should NOT increment for duplicates
    expect(result.current.clipCount).toBe(0);
  });

  // ── saveClip: API error handling ──

  it("saveClip returns null and sets error on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal Server Error" }),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    let saveResult: { clip: ResearchClip; existed: boolean } | null = null;
    await act(async () => {
      saveResult = await result.current.saveClip({
        content: "Test content",
        sourceTitle: "Source",
      });
    });

    expect(saveResult).toBeNull();
    expect(result.current.error).toBe("Internal Server Error");
  });

  it("saveClip handles non-JSON error response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    let saveResult: { clip: ResearchClip; existed: boolean } | null = null;
    await act(async () => {
      saveResult = await result.current.saveClip({
        content: "Test content",
        sourceTitle: "Source",
      });
    });

    expect(saveResult).toBeNull();
    expect(result.current.error).toBe("Failed to save clip");
  });

  // ── saveClip: network failure ──

  it("saveClip returns null and sets error on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useResearchClips("proj-1"));

    let saveResult: { clip: ResearchClip; existed: boolean } | null = null;
    await act(async () => {
      saveResult = await result.current.saveClip({
        content: "Test content",
        sourceTitle: "Source",
      });
    });

    expect(saveResult).toBeNull();
    expect(result.current.error).toBe("Network error");
  });

  // ── fetchClips: populates clips array ──

  it("fetchClips populates clips and savedContents", async () => {
    const clips = [
      makeClip({ id: "clip-1", content: "Content A", sourceId: "src-1" }),
      makeClip({ id: "clip-2", content: "Content B", sourceId: "src-2" }),
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ clips }),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    await act(async () => {
      await result.current.fetchClips();
    });

    expect(result.current.clips).toEqual(clips);
    expect(result.current.clipCount).toBe(2);
    expect(result.current.savedContents.has("src-1::Content A")).toBe(true);
    expect(result.current.savedContents.has("src-2::Content B")).toBe(true);
  });

  // ── fetchClips: handles chapterId filter ──

  it("fetchClips passes chapterId as query parameter", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ clips: [] }),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    await act(async () => {
      await result.current.fetchClips("ch-5");
    });

    expect(global.fetch).toHaveBeenCalled();
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).toContain("chapterId=ch-5");
  });

  // ── fetchClips: error states ──

  it("fetchClips sets error on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    await act(async () => {
      await result.current.fetchClips();
    });

    expect(result.current.error).toBe("Failed to fetch clips");
  });

  it("fetchClips sets error on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useResearchClips("proj-1"));

    await act(async () => {
      await result.current.fetchClips();
    });

    expect(result.current.error).toBe("Network failure");
  });

  // ── dedup tracking: savedContents populates on fetch, updates on save ──

  it("savedContents uses sourceId::content as dedup key", async () => {
    const clip = makeClip({ content: "Hello", sourceId: null });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ clips: [clip] }),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    await act(async () => {
      await result.current.fetchClips();
    });

    // null sourceId should use "no-source" in the key
    expect(result.current.savedContents.has("no-source::Hello")).toBe(true);
  });
});

// ============================================================
// SelectionToolbar tests
// ============================================================

/**
 * jsdom doesn't properly support window.getSelection().toString() or
 * Range.getBoundingClientRect(), so we mock getSelection() to return
 * a controlled object that the component's selectionchange handler uses.
 */
function mockSelectionAndTrigger(text: string) {
  const mockRange = {
    getBoundingClientRect: () => ({
      top: 100,
      left: 200,
      right: 300,
      bottom: 120,
      width: 100,
      height: 20,
      x: 200,
      y: 100,
      toJSON: () => ({}),
    }),
  };

  vi.spyOn(window, "getSelection").mockReturnValue({
    toString: () => text,
    rangeCount: text.length > 0 ? 1 : 0,
    isCollapsed: text.length === 0,
    getRangeAt: () => mockRange,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
  } as unknown as Selection);

  // Dispatch event wrapped in act() since it triggers React state updates
  // from a non-React DOM event listener (document.addEventListener)
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

const chapters = [
  { id: "ch-1", title: "Chapter 1" },
  { id: "ch-2", title: "Chapter 2" },
];

describe("SelectionToolbar", () => {
  beforeEach(() => {
    // Mock requestAnimationFrame for synchronous execution in tests
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when there is no selection", () => {
    const { container } = render(
      <SelectionToolbar chapters={chapters} onSaveToClips={vi.fn()} onCopy={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows toolbar when text is selected", () => {
    render(<SelectionToolbar chapters={chapters} onSaveToClips={vi.fn()} onCopy={vi.fn()} />);

    mockSelectionAndTrigger("Selected text");

    expect(screen.getByLabelText("Copy selected text")).toBeInTheDocument();
    expect(screen.getByLabelText("Save to Clips")).toBeInTheDocument();
  });

  it("Copy button calls onCopy", () => {
    const onCopy = vi.fn();
    render(<SelectionToolbar chapters={chapters} onSaveToClips={vi.fn()} onCopy={onCopy} />);

    mockSelectionAndTrigger("Selected text");
    fireEvent.click(screen.getByLabelText("Copy selected text"));

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("shows Saved checkmark when isSaved is true", () => {
    render(
      <SelectionToolbar
        chapters={chapters}
        onSaveToClips={vi.fn()}
        onCopy={vi.fn()}
        isSaved={true}
      />,
    );

    mockSelectionAndTrigger("Selected text");

    expect(screen.getByLabelText("Saved to Clips")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shows Saving state when isSaving is true", () => {
    render(
      <SelectionToolbar
        chapters={chapters}
        onSaveToClips={vi.fn()}
        onCopy={vi.fn()}
        isSaving={true}
      />,
    );

    mockSelectionAndTrigger("Selected text");

    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  // ── Fix 3 behavior: deferred save ──

  it("Save to Clips shows chapter dropdown when chapters exist (does not save immediately)", () => {
    const onSaveToClips = vi.fn();
    render(<SelectionToolbar chapters={chapters} onSaveToClips={onSaveToClips} onCopy={vi.fn()} />);

    mockSelectionAndTrigger("Selected text");
    fireEvent.click(screen.getByLabelText("Save to Clips"));

    // Dropdown should appear
    expect(screen.getByText("All chapters")).toBeInTheDocument();
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Chapter 2")).toBeInTheDocument();

    // Save should NOT have been called yet (deferred until selection)
    expect(onSaveToClips).not.toHaveBeenCalled();
  });

  it("Save to Clips calls onSaveToClips(null) directly when no chapters", () => {
    const onSaveToClips = vi.fn();
    render(<SelectionToolbar chapters={[]} onSaveToClips={onSaveToClips} onCopy={vi.fn()} />);

    mockSelectionAndTrigger("Selected text");
    fireEvent.click(screen.getByLabelText("Save to Clips"));

    // No dropdown — save called immediately with null
    expect(onSaveToClips).toHaveBeenCalledWith(null);
    expect(onSaveToClips).toHaveBeenCalledTimes(1);
  });

  it("selecting a chapter calls onSaveToClips with the chapter id", () => {
    const onSaveToClips = vi.fn();
    render(<SelectionToolbar chapters={chapters} onSaveToClips={onSaveToClips} onCopy={vi.fn()} />);

    mockSelectionAndTrigger("Selected text");
    fireEvent.click(screen.getByLabelText("Save to Clips"));
    fireEvent.click(screen.getByText("Chapter 1"));

    expect(onSaveToClips).toHaveBeenCalledWith("ch-1");
    expect(onSaveToClips).toHaveBeenCalledTimes(1);
  });

  it("selecting 'All chapters' calls onSaveToClips with null", () => {
    const onSaveToClips = vi.fn();
    render(<SelectionToolbar chapters={chapters} onSaveToClips={onSaveToClips} onCopy={vi.fn()} />);

    mockSelectionAndTrigger("Selected text");
    fireEvent.click(screen.getByLabelText("Save to Clips"));
    fireEvent.click(screen.getByText("All chapters"));

    expect(onSaveToClips).toHaveBeenCalledWith(null);
    expect(onSaveToClips).toHaveBeenCalledTimes(1);
  });

  it("does not call onSaveToClips when isSaved is true", () => {
    const onSaveToClips = vi.fn();
    render(
      <SelectionToolbar
        chapters={chapters}
        onSaveToClips={onSaveToClips}
        onCopy={vi.fn()}
        isSaved={true}
      />,
    );

    mockSelectionAndTrigger("Selected text");
    fireEvent.click(screen.getByLabelText("Saved to Clips"));

    expect(onSaveToClips).not.toHaveBeenCalled();
  });

  // ── Chapter dropdown auto-dismiss ──

  it("auto-dismiss after 2s saves with null and hides dropdown", () => {
    vi.useFakeTimers();
    const onSaveToClips = vi.fn();

    // Re-mock rAF since useFakeTimers may affect it
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    render(<SelectionToolbar chapters={chapters} onSaveToClips={onSaveToClips} onCopy={vi.fn()} />);

    mockSelectionAndTrigger("Selected text");
    fireEvent.click(screen.getByLabelText("Save to Clips"));

    // Dropdown visible
    expect(screen.getByText("All chapters")).toBeInTheDocument();
    expect(onSaveToClips).not.toHaveBeenCalled();

    // Advance timer by 2s for auto-dismiss
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Save should have been called with null (auto-dismiss default)
    expect(onSaveToClips).toHaveBeenCalledWith(null);
    expect(onSaveToClips).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

// ============================================================
// Toast tests
// ============================================================

function TestToastConsumer() {
  const { showToast } = useToast();
  return <button onClick={() => showToast("Test toast message", 1000)}>Show Toast</button>;
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders toast with message when triggered", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Show Toast"));

    expect(screen.getByText("Test toast message")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("auto-dismisses after specified duration", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Test toast message")).toBeInTheDocument();

    // Advance past the 1000ms duration
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText("Test toast message")).not.toBeInTheDocument();
  });

  it("supports multiple concurrent toasts", () => {
    function MultiToastConsumer() {
      const { showToast } = useToast();
      return (
        <div>
          <button onClick={() => showToast("Toast A", 2000)}>Show A</button>
          <button onClick={() => showToast("Toast B", 3000)}>Show B</button>
        </div>
      );
    }

    render(
      <ToastProvider>
        <MultiToastConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("Show A"));
    fireEvent.click(screen.getByText("Show B"));

    expect(screen.getByText("Toast A")).toBeInTheDocument();
    expect(screen.getByText("Toast B")).toBeInTheDocument();

    // After 2s, Toast A should be gone but Toast B remains
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText("Toast A")).not.toBeInTheDocument();
    expect(screen.getByText("Toast B")).toBeInTheDocument();

    // After 1 more second (3s total), Toast B also gone
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText("Toast B")).not.toBeInTheDocument();
  });

  it("throws when useToast is used outside ToastProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useToast());
    }).toThrow("useToast must be used within a ToastProvider");

    consoleSpy.mockRestore();
  });
});
