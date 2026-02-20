import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ResultCard } from "@/components/research/result-card";

/**
 * Tests for ResultCard — displays a search result passage with source attribution and actions.
 *
 * Key requirements per design spec:
 * - Passage text, source title (tappable link), source location
 * - "Save to Clips" action (updates to checkmark "Saved")
 * - "Insert" action (inserts at editor cursor with footnote)
 * - 44pt minimum touch targets for action buttons
 * - Source title navigates to Source Detail View
 */

function makeProps(overrides?: Partial<React.ComponentProps<typeof ResultCard>>) {
  return {
    content: "This is a test passage about leadership and team performance.",
    sourceTitle: "Workshop Notes March 2024",
    sourceId: "src-1",
    sourceLocation: "Page 5",
    onSaveToClips: vi.fn().mockResolvedValue(undefined),
    onInsert: vi.fn(),
    onViewSource: vi.fn(),
    isSaved: false,
    canInsert: true,
    ...overrides,
  };
}

describe("ResultCard", () => {
  it("renders passage text", () => {
    render(<ResultCard {...makeProps()} />);

    expect(
      screen.getByText(/This is a test passage about leadership and team performance/),
    ).toBeInTheDocument();
  });

  it("renders source title as tappable link when sourceId exists", () => {
    const onViewSource = vi.fn();
    render(<ResultCard {...makeProps({ onViewSource })} />);

    const sourceButton = screen.getByText("Workshop Notes March 2024");
    expect(sourceButton.tagName).toBe("BUTTON");

    fireEvent.click(sourceButton);
    expect(onViewSource).toHaveBeenCalledTimes(1);
  });

  it("renders source title as plain text when sourceId is null", () => {
    render(<ResultCard {...makeProps({ sourceId: null })} />);

    const sourceSpan = screen.getByText("Workshop Notes March 2024");
    expect(sourceSpan.tagName).toBe("SPAN");
  });

  it("renders source location", () => {
    render(<ResultCard {...makeProps()} />);

    expect(screen.getByText("Page 5")).toBeInTheDocument();
  });

  it("does not render source location separator when null", () => {
    render(<ResultCard {...makeProps({ sourceLocation: null })} />);

    // The pipe separator should not be present
    const separators = screen.queryAllByText("|");
    expect(separators).toHaveLength(0);
  });

  it("shows 'Save to Clips' button", () => {
    render(<ResultCard {...makeProps()} />);

    expect(screen.getByText("Save to Clips")).toBeInTheDocument();
  });

  it("calls onSaveToClips and shows 'Saved' state", async () => {
    const onSaveToClips = vi.fn().mockResolvedValue(undefined);
    render(<ResultCard {...makeProps({ onSaveToClips })} />);

    const saveButton = screen.getByText("Save to Clips");
    fireEvent.click(saveButton);

    expect(onSaveToClips).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
  });

  it("shows 'Saved' state when isSaved prop is true", () => {
    render(<ResultCard {...makeProps({ isSaved: true })} />);

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("Save to Clips")).not.toBeInTheDocument();
  });

  it("save button disabled when already saved", () => {
    render(<ResultCard {...makeProps({ isSaved: true })} />);

    const button = screen.getByRole("button", { name: "Saved to clips" });
    expect(button).toBeDisabled();
  });

  it("shows 'Insert' button", () => {
    render(<ResultCard {...makeProps()} />);

    expect(screen.getByText("Insert")).toBeInTheDocument();
  });

  it("calls onInsert when Insert button is clicked", () => {
    const onInsert = vi.fn();
    render(<ResultCard {...makeProps({ onInsert })} />);

    const insertButton = screen.getByText("Insert");
    fireEvent.click(insertButton);

    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it("shows 'Inserted' feedback after Insert click", async () => {
    vi.useFakeTimers();
    const onInsert = vi.fn();
    render(<ResultCard {...makeProps({ onInsert })} />);

    const insertButton = screen.getByText("Insert");
    fireEvent.click(insertButton);

    expect(screen.getByText("Inserted")).toBeInTheDocument();

    // Revert after 1.5s
    await act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("Insert")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("Insert button disabled when canInsert is false", () => {
    render(<ResultCard {...makeProps({ canInsert: false })} />);

    const insertButton = screen.getByRole("button", {
      name: "Insert into chapter with footnote",
    });
    expect(insertButton).toBeDisabled();
  });

  it("has proper aria labels for action buttons", () => {
    render(<ResultCard {...makeProps()} />);

    expect(screen.getByRole("button", { name: "Save to clips" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Insert into chapter with footnote" }),
    ).toBeInTheDocument();
  });

  it("renders with data-testid for integration testing", () => {
    render(<ResultCard {...makeProps()} />);

    expect(screen.getByTestId("result-card")).toBeInTheDocument();
  });
});
