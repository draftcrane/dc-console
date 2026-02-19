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
    const stableFetchDriveFiles = vi.fn();
    const stableResetDriveFiles = vi.fn();
    const stableConnectDrive = vi.fn();
    const stableOnProjectConnected = vi.fn();
    const stableOnProjectDisconnected = vi.fn();

    const opts = {
      getToken: stableGetToken,
      projectId: "proj-1" as string | undefined,
      fetchDriveFiles: stableFetchDriveFiles,
      resetDriveFiles: stableResetDriveFiles,
      connectDrive: stableConnectDrive,
      driveFolderId: "drive-folder-123" as string | null | undefined,
      onProjectConnected: stableOnProjectConnected,
      onProjectDisconnected: stableOnProjectDisconnected,
      ...overrides,
    };

    const hookResult = renderHook(() => useProjectActions(opts));

    return {
      ...hookResult,
      mocks: {
        getToken: stableGetToken,
        fetchDriveFiles: stableFetchDriveFiles,
        resetDriveFiles: stableResetDriveFiles,
        connectDrive: stableConnectDrive,
        onProjectConnected: stableOnProjectConnected,
        onProjectDisconnected: stableOnProjectDisconnected,
      },
    };
  }

  // ------------------------------------------------------------------
  // TDZ regression coverage (#119)
  //
  // The EditorPage previously crashed with a TDZ error because
  // `useProjectActions` accessed `fetchProjectData` before its
  // `useCallback` declaration ran. The fix reordered hook declarations
  // so `fetchProjectData` is defined before `useProjectActions`.
  //
  // These tests exercise the `onProjectConnected` and
  // `onProjectDisconnected` callbacks (which in EditorPage close over
  // `fetchProjectData`) to ensure they fire correctly during Drive
  // connect and disconnect flows.
  // ------------------------------------------------------------------

  describe("Drive connect flow (onProjectConnected callback)", () => {
    it("calls onProjectConnected with driveFolderId after successful connect", async () => {
      const onProjectConnected = vi.fn();
      const fetchDriveFiles = vi.fn();

      const { result } = renderProjectActions({
        onProjectConnected,
        fetchDriveFiles,
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
      expect(fetchDriveFiles).toHaveBeenCalledWith("new-folder-456");
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

    it("resets isConnectingDrive to false after connect completes", async () => {
      const { result } = renderProjectActions();

      await waitFor(() => {
        expect(result.current.isLoadingProjects).toBe(false);
      });

      expect(result.current.isConnectingDrive).toBe(false);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ driveFolderId: "folder-1" }),
      });

      await act(async () => {
        await result.current.onConnectProjectToDrive();
      });

      expect(result.current.isConnectingDrive).toBe(false);
    });
  });

  describe("Drive disconnect flow (onProjectDisconnected callback)", () => {
    it("calls onProjectDisconnected after successful disconnect", async () => {
      const onProjectDisconnected = vi.fn();
      const resetDriveFiles = vi.fn();

      const { result } = renderProjectActions({
        onProjectDisconnected,
        resetDriveFiles,
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
      expect(resetDriveFiles).toHaveBeenCalled();
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
