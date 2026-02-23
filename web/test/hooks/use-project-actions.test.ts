import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProjectActions } from "@/hooks/use-project-actions";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("useProjectActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    // Default: every fetch call returns empty projects list
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: [] }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /**
   * Renders the hook with stable option references to avoid infinite
   * re-render loops from unstable `getToken` identity.
   */
  function renderProjectActions(overrides?: Record<string, unknown>) {
    const stableGetToken = vi.fn().mockResolvedValue("test-token");

    const opts = {
      getToken: stableGetToken,
      projectId: "proj-1" as string | undefined,
      ...overrides,
    };

    const hookResult = renderHook(() => useProjectActions(opts));

    return {
      ...hookResult,
      mocks: {
        getToken: stableGetToken,
      },
    };
  }

  describe("Project save flow (rename and duplicate)", () => {
    it("renameProject sends PATCH and returns true on success", async () => {
      const { result } = renderProjectActions();

      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.renameProject("proj-1", "New Title");
      });

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/projects/proj-1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "New Title" }),
        }),
      );
    });

    it("duplicateProject returns new project ID on success", async () => {
      const { result } = renderProjectActions();

      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      // duplicate POST + refresh fetchProjects
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "proj-copy-1" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ projects: [] }),
        });

      let newId: string | null | undefined;
      await act(async () => {
        newId = await result.current.duplicateProject("proj-1");
      });

      expect(newId).toBe("proj-copy-1");
    });
  });
});
