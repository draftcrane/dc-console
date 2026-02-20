import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SourceCitationLink } from "@/components/research/source-citation-link";

describe("SourceCitationLink", () => {
  const defaultProps = {
    sourceTitle: "Workshop Notes March 2024",
    sourceId: "src-1",
    returnTo: "ask" as const,
    onNavigateToSource: vi.fn(),
  };

  it("renders source title as a tappable button when sourceId is present", () => {
    render(<SourceCitationLink {...defaultProps} />);

    const button = screen.getByRole("button", { name: /View source: Workshop Notes/ });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Workshop Notes March 2024");
  });

  it("has 44pt minimum touch target", () => {
    render(<SourceCitationLink {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button.className).toContain("min-h-[44px]");
    expect(button.className).toContain("min-w-[44px]");
  });

  it("calls onNavigateToSource with sourceId and returnTo when tapped", () => {
    const onNavigate = vi.fn();
    render(<SourceCitationLink {...defaultProps} onNavigateToSource={onNavigate} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onNavigate).toHaveBeenCalledWith("src-1", "ask");
  });

  it("passes 'clips' as returnTo when specified", () => {
    const onNavigate = vi.fn();
    render(
      <SourceCitationLink {...defaultProps} returnTo="clips" onNavigateToSource={onNavigate} />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onNavigate).toHaveBeenCalledWith("src-1", "clips");
  });

  it("renders '[Source removed]' when sourceId is null", () => {
    render(<SourceCitationLink {...defaultProps} sourceId={null} />);

    const removedLabel = screen.getByText("[Source removed]");
    expect(removedLabel).toBeInTheDocument();
    expect(removedLabel.tagName).toBe("SPAN");
  });

  it("does not render a button when sourceId is null", () => {
    render(<SourceCitationLink {...defaultProps} sourceId={null} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not call onNavigateToSource when source is removed", () => {
    const onNavigate = vi.fn();
    render(
      <SourceCitationLink {...defaultProps} sourceId={null} onNavigateToSource={onNavigate} />,
    );

    // The [Source removed] text is not a button, so no click event to fire
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("has appropriate aria-label for accessibility", () => {
    render(<SourceCitationLink {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "View source: Workshop Notes March 2024");
  });

  it("has appropriate aria-label for removed source", () => {
    render(<SourceCitationLink {...defaultProps} sourceId={null} />);

    const label = screen.getByLabelText("Source has been removed");
    expect(label).toBeInTheDocument();
  });
});
