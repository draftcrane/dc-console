import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceContentRenderer } from "@/components/research/source-content-renderer";

/**
 * Tests for SourceContentRenderer component.
 *
 * Verifies:
 * - Always-visible search field rendering
 * - aria-label on search input
 * - Search input ref forwarding
 * - Navigation button rendering
 * - Search disabled mode
 */

// Mock useDocumentSearch since DOM manipulation (TreeWalker, marks) is tested separately
vi.mock("@/hooks/use-document-search", () => ({
  useDocumentSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    matchCount: 0,
    activeIndex: 0,
    goToNext: vi.fn(),
    goToPrev: vi.fn(),
    clearSearch: vi.fn(),
  }),
}));

describe("SourceContentRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search field with correct aria-label", () => {
    render(<SourceContentRenderer content="<p>Hello</p>" />);

    const searchInput = screen.getByLabelText("Search within document");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("type", "text");
  });

  it("renders search field with placeholder text", () => {
    render(<SourceContentRenderer content="<p>Hello</p>" />);

    const searchInput = screen.getByPlaceholderText("Search in document...");
    expect(searchInput).toBeInTheDocument();
  });

  it("renders navigation buttons", () => {
    render(<SourceContentRenderer content="<p>Hello</p>" />);

    expect(screen.getByLabelText("Previous match")).toBeInTheDocument();
    expect(screen.getByLabelText("Next match")).toBeInTheDocument();
  });

  it("hides search when searchEnabled is false", () => {
    render(<SourceContentRenderer content="<p>Hello</p>" searchEnabled={false} />);

    expect(screen.queryByLabelText("Search within document")).not.toBeInTheDocument();
  });

  it("accepts external searchInputRef", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<SourceContentRenderer content="<p>Hello</p>" searchInputRef={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toHaveAttribute("aria-label", "Search within document");
  });

  it("renders content area", () => {
    const { container } = render(<SourceContentRenderer content="<p>Test content</p>" />);

    const contentDiv = container.querySelector(".source-content");
    expect(contentDiv).toBeInTheDocument();
  });

  it("navigation buttons are disabled when no matches", () => {
    render(<SourceContentRenderer content="<p>Hello</p>" />);

    const prevButton = screen.getByLabelText("Previous match");
    const nextButton = screen.getByLabelText("Next match");

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });
});

describe("SourceContentRenderer with matches", () => {
  it("displays match count when matches exist", async () => {
    // Override mock for this test to simulate matches
    const mockSearch = {
      query: "hello",
      setQuery: vi.fn(),
      matchCount: 3,
      activeIndex: 1,
      goToNext: vi.fn(),
      goToPrev: vi.fn(),
      clearSearch: vi.fn(),
    };

    vi.resetModules();
    vi.doMock("@/hooks/use-document-search", () => ({
      useDocumentSearch: () => mockSearch,
    }));

    // Re-import after mock
    const { SourceContentRenderer: FreshRenderer } =
      await import("@/components/research/source-content-renderer");

    render(<FreshRenderer content="<p>hello world hello again hello</p>" />);

    // Should show "2 of 3" (activeIndex 1 + 1)
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("displays 'No matches' when query has no results", async () => {
    const mockSearch = {
      query: "xyz",
      setQuery: vi.fn(),
      matchCount: 0,
      activeIndex: 0,
      goToNext: vi.fn(),
      goToPrev: vi.fn(),
      clearSearch: vi.fn(),
    };

    vi.resetModules();
    vi.doMock("@/hooks/use-document-search", () => ({
      useDocumentSearch: () => mockSearch,
    }));

    const { SourceContentRenderer: FreshRenderer } =
      await import("@/components/research/source-content-renderer");

    render(<FreshRenderer content="<p>hello world</p>" />);

    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});
