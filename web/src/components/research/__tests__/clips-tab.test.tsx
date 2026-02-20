import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClipsTab } from "../clips-tab";
import type { ResearchClip } from "@/hooks/use-research-clips";

// Mock @clerk/nextjs
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn() }),
}));

function makeClip(overrides: Partial<ResearchClip> = {}): ResearchClip {
  return {
    id: `clip-${Math.random().toString(36).slice(2)}`,
    projectId: "project-1",
    sourceId: "source-1",
    chapterId: null,
    sourceTitle: "Test Source",
    snippetText: "A test clip snippet.",
    chapterTitle: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const defaultProps = {
  clips: [] as ResearchClip[],
  isLoading: false,
  error: null,
  chapters: [],
  onFetchClips: vi.fn().mockResolvedValue(undefined),
  onDeleteClip: vi.fn().mockResolvedValue(undefined),
};

describe("ClipsTab", () => {
  it("shows empty state when no clips", () => {
    render(<ClipsTab {...defaultProps} />);

    expect(screen.getByText(/No clips yet\. Save passages from AI results/)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<ClipsTab {...defaultProps} isLoading={true} />);

    expect(screen.getByText("Loading clips...")).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    const onFetchClips = vi.fn().mockResolvedValue(undefined);
    render(<ClipsTab {...defaultProps} error="Network error" onFetchClips={onFetchClips} />);

    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Try again"));
    // One call from useEffect on mount, one from retry click
    expect(onFetchClips).toHaveBeenCalled();
  });

  it("renders clip cards", () => {
    const clips = [
      makeClip({ id: "c1", snippetText: "First clip text" }),
      makeClip({ id: "c2", snippetText: "Second clip text" }),
    ];

    render(<ClipsTab {...defaultProps} clips={clips} />);

    expect(screen.getByText("First clip text")).toBeInTheDocument();
    expect(screen.getByText("Second clip text")).toBeInTheDocument();
  });

  it("filters clips by search query (snippet text)", () => {
    const clips = [
      makeClip({ id: "c1", snippetText: "Alpha beta gamma" }),
      makeClip({ id: "c2", snippetText: "Delta epsilon" }),
    ];

    render(<ClipsTab {...defaultProps} clips={clips} />);

    const searchInput = screen.getByPlaceholderText("Search clips...");
    fireEvent.change(searchInput, { target: { value: "alpha" } });

    expect(screen.getByText("Alpha beta gamma")).toBeInTheDocument();
    expect(screen.queryByText("Delta epsilon")).not.toBeInTheDocument();
  });

  it("filters clips by search query (source title)", () => {
    const clips = [
      makeClip({ id: "c1", sourceTitle: "Interview Notes", snippetText: "Clip A" }),
      makeClip({ id: "c2", sourceTitle: "Research Paper", snippetText: "Clip B" }),
    ];

    render(<ClipsTab {...defaultProps} clips={clips} />);

    const searchInput = screen.getByPlaceholderText("Search clips...");
    fireEvent.change(searchInput, { target: { value: "interview" } });

    expect(screen.getByText("Clip A")).toBeInTheDocument();
    expect(screen.queryByText("Clip B")).not.toBeInTheDocument();
  });

  it("shows no results message for empty search", () => {
    const clips = [makeClip({ snippetText: "Alpha" })];

    render(<ClipsTab {...defaultProps} clips={clips} />);

    const searchInput = screen.getByPlaceholderText("Search clips...");
    fireEvent.change(searchInput, { target: { value: "zzz" } });

    expect(screen.getByText(/No clips match/)).toBeInTheDocument();
  });

  it("clears search with clear button", () => {
    const clips = [
      makeClip({ id: "c1", snippetText: "Alpha" }),
      makeClip({ id: "c2", snippetText: "Beta" }),
    ];

    render(<ClipsTab {...defaultProps} clips={clips} />);

    const searchInput = screen.getByPlaceholderText("Search clips...");
    fireEvent.change(searchInput, { target: { value: "alpha" } });
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("chapter filter dropdown shows only chapters with clips", () => {
    const clips = [
      makeClip({ id: "c1", chapterId: "ch-1", chapterTitle: "Chapter 1" }),
      makeClip({ id: "c2", chapterId: null }),
    ];
    const chapters = [
      { id: "ch-1", title: "Chapter 1" },
      { id: "ch-2", title: "Chapter 2" },
    ];

    render(<ClipsTab {...defaultProps} clips={clips} chapters={chapters} />);

    const select = screen.getByLabelText("Filter by chapter");
    // "All Chapters" + "Chapter 1" only (ch-2 has no clips)
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe("All Chapters");
    expect(options[1].textContent).toBe("Chapter 1");
  });

  it("calls onFetchClips with chapterId when chapter filter changes", () => {
    const onFetchClips = vi.fn().mockResolvedValue(undefined);
    const clips = [makeClip({ chapterId: "ch-1", chapterTitle: "Chapter 1" })];
    const chapters = [{ id: "ch-1", title: "Chapter 1" }];

    render(
      <ClipsTab {...defaultProps} clips={clips} chapters={chapters} onFetchClips={onFetchClips} />,
    );

    const select = screen.getByLabelText("Filter by chapter");
    fireEvent.change(select, { target: { value: "ch-1" } });

    expect(onFetchClips).toHaveBeenCalledWith("ch-1");
  });

  it("calls onFetchClips on mount", () => {
    const onFetchClips = vi.fn().mockResolvedValue(undefined);

    render(<ClipsTab {...defaultProps} onFetchClips={onFetchClips} />);

    expect(onFetchClips).toHaveBeenCalled();
  });
});
