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
    const stableConnectDrive = vi.fn();
    const stableOnProjectConnected = vi.fn();
    const stableOnProjectDisconnected = vi.fn();

    const opts = {
      getToken: stableGetToken,
      projectId: "proj-1" as string | undefined,
      connectDrive: stableConnectDrive,
      onProjectConnected: stableOnProjectConnected,
      onProjectDisconnected: stableOnProjectDisconnected,
      ...overrides,
    };

    const hookResult = renderHook(() => useProjectActions(opts));

    return {
      ...hookResult,
      mocks: {
        getToken: stableGetToken,
        connectDrive: stableConnectDrive,
        onProjectConnected: stableOnProjectConnected,
        onProjectDisconnected: stableOnProjectDisconnected,
      },
    };
  }

  // ------------------------------------------------------------------
  // TDZ regression coverage (#119)
  // ------------------------------------------------------------------

  describe("Drive connect flow (onProjectConnected callback)", () => {
    it("calls onProjectConnected with driveFolderId after successful connect", async () => {
      const onProjectConnected = vi.fn();

      const { result } = renderProjectActions({
        onProjectConnected,
      });

      // Wait for mount effect (fetchProjects) to settle
      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      // Override fetch for the connect-drive call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ driveFolderId: "new-folder-456" }),
      });

      await act(async () => {
        await result.current.onConnectProjectToDrive();
      });

      expect(onProjectConnected).toHaveBeenCalledWith("new-folder-456");
    });

    it("does not call onProjectConnected when API returns error", async () => {
      const onProjectConnected = vi.fn();

      const { result } = renderProjectActions({ onProjectConnected });

      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await act(async () => {
        await result.current.onConnectProjectToDrive();
      });

      expect(onProjectConnected).not.toHaveBeenCalled();
    });
  });

  describe("Drive disconnect flow (onProjectDisconnected callback)", () => {
    it("calls onProjectDisconnected after successful disconnect", async () => {
      const onProjectDisconnected = vi.fn();

      const { result } = renderProjectActions({
        onProjectDisconnected,
      });

      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.disconnectProjectFromDrive();
      });

      expect(success).toBe(true);
      expect(onProjectDisconnected).toHaveBeenCalled();
    });

    it("does not call onProjectDisconnected when API returns error", async () => {
      const onProjectDisconnected = vi.fn();

      const { result } = renderProjectActions({ onProjectDisconnected });

      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.disconnectProjectFromDrive();
      });

      expect(success).toBe(false);
      expect(onProjectDisconnected).not.toHaveBeenCalled();
    });
  });

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

  describe("connectDriveWithProject stores project context", () => {
    it("stores projectId in sessionStorage before calling connectDrive", async () => {
      const connectDrive = vi.fn();
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const { result } = renderProjectActions({ connectDrive });

      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      act(() => {
        result.current.connectDriveWithProject();
      });

      expect(setItemSpy).toHaveBeenCalledWith("dc_pending_drive_project", "proj-1");
      expect(connectDrive).toHaveBeenCalled();
    });
  });
});
