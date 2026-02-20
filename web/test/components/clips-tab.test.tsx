import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock the hooks and components used by ClipsTab
vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "proj-1" }),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("mock-token"),
  }),
}));

const mockShowToast = vi.fn();
vi.mock("@/components/toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const mockViewSource = vi.fn();
vi.mock("@/components/research/research-panel-provider", () => ({
  useResearchPanel: () => ({
    viewSource: mockViewSource,
  }),
}));

const mockFetchClips = vi.fn();
const mockClips: Array<{
  id: string;
  content: string;
  sourceId: string | null;
  sourceTitle: string;
  sourceLocation: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  createdAt: string;
  projectId: string;
}> = [];

vi.mock("@/hooks/use-research-clips", () => ({
  useResearchClips: () => ({
    clips: mockClips,
    clipCount: mockClips.length,
    isLoading: false,
    error: null,
    fetchClips: mockFetchClips,
    saveClip: vi.fn(),
    savedContents: new Set<string>(),
    isSaving: false,
  }),
}));

// Import after mocks are set up
import { ClipsTab } from "@/components/research/clips-tab";

describe("ClipsTab", () => {
  const defaultProps = {
    onInsertClip: vi.fn().mockReturnValue("inserted" as const),
    canInsert: true,
    onClipsChanged: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClips.length = 0;
  });

  it("shows empty state when no clips", () => {
    render(<ClipsTab {...defaultProps} />);
    expect(screen.getByText("No clips saved yet")).toBeInTheDocument();
  });

  it("renders clips when available", () => {
    mockClips.push({
      id: "clip-1",
      content: "Test clip content about leadership",
      sourceId: "src-1",
      sourceTitle: "Workshop Notes",
      sourceLocation: null,
      chapterId: null,
      chapterTitle: null,
      createdAt: new Date().toISOString(),
      projectId: "proj-1",
    });

    render(<ClipsTab {...defaultProps} />);
    expect(screen.getByText(/Test clip content about leadership/)).toBeInTheDocument();
  });

  it("shows clip count", () => {
    mockClips.push({
      id: "clip-1",
      content: "Content A",
      sourceId: null,
      sourceTitle: "Source A",
      sourceLocation: null,
      chapterId: null,
      chapterTitle: null,
      createdAt: new Date().toISOString(),
      projectId: "proj-1",
    });

    render(<ClipsTab {...defaultProps} />);
    expect(screen.getByText("1 clip")).toBeInTheDocument();
  });

  it("calls onInsertClip and shows toast when Insert is tapped", () => {
    const onInsertClip = vi.fn().mockReturnValue("inserted" as const);
    mockClips.push({
      id: "clip-1",
      content: "Clip text",
      sourceId: "src-1",
      sourceTitle: "Source Title",
      sourceLocation: null,
      chapterId: null,
      chapterTitle: null,
      createdAt: new Date().toISOString(),
      projectId: "proj-1",
    });

    render(<ClipsTab {...defaultProps} onInsertClip={onInsertClip} />);

    fireEvent.click(screen.getByRole("button", { name: /Insert quote/ }));
    expect(onInsertClip).toHaveBeenCalledWith("Clip text", "Source Title");
    expect(mockShowToast).toHaveBeenCalledWith("Inserted with footnote");
  });

  it("shows 'Inserted at end of chapter' toast when no cursor position", () => {
    const onInsertClip = vi.fn().mockReturnValue("appended" as const);
    mockClips.push({
      id: "clip-1",
      content: "Clip text",
      sourceId: null,
      sourceTitle: "Source",
      sourceLocation: null,
      chapterId: null,
      chapterTitle: null,
      createdAt: new Date().toISOString(),
      projectId: "proj-1",
    });

    render(<ClipsTab {...defaultProps} onInsertClip={onInsertClip} />);

    fireEvent.click(screen.getByRole("button", { name: /Insert quote/ }));
    expect(mockShowToast).toHaveBeenCalledWith("Inserted at end of chapter");
  });

  it("disables Insert button when canInsert is false", () => {
    mockClips.push({
      id: "clip-1",
      content: "Clip text",
      sourceId: null,
      sourceTitle: "Source",
      sourceLocation: null,
      chapterId: null,
      chapterTitle: null,
      createdAt: new Date().toISOString(),
      projectId: "proj-1",
    });

    render(<ClipsTab {...defaultProps} canInsert={false} />);

    const insertBtn = screen.getByRole("button", { name: /Insert quote/ });
    expect(insertBtn).toBeDisabled();
  });

  it("calls fetchClips on mount", () => {
    render(<ClipsTab {...defaultProps} />);
    expect(mockFetchClips).toHaveBeenCalled();
  });

  it("deletes a clip and shows toast", async () => {
    // Mock fetch for delete
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    mockClips.push({
      id: "clip-1",
      content: "Clip to delete",
      sourceId: null,
      sourceTitle: "Source",
      sourceLocation: null,
      chapterId: null,
      chapterTitle: null,
      createdAt: new Date().toISOString(),
      projectId: "proj-1",
    });

    render(<ClipsTab {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete clip" }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Clip deleted");
    });

    global.fetch = originalFetch;
  });
});
