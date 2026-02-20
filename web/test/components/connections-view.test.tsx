import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ConnectionsView } from "@/components/research/connections-view";
import type { SourceMaterial } from "@/hooks/use-sources";

function makeSource(overrides: Partial<SourceMaterial> = {}): SourceMaterial {
  return {
    id: "src-1",
    projectId: "proj-1",
    title: "Test Source",
    sourceType: "drive",
    status: "active",
    mimeType: "application/vnd.google-apps.document",
    originalFilename: null,
    driveModifiedTime: null,
    wordCount: 1000,
    cachedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    sortOrder: 0,
    driveFileId: "file-1",
    driveConnectionId: "conn-1",
    ...overrides,
  };
}

describe("ConnectionsView", () => {
  const defaultProps = {
    driveAccounts: [
      { id: "conn-1", email: "alice@example.com", connectedAt: "2026-01-01T00:00:00Z" },
      { id: "conn-2", email: "bob@example.com", connectedAt: "2026-01-02T00:00:00Z" },
    ],
    sources: [
      makeSource({ id: "src-1", driveConnectionId: "conn-1" }),
      makeSource({ id: "src-2", driveConnectionId: "conn-1" }),
      makeSource({ id: "src-3", driveConnectionId: "conn-2" }),
      makeSource({
        id: "src-4",
        driveConnectionId: null,
        driveFileId: null,
        sourceType: "local" as const,
      }),
    ],
    protectedConnectionIds: [] as string[],
    onBack: vi.fn(),
    onBrowseFiles: vi.fn(),
    onConnectAccount: vi.fn(),
    onDisconnect: vi.fn().mockResolvedValue(undefined),
  };

  it("renders all Drive accounts with correct per-account document counts", () => {
    render(<ConnectionsView {...defaultProps} />);

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("2 documents")).toBeInTheDocument(); // alice
    // bob has 1 doc, device has 1 doc — both render "1 document"
    expect(screen.getAllByText("1 document")).toHaveLength(2);
  });

  it("shows device upload count when device sources exist", () => {
    render(<ConnectionsView {...defaultProps} />);

    // "FROM DEVICE" section should show 1 document
    expect(screen.getByText(/From Device/i)).toBeInTheDocument();
    expect(screen.getAllByText("1 document").length).toBeGreaterThanOrEqual(1);
  });

  it("hides Disconnect button for protected accounts", () => {
    render(<ConnectionsView {...defaultProps} protectedConnectionIds={["conn-1"]} />);

    // Only conn-2 should have a Disconnect button
    const disconnectButtons = screen.getAllByText("Disconnect");
    expect(disconnectButtons).toHaveLength(1);
  });

  it("shows Backup account badge for protected accounts", () => {
    render(<ConnectionsView {...defaultProps} protectedConnectionIds={["conn-1"]} />);

    expect(screen.getByText("Backup account")).toBeInTheDocument();
  });

  it("hides Connect Another when 3 accounts connected", () => {
    const threeAccounts = {
      ...defaultProps,
      driveAccounts: [
        { id: "conn-1", email: "a@example.com", connectedAt: "2026-01-01T00:00:00Z" },
        { id: "conn-2", email: "b@example.com", connectedAt: "2026-01-02T00:00:00Z" },
        { id: "conn-3", email: "c@example.com", connectedAt: "2026-01-03T00:00:00Z" },
      ],
    };
    render(<ConnectionsView {...threeAccounts} />);

    expect(screen.queryByText(/Connect another/)).not.toBeInTheDocument();
  });

  it("shows Connect Another when fewer than 3 accounts", () => {
    render(<ConnectionsView {...defaultProps} />);

    expect(screen.getByText(/Connect another Google account/)).toBeInTheDocument();
  });

  it("calls onBrowseFiles with correct connectionId", () => {
    render(<ConnectionsView {...defaultProps} />);

    const browseButtons = screen.getAllByText("Browse files");
    fireEvent.click(browseButtons[0]); // first account (conn-1)

    expect(defaultProps.onBrowseFiles).toHaveBeenCalledWith("conn-1");
  });

  it("disconnect confirmation flow: tap Disconnect, Cancel reverts", () => {
    render(<ConnectionsView {...defaultProps} />);

    const disconnectButtons = screen.getAllByText("Disconnect");
    fireEvent.click(disconnectButtons[0]);

    // Confirmation UI appears
    expect(screen.getByText("Confirm?")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Cancel reverts
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Confirm?")).not.toBeInTheDocument();
  });

  it("disconnect confirmation flow: tap Yes calls onDisconnect", async () => {
    render(<ConnectionsView {...defaultProps} />);

    const disconnectButtons = screen.getAllByText("Disconnect");
    fireEvent.click(disconnectButtons[0]); // first account = conn-1

    fireEvent.click(screen.getByText("Yes"));

    await waitFor(() => {
      expect(defaultProps.onDisconnect).toHaveBeenCalledWith("conn-1");
    });
  });

  it("back button calls onBack", () => {
    render(<ConnectionsView {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("Back to sources"));

    expect(defaultProps.onBack).toHaveBeenCalled();
  });
});
