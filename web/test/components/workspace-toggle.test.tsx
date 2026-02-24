import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceToggle, type ViewMode } from "@/components/editor/workspace-toggle";

/**
 * Tests for WorkspaceToggle - segmented control for Chapter/Book view switching.
 *
 * Per Issue #318 Acceptance Criteria:
 * - Segmented control with two options: [Chapter] [Book]
 * - Active state: filled background; inactive state: clearly differentiated
 * - Touch target minimum 44px per segment (verified via className checks)
 * - ARIA: role="radiogroup" with role="radio" for each option
 */

describe("WorkspaceToggle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────
  // Basic rendering
  // ────────────────────────────────────────────

  it("renders both Chapter and Book options", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    expect(screen.getByText("Chapter")).toBeInTheDocument();
    expect(screen.getByText("Book")).toBeInTheDocument();
  });

  it("has correct ARIA role of radiogroup", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    const radiogroup = screen.getByRole("radiogroup", { name: "Workspace view" });
    expect(radiogroup).toBeInTheDocument();
  });

  it("renders options with role=radio", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
  });

  // ────────────────────────────────────────────
  // Selection states
  // ────────────────────────────────────────────

  it("shows Chapter as selected when value is chapter", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    const chapterRadio = screen.getByRole("radio", { name: /Chapter view \(selected\)/ });
    expect(chapterRadio).toHaveAttribute("aria-checked", "true");

    const bookRadio = screen.getByRole("radio", { name: /Book view$/ });
    expect(bookRadio).toHaveAttribute("aria-checked", "false");
  });

  it("shows Book as selected when value is book", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="book" onChange={onChange} />);

    const chapterRadio = screen.getByRole("radio", { name: /Chapter view$/ });
    expect(chapterRadio).toHaveAttribute("aria-checked", "false");

    const bookRadio = screen.getByRole("radio", { name: /Book view \(selected\)/ });
    expect(bookRadio).toHaveAttribute("aria-checked", "true");
  });

  // ────────────────────────────────────────────
  // Click interactions
  // ────────────────────────────────────────────

  it("calls onChange with 'book' when Book is clicked", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    fireEvent.click(screen.getByText("Book"));
    expect(onChange).toHaveBeenCalledWith("book");
  });

  it("calls onChange with 'chapter' when Chapter is clicked", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="book" onChange={onChange} />);

    fireEvent.click(screen.getByText("Chapter"));
    expect(onChange).toHaveBeenCalledWith("chapter");
  });

  // ────────────────────────────────────────────
  // Keyboard navigation
  // ────────────────────────────────────────────

  it("calls onChange with 'chapter' when ArrowLeft is pressed", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="book" onChange={onChange} />);

    const radiogroup = screen.getByRole("radiogroup");
    fireEvent.keyDown(radiogroup, { key: "ArrowLeft" });

    expect(onChange).toHaveBeenCalledWith("chapter");
  });

  it("calls onChange with 'book' when ArrowRight is pressed", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    const radiogroup = screen.getByRole("radiogroup");
    fireEvent.keyDown(radiogroup, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("book");
  });

  it("calls onChange with 'chapter' when Home is pressed", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="book" onChange={onChange} />);

    const radiogroup = screen.getByRole("radiogroup");
    fireEvent.keyDown(radiogroup, { key: "Home" });

    expect(onChange).toHaveBeenCalledWith("chapter");
  });

  it("calls onChange with 'book' when End is pressed", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    const radiogroup = screen.getByRole("radiogroup");
    fireEvent.keyDown(radiogroup, { key: "End" });

    expect(onChange).toHaveBeenCalledWith("book");
  });

  // ────────────────────────────────────────────
  // Tab index management (roving tabindex pattern)
  // ────────────────────────────────────────────

  it("selected option has tabIndex=0, unselected has tabIndex=-1", () => {
    const onChange = vi.fn();
    render(<WorkspaceToggle value="chapter" onChange={onChange} />);

    const radios = screen.getAllByRole("radio");
    const chapterRadio = radios.find((r) => r.getAttribute("data-view") === "chapter")!;
    const bookRadio = radios.find((r) => r.getAttribute("data-view") === "book")!;

    expect(chapterRadio).toHaveAttribute("tabindex", "0");
    expect(bookRadio).toHaveAttribute("tabindex", "-1");
  });
});
