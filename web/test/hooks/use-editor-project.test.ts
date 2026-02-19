import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Tests for useEditorProject — the project data fetching and
 * Drive connection callback hook.
 *
 * Responsibilities:
 * - Fetches project data from the API on mount
 * - Auto-selects the first chapter when none is active
 * - Redirects to /dashboard on 404
 * - handleProjectConnected: optimistically sets driveFolderId, then re-fetches
 * - handleProjectDisconnected: optimistically clears driveFolderId, then re-fetches
 *
 * IMPORTANT: getToken must be a stable reference (created once, not per render)
 * because useEditorProject's fetchProjectData is memoised on [getToken, projectId, router].
 * An unstable getToken causes fetchProjectData to change on every render,
 * which re-triggers the useEffect, causing an infinite loop.
 */

// Mock next/navigation — the router object must be a STABLE reference
// because useEditorProject memoises fetchProjectData on [getToken, projectId, router].
// An unstable router causes fetchProjectData to re-create every render,
// which triggers the useEffect, causing an infinite loop.
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

import { useEditorProject } from "@/hooks/use-editor-project";

function makeProjectResponse(overrides?: Record<string, unknown>) {
  return {
    id: "proj-1",
    title: "Test Project",
    status: "active",
    driveFolderId: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    chapters: [
      {
        id: "ch-2",
        title: "Chapter 2",
        sortOrder: 2,
        wordCount: 200,
        version: 1,
        status: "draft",
      },
      {
        id: "ch-1",
        title: "Chapter 1",
        sortOrder: 1,
        wordCount: 100,
        version: 1,
        status: "draft",
      },
    ],
    ...overrides,
  };
}

describe("useEditorProject", () => {
  const originalFetch = global.fetch;
  // A stable getToken reference used across tests — avoids infinite re-render
  // loops caused by useCallback identity changes in useEditorProject.
  const stableGetToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("test-token");

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    stableGetToken.mockResolvedValue("test-token");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function makeOptions(overrides?: Record<string, unknown>) {
    return {
      projectId: "proj-1" as string,
      getToken: stableGetToken,
      ...overrides,
    };
  }

  it("starts in loading state", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeProjectResponse()),
    });

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.projectData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetches project data and sets it on mount", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeProjectResponse()),
    });

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projectData).not.toBeNull();
    expect(result.current.projectData!.id).toBe("proj-1");
    expect(result.current.projectData!.title).toBe("Test Project");
    expect(result.current.projectData!.chapters).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("auto-selects the first chapter by sortOrder when none is active", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeProjectResponse()),
    });

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // ch-1 has sortOrder: 1, ch-2 has sortOrder: 2
    expect(result.current.activeChapterId).toBe("ch-1");
  });

  it("does not override activeChapterId if already set on re-fetch", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeProjectResponse()),
    });

    const opts = makeOptions();
    const { result } = renderHook(() => useEditorProject(opts));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // First auto-selected chapter should be ch-1
    expect(result.current.activeChapterId).toBe("ch-1");

    // Manually set a different chapter
    act(() => {
      result.current.setActiveChapterId("ch-2");
    });
    expect(result.current.activeChapterId).toBe("ch-2");

    // Trigger a re-fetch
    await act(async () => {
      await result.current.fetchProjectData();
    });

    // Should still be ch-2 because activeChapterIdRef was already set
    expect(result.current.activeChapterId).toBe("ch-2");
  });

  it("redirects to /dashboard on 404 response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(result.current.projectData).toBeNull();
  });

  it("sets error state on non-404 failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load project");
    expect(result.current.projectData).toBeNull();
  });

  it("sets error state on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
  });

  it("does not auto-select a chapter when the project has no chapters", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeProjectResponse({ chapters: [] })),
    });

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeChapterId).toBeNull();
  });

  describe("handleProjectConnected", () => {
    it("re-fetches project data after being called", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeProjectResponse()),
      });

      const { result } = renderHook(() => useEditorProject(makeOptions()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const fetchCallsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      await act(async () => {
        await result.current.handleProjectConnected("new-drive-folder-id");
      });

      const fetchCallsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(fetchCallsAfter).toBeGreaterThan(fetchCallsBefore);
    });

    it("updates project data with driveFolderId from the re-fetch", async () => {
      // Use mockResolvedValueOnce for predictable fetch ordering:
      // 1st call (mount): no driveFolderId
      // 2nd call (handleProjectConnected re-fetch): has driveFolderId
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makeProjectResponse({ driveFolderId: null })),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makeProjectResponse({ driveFolderId: "confirmed-drive-id" })),
        });

      const { result } = renderHook(() => useEditorProject(makeOptions()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.handleProjectConnected("new-drive-folder-id");
      });

      // After re-fetch, the driveFolderId should come from the API response
      expect(result.current.projectData!.driveFolderId).toBe("confirmed-drive-id");
    });
  });

  describe("handleProjectDisconnected", () => {
    it("clears driveFolderId and re-fetches", async () => {
      // 1st call (mount): has driveFolderId
      // 2nd call (disconnect re-fetch): cleared
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(makeProjectResponse({ driveFolderId: "old-drive-folder" })),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makeProjectResponse({ driveFolderId: null })),
        });

      const { result } = renderHook(() => useEditorProject(makeOptions()));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.projectData!.driveFolderId).toBe("old-drive-folder");

      await act(async () => {
        await result.current.handleProjectDisconnected();
      });

      expect(result.current.projectData!.driveFolderId).toBeNull();
    });
  });

  it("sends Authorization header with token from getToken", async () => {
    stableGetToken.mockResolvedValue("my-auth-token");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeProjectResponse()),
    });

    renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/projects/proj-1"),
      expect.objectContaining({
        headers: { Authorization: "Bearer my-auth-token" },
      }),
    );
  });

  it("setProjectData allows external mutation of project data", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeProjectResponse()),
    });

    const { result } = renderHook(() => useEditorProject(makeOptions()));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setProjectData((prev) => (prev ? { ...prev, title: "Updated Title" } : prev));
    });

    expect(result.current.projectData!.title).toBe("Updated Title");
  });
});
