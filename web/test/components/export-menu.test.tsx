import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportMenu } from "@/components/project/export-menu";
import type { ExportPreference } from "@/hooks/use-export-preferences";

const originalFetch = global.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const mockUseBackup = vi.fn();
const mockUseExportPreferences = vi.fn();

vi.mock("@/hooks/use-backup", () => ({
  useBackup: () => mockUseBackup(),
}));

vi.mock("@/hooks/use-export-preferences", () => ({
  useExportPreferences: () => mockUseExportPreferences(),
}));

interface MockDestination {
  type: "device" | "drive";
  connectionId?: string;
  folderId?: string;
  folderPath?: string;
}

interface MockPickerProps {
  onSave: (destination: MockDestination, rememberDefault: boolean) => void;
}

vi.mock("@/components/project/export-destination-picker", () => ({
  ExportDestinationPicker: ({ onSave }: MockPickerProps) => (
    <div data-testid="destination-picker">
      <button onClick={() => onSave({ type: "device" }, false)}>Save Device</button>
    </div>
  ),
}));

describe("ExportMenu", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn() as unknown as typeof fetch;
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: vi.fn(() => "blob:test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: vi.fn(),
    });

    mockUseBackup.mockReturnValue({
      downloadBackup: vi.fn(),
      isDownloading: false,
    });

    mockUseExportPreferences.mockReturnValue({
      preference: null,
      isLoading: false,
      save: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it("does not show auto-delivered success when device delivery has no auth token", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const getToken = vi.fn().mockResolvedValueOnce("token-for-export").mockResolvedValueOnce(null);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jobId: "job-1",
          status: "completed",
          fileName: "Book.pdf",
          downloadUrl: "https://api.example.com/exports/job-1/download",
          error: null,
        }),
    });

    render(
      <ExportMenu
        projectId="proj-1"
        projectTitle="Book"
        activeChapterId="chap-1"
        getToken={getToken}
        apiUrl="https://api.example.com"
        connections={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export Book as PDF" }));

    await waitFor(() => {
      expect(screen.getByTestId("destination-picker")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Device" }));

    await waitFor(() => {
      expect(screen.getByTestId("destination-picker")).toBeInTheDocument();
    });

    expect(screen.queryByText("Downloaded")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits for preference loading before resolving delivery defaults", async () => {
    let preferenceLoading = true;
    let preference: ExportPreference | null = null;

    const savePreference = vi.fn();
    const clearPreference = vi.fn();
    mockUseExportPreferences.mockImplementation(() => ({
      preference,
      isLoading: preferenceLoading,
      save: savePreference,
      clear: clearPreference,
    }));

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const getToken = vi
      .fn()
      .mockResolvedValueOnce("token-for-export")
      .mockResolvedValueOnce("token-for-download");

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jobId: "job-2",
            status: "completed",
            fileName: "Book.pdf",
            downloadUrl: "https://api.example.com/exports/job-2/download",
            error: null,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "application/pdf" }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    const { rerender } = render(
      <ExportMenu
        projectId="proj-1"
        projectTitle="Book"
        activeChapterId="chap-1"
        getToken={getToken}
        apiUrl="https://api.example.com"
        connections={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export Book as PDF" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId("destination-picker")).not.toBeInTheDocument();

    preferenceLoading = false;
    preference = {
      id: "pref-1",
      projectId: "proj-1",
      userId: "user-1",
      destinationType: "device",
      driveConnectionId: null,
      driveFolderId: null,
      driveFolderPath: null,
      createdAt: "2026-02-24T00:00:00Z",
      updatedAt: "2026-02-24T00:00:00Z",
    };

    rerender(
      <ExportMenu
        projectId="proj-1"
        projectTitle="Book"
        activeChapterId="chap-1"
        getToken={getToken}
        apiUrl="https://api.example.com"
        connections={[]}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByTestId("destination-picker")).not.toBeInTheDocument();
    expect(screen.getByText("Downloaded")).toBeInTheDocument();
  });
});
