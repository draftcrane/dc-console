import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/**
 * ClipsTab search and filter tests (#199).
 * Tests client-side search by content and source title.
 */

// ============================================================
// Mock setup
// ============================================================

const mockViewSource = vi.fn();
const mockFetchClips = vi.fn().mockResolvedValue(undefined);
const mockDeleteClip = vi.fn().mockResolvedValue(true);

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("test-token") }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "proj-1" }),
}));

vi.mock("@/components/research/research-panel-provider", () => ({
  useResearchPanel: () => ({
    viewSource: mockViewSource,
    state: "clips",
    activeTab: "clips",
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    switchTab: vi.fn(),
    isOpen: true,
  }),
}));

// Mock useResearchClips to control clips data
let mockClips: ReturnType<typeof makeClip>[] = [];
vi.mock("@/hooks/use-research-clips", () => ({
  useResearchClips: () => ({
    clips: mockClips,
    clipCount: mockClips.length,
    isLoading: false,
    error: null,
    fetchClips: mockFetchClips,
    saveClip: vi.fn(),
    deleteClip: mockDeleteClip,
    savedContents: new Set(),
    isSaving: false,
  }),
}));

// Mock fetch for useProjectChapters
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
});

// ============================================================
// Imports (after mocks)
// ============================================================

import { ClipsTab } from "@/components/research/clips-tab";

// ============================================================
// Helpers
// ============================================================

function makeClip(overrides: Record<string, unknown> = {}) {
  return {
    id: `clip-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "proj-1",
    sourceId: "src-1",
    sourceTitle: "Test Source",
    content: "Default clip content",
    sourceLocation: null,
    chapterId: null,
    chapterTitle: null,
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("ClipsTab search", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetchClips.mockResolvedValue(undefined);
    mockDeleteClip.mockResolvedValue(true);
    // Mock chapters fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ chapters: [] }),
    });
  });

  it("shows search input when clips exist", () => {
    mockClips = [makeClip({ id: "c1", content: "First clip" })];
    render(<ClipsTab />);

    expect(screen.getByLabelText("Search clips")).toBeInTheDocument();
  });

  it("does not show search input when no clips", () => {
    mockClips = [];
    render(<ClipsTab />);

    expect(screen.queryByLabelText("Search clips")).not.toBeInTheDocument();
  });

  it("filters clips by content text", () => {
    mockClips = [
      makeClip({ id: "c1", content: "Alpha beta gamma" }),
      makeClip({ id: "c2", content: "Delta epsilon zeta" }),
    ];
    render(<ClipsTab />);

    const search = screen.getByLabelText("Search clips");
    fireEvent.change(search, { target: { value: "alpha" } });

    expect(screen.getByText("Alpha beta gamma")).toBeInTheDocument();
    expect(screen.queryByText("Delta epsilon zeta")).not.toBeInTheDocument();
  });

  it("filters clips by source title", () => {
    mockClips = [
      makeClip({ id: "c1", content: "Clip A", sourceTitle: "Interview Notes" }),
      makeClip({ id: "c2", content: "Clip B", sourceTitle: "Research Paper" }),
    ];
    render(<ClipsTab />);

    const search = screen.getByLabelText("Search clips");
    fireEvent.change(search, { target: { value: "interview" } });

    expect(screen.getByText("Clip A")).toBeInTheDocument();
    expect(screen.queryByText("Clip B")).not.toBeInTheDocument();
  });

  it("shows 'no results' message when search matches nothing", () => {
    mockClips = [makeClip({ id: "c1", content: "Alpha" })];
    render(<ClipsTab />);

    const search = screen.getByLabelText("Search clips");
    fireEvent.change(search, { target: { value: "zzzzz" } });

    expect(screen.getByText("No clips match your search.")).toBeInTheDocument();
  });

  it("clears search with clear button", () => {
    mockClips = [makeClip({ id: "c1", content: "Alpha" }), makeClip({ id: "c2", content: "Beta" })];
    render(<ClipsTab />);

    const search = screen.getByLabelText("Search clips");
    fireEvent.change(search, { target: { value: "alpha" } });
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("search is case-insensitive", () => {
    mockClips = [makeClip({ id: "c1", content: "UPPERCASE content" })];
    render(<ClipsTab />);

    const search = screen.getByLabelText("Search clips");
    fireEvent.change(search, { target: { value: "uppercase" } });

    expect(screen.getByText("UPPERCASE content")).toBeInTheDocument();
  });

  it("shows empty state with correct wording", () => {
    mockClips = [];
    render(<ClipsTab />);

    expect(screen.getByText("No clips yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Save passages from AI results or select text in source documents/),
    ).toBeInTheDocument();
  });
});
