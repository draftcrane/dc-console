import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SourceViewerSheet } from "@/components/drive/source-viewer-sheet";

/**
 * Tests for SourceViewerSheet — the Source Detail View.
 *
 * Verifies:
 * - Sheet renders with title and word count
 * - SourceContentRenderer is integrated (search field present)
 * - Cmd+F keyboard shortcut focuses the search field
 * - Escape closes the sheet
 * - Sheet does not render when isOpen is false
 */

// Mock the SourceContentRenderer to avoid DOM manipulation complexity
vi.mock("@/components/research/source-content-renderer", () => ({
  SourceContentRenderer: ({
    content,
    searchEnabled,
    searchInputRef,
  }: {
    content: string;
    searchEnabled: boolean;
    searchInputRef?: React.RefObject<HTMLInputElement | null>;
  }) => (
    <div data-testid="source-content-renderer">
      <input
        ref={searchInputRef}
        aria-label="Search within document"
        data-testid="search-input"
        data-search-enabled={searchEnabled}
      />
      <div data-testid="content">{content}</div>
    </div>
  ),
}));

const defaultProps = {
  isOpen: true,
  title: "Research Notes",
  content: "<p>This is test content for the source viewer.</p>",
  wordCount: 150,
  isLoading: false,
  error: null,
  onClose: vi.fn(),
  onImportAsChapter: vi.fn(),
};

describe("SourceViewerSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(<SourceViewerSheet {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title and word count", () => {
    render(<SourceViewerSheet {...defaultProps} />);

    expect(screen.getByText("Research Notes")).toBeInTheDocument();
    expect(screen.getByText("150 words")).toBeInTheDocument();
  });

  it("renders SourceContentRenderer with search enabled", () => {
    render(<SourceViewerSheet {...defaultProps} />);

    const renderer = screen.getByTestId("source-content-renderer");
    expect(renderer).toBeInTheDocument();

    const searchInput = screen.getByTestId("search-input");
    expect(searchInput).toHaveAttribute("data-search-enabled", "true");
  });

  it("renders search input with aria-label", () => {
    render(<SourceViewerSheet {...defaultProps} />);

    const searchInput = screen.getByLabelText("Search within document");
    expect(searchInput).toBeInTheDocument();
  });

  it("focuses search input on Cmd+F", () => {
    render(<SourceViewerSheet {...defaultProps} />);

    const searchInput = screen.getByLabelText("Search within document");

    fireEvent.keyDown(document, {
      key: "f",
      metaKey: true,
    });

    expect(document.activeElement).toBe(searchInput);
  });

  it("focuses search input on Ctrl+F", () => {
    render(<SourceViewerSheet {...defaultProps} />);

    const searchInput = screen.getByLabelText("Search within document");

    fireEvent.keyDown(document, {
      key: "f",
      ctrlKey: true,
    });

    expect(document.activeElement).toBe(searchInput);
  });

  it("calls onClose on Escape", () => {
    render(<SourceViewerSheet {...defaultProps} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("shows loading state", () => {
    render(<SourceViewerSheet {...defaultProps} isLoading={true} content="" />);

    expect(screen.getByText("Loading content...")).toBeInTheDocument();
    expect(screen.queryByTestId("source-content-renderer")).not.toBeInTheDocument();
  });

  it("shows error state", () => {
    render(<SourceViewerSheet {...defaultProps} error="Failed to load content" content="" />);

    expect(screen.getByText("Failed to load content")).toBeInTheDocument();
  });

  it("does not show SourceContentRenderer when content is empty", () => {
    render(<SourceViewerSheet {...defaultProps} content="" />);

    expect(screen.queryByTestId("source-content-renderer")).not.toBeInTheDocument();
  });

  it("renders source tabs when multiple tabs provided", () => {
    const tabs = [
      { id: "1", title: "Source A" },
      { id: "2", title: "Source B" },
    ];
    const onTabChange = vi.fn();

    render(
      <SourceViewerSheet {...defaultProps} tabs={tabs} activeTabId="1" onTabChange={onTabChange} />,
    );

    expect(screen.getByText("Source A")).toBeInTheDocument();
    expect(screen.getByText("Source B")).toBeInTheDocument();
  });

  it("has dialog role and aria attributes", () => {
    render(<SourceViewerSheet {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Source: Research Notes");
  });
});
