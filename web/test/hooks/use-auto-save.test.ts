import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Tests for useAutoSave — the three-tier auto-save hook.
 *
 * Tier 1: IndexedDB on every keystroke
 * Tier 2: API save with 2s debounce
 * Tier 3: D1 metadata (server-side, not tested here)
 *
 * We mock @/lib/indexeddb entirely because IndexedDB's internal async
 * operations deadlock under vi.useFakeTimers(). The IndexedDB layer
 * has its own dedicated test suite (test/lib/indexeddb.test.ts).
 */

// Mock the IndexedDB module before importing the hook
const mockSaveDraft = vi.fn().mockResolvedValue(undefined);
const mockLoadDraft = vi.fn().mockResolvedValue(null);
const mockDeleteDraft = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/indexeddb", () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  loadDraft: (...args: unknown[]) => mockLoadDraft(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
  clearAllDrafts: vi.fn().mockResolvedValue(undefined),
}));

import { useAutoSave } from "@/hooks/use-auto-save";

function makeOptions(overrides?: Partial<Parameters<typeof useAutoSave>[0]>) {
  return {
    chapterId: "ch-1",
    version: 1,
    getToken: vi.fn().mockResolvedValue("test-token"),
    apiUrl: "https://api.test",
    debounceMs: 2000,
    maxRetries: 3,
    ...overrides,
  };
}

function mockFetchSuccess(version = 2, wordCount = 10) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        version,
        wordCount,
        updatedAt: new Date().toISOString(),
      }),
  });
}

function mockFetchConflict() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: () => Promise.resolve({ error: "Version conflict" }),
  });
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSaveDraft.mockClear().mockResolvedValue(undefined);
    mockLoadDraft.mockClear().mockResolvedValue(null);
    mockDeleteDraft.mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with idle save status", () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    expect(result.current.saveStatus).toEqual({ state: "idle" });
    expect(result.current.content).toBe("");
    expect(result.current.currentVersion).toBe(1);
  });

  it("does not save when content has not changed (saveNow with no content)", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    await act(async () => {
      await result.current.saveNow();
    });

    // fetch should not be called because content is empty
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toEqual({ state: "idle" });
  });

  it("saves after debounce interval when content changes", async () => {
    mockFetchSuccess(2, 15);
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    // Simulate a content change (keystroke)
    act(() => {
      result.current.handleContentChange("<p>Hello world</p>");
    });

    // Before debounce fires, fetch should not be called
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance past the debounce interval (2000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/chapters/ch-1/content",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ content: "<p>Hello world</p>", version: 1 }),
      }),
    );

    expect(result.current.saveStatus.state).toBe("saved");
    expect(result.current.currentVersion).toBe(2);
  });

  it("writes to IndexedDB immediately on content change (Tier 1)", () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    act(() => {
      result.current.handleContentChange("<p>Draft text</p>");
    });

    // saveDraft should be called synchronously with the content
    expect(mockSaveDraft).toHaveBeenCalledWith({
      chapterId: "ch-1",
      content: "<p>Draft text</p>",
      updatedAt: expect.any(Number),
      version: 1,
    });
  });

  it("handles version conflict (409) by entering error state", async () => {
    // On 409, saveToApi sets "Version conflict" status, then executeSave
    // overwrites with "Save failed — retrying" since success is false.
    // The final observable state is the error from executeSave.
    mockFetchConflict();
    const { result } = renderHook(() => useAutoSave(makeOptions({ maxRetries: 0 })));

    act(() => {
      result.current.setContent("<p>Some content</p>");
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(result.current.saveStatus.state).toBe("error");
  });

  it("handles network errors gracefully without crashing", async () => {
    // fetch rejects entirely (network error)
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAutoSave(makeOptions({ maxRetries: 0 })));

    act(() => {
      result.current.setContent("<p>Content</p>");
    });

    await act(async () => {
      await result.current.saveNow();
    });

    // The hook should not throw; it should set error status
    expect(result.current.saveStatus.state).toBe("error");
  });

  it("updates currentVersion after successful save", async () => {
    mockFetchSuccess(5, 42);
    const { result } = renderHook(() => useAutoSave(makeOptions({ version: 1 })));

    expect(result.current.currentVersion).toBe(1);

    act(() => {
      result.current.setContent("<p>New content</p>");
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(result.current.currentVersion).toBe(5);
  });

  it("cancels debounce timer on saveNow and saves immediately", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    // Start content change (sets debounce timer)
    act(() => {
      result.current.handleContentChange("<p>Typing...</p>");
    });

    // saveNow should cancel debounce and save immediately
    await act(async () => {
      await result.current.saveNow();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advancing timers past the debounce should not trigger another save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("resets content via setContent without triggering a save", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    act(() => {
      result.current.setContent("<p>Loaded from server</p>");
    });

    expect(result.current.content).toBe("<p>Loaded from server</p>");

    // Advance timers — no save should be triggered by setContent alone
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not save when chapterId is null", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions({ chapterId: null })));

    act(() => {
      result.current.handleContentChange("<p>No chapter</p>");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // fetch should not be called when there is no chapterId
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not call fetch when getToken returns null", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() =>
      useAutoSave(
        makeOptions({
          getToken: vi.fn().mockResolvedValue(null),
          maxRetries: 0,
        }),
      ),
    );

    act(() => {
      result.current.setContent("<p>Content</p>");
    });

    await act(async () => {
      await result.current.saveNow();
    });

    // fetch should not be called when token is null
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clears IndexedDB draft after successful remote save", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    act(() => {
      result.current.setContent("<p>Draft</p>");
    });

    await act(async () => {
      await result.current.saveNow();
    });

    // After successful remote save, deleteDraft should be called
    expect(mockDeleteDraft).toHaveBeenCalledWith("ch-1");
  });

  it("retries on API failure with exponential backoff", async () => {
    // First two calls fail, third succeeds
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            version: 2,
            wordCount: 5,
            updatedAt: new Date().toISOString(),
          }),
      });
    });

    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAutoSave(makeOptions({ maxRetries: 3 })));

    act(() => {
      result.current.setContent("<p>Retry content</p>");
    });

    // Start the save — don't await, the retries use setTimeout internally
    act(() => {
      result.current.saveNow();
    });

    // Allow the initial save attempt to complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Retry 1 backoff: 1s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Retry 2 backoff: 2s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Allow final microtasks to settle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Should have called fetch multiple times (initial + retries)
    expect(callCount).toBeGreaterThanOrEqual(3);
    expect(result.current.saveStatus.state).toBe("saved");
  });

  it("debounce resets on rapid content changes", async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useAutoSave(makeOptions()));

    // Type rapidly — each call resets the debounce
    act(() => {
      result.current.handleContentChange("<p>H</p>");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    act(() => {
      result.current.handleContentChange("<p>He</p>");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    act(() => {
      result.current.handleContentChange("<p>Hel</p>");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    act(() => {
      result.current.handleContentChange("<p>Hell</p>");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    act(() => {
      result.current.handleContentChange("<p>Hello</p>");
    });

    // No save should have happened yet (debounce kept resetting)
    expect(global.fetch).not.toHaveBeenCalled();

    // Now advance 2 full seconds from last change
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Should save only once, with the final content
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/chapters/ch-1/content",
      expect.objectContaining({
        body: JSON.stringify({ content: "<p>Hello</p>", version: 1 }),
      }),
    );
  });

  it("recovery prompt is set when IndexedDB draft version matches remote", async () => {
    mockFetchSuccess();
    mockLoadDraft.mockResolvedValue({
      chapterId: "ch-1",
      content: "<p>Recovered content</p>",
      updatedAt: Date.now(),
      version: 1,
    });

    const { result } = renderHook(() => useAutoSave(makeOptions()));

    // Wait for the recovery check useEffect to run
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.recoveryPrompt).not.toBeNull();
    expect(result.current.recoveryPrompt!.localContent).toBe("<p>Recovered content</p>");
    expect(result.current.recoveryPrompt!.remoteVersion).toBe(1);
  });

  it("no recovery prompt when IndexedDB draft version is older than remote", async () => {
    mockFetchSuccess();
    mockLoadDraft.mockResolvedValue({
      chapterId: "ch-1",
      content: "<p>Old draft</p>",
      updatedAt: Date.now(),
      version: 1,
    });

    const { result } = renderHook(() => useAutoSave(makeOptions({ version: 2 })));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.recoveryPrompt).toBeNull();
  });

  it("dismissRecovery clears the prompt and deletes draft from IndexedDB", async () => {
    mockFetchSuccess();
    mockLoadDraft.mockResolvedValue({
      chapterId: "ch-1",
      content: "<p>Recovered content</p>",
      updatedAt: Date.now(),
      version: 1,
    });

    const { result } = renderHook(() => useAutoSave(makeOptions()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.recoveryPrompt).not.toBeNull();

    act(() => {
      result.current.dismissRecovery();
    });

    expect(result.current.recoveryPrompt).toBeNull();
    expect(mockDeleteDraft).toHaveBeenCalledWith("ch-1");
  });

  it("acceptRecovery sets content and triggers a save", async () => {
    mockFetchSuccess(2, 20);
    mockLoadDraft.mockResolvedValue({
      chapterId: "ch-1",
      content: "<p>Recovered content</p>",
      updatedAt: Date.now(),
      version: 1,
    });

    const { result } = renderHook(() => useAutoSave(makeOptions()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.recoveryPrompt).not.toBeNull();

    await act(async () => {
      result.current.acceptRecovery();
    });

    expect(result.current.recoveryPrompt).toBeNull();
    expect(result.current.content).toBe("<p>Recovered content</p>");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("no recovery prompt when IndexedDB has no draft", async () => {
    mockFetchSuccess();
    mockLoadDraft.mockResolvedValue(null);

    const { result } = renderHook(() => useAutoSave(makeOptions()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.recoveryPrompt).toBeNull();
  });

  it("sends version in API save body for optimistic concurrency", async () => {
    mockFetchSuccess(8, 10);
    const { result } = renderHook(() => useAutoSave(makeOptions({ version: 7 })));

    act(() => {
      result.current.setContent("<p>Content</p>");
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ content: "<p>Content</p>", version: 7 }),
      }),
    );
  });
});
