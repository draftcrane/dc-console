import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClipCard } from "../clip-card";
import type { ResearchClip } from "@/hooks/use-research-clips";

// Mock @clerk/nextjs since the component doesn't use it directly but it may be required
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: vi.fn() }),
}));

function makeClip(overrides: Partial<ResearchClip> = {}): ResearchClip {
  return {
    id: "clip-1",
    projectId: "project-1",
    sourceId: "source-1",
    chapterId: null,
    sourceTitle: "Interview Notes",
    snippetText: "This is a short snippet.",
    chapterTitle: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ClipCard", () => {
  it("renders snippet text and source title", () => {
    const clip = makeClip();
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    expect(screen.getByText("This is a short snippet.")).toBeInTheDocument();
    expect(screen.getByText("Interview Notes")).toBeInTheDocument();
  });

  it("shows '[Source removed]' when sourceId is null", () => {
    const clip = makeClip({ sourceId: null });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    expect(screen.getByText("[Source removed]")).toBeInTheDocument();
  });

  it("source title is not tappable when sourceId is null", () => {
    const clip = makeClip({ sourceId: null });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    const removed = screen.getByText("[Source removed]");
    expect(removed.tagName).toBe("SPAN"); // span, not button
  });

  it("source title is tappable when sourceId exists", () => {
    const onSourceTap = vi.fn();
    const clip = makeClip();
    render(<ClipCard clip={clip} onDelete={vi.fn()} onSourceTap={onSourceTap} />);

    const sourceButton = screen.getByText("Interview Notes");
    expect(sourceButton.tagName).toBe("BUTTON");
    fireEvent.click(sourceButton);
    expect(onSourceTap).toHaveBeenCalledWith("source-1");
  });

  it("truncates text over 300 chars with 'Show more' toggle", () => {
    const longText = "A".repeat(350);
    const clip = makeClip({ snippetText: longText });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    // Should show truncated text
    expect(screen.getByText("Show more")).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("Show more"));
    expect(screen.getByText("Show less")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText("Show less"));
    expect(screen.getByText("Show more")).toBeInTheDocument();
  });

  it("does not show 'Show more' for text under 300 chars", () => {
    const clip = makeClip({ snippetText: "Short text" });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    expect(screen.queryByText("Show more")).not.toBeInTheDocument();
  });

  it("displays chapter tag as compact label", () => {
    const clip = makeClip({ chapterId: "ch-1", chapterTitle: "Chapter 3: Discussion" });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    expect(screen.getByText("Ch. 3")).toBeInTheDocument();
  });

  it("truncates non-standard chapter title at 20 chars", () => {
    const clip = makeClip({
      chapterId: "ch-1",
      chapterTitle: "A Very Long Chapter Title That Exceeds Twenty Characters",
    });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    expect(screen.getByText("A Very Long Chapter ...")).toBeInTheDocument();
  });

  it("does not show chapter tag when chapterId is null", () => {
    const clip = makeClip({ chapterId: null, chapterTitle: null });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    expect(screen.queryByText(/Ch\./)).not.toBeInTheDocument();
  });

  it("calls onDelete when overflow menu delete is clicked", () => {
    const onDelete = vi.fn();
    const clip = makeClip();
    render(<ClipCard clip={clip} onDelete={onDelete} />);

    // Open overflow menu
    fireEvent.click(screen.getByLabelText("Clip actions"));

    // Click delete
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("clip-1");
  });

  it("displays formatted date", () => {
    const clip = makeClip({ createdAt: new Date().toISOString() });
    render(<ClipCard clip={clip} onDelete={vi.fn()} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("all action buttons meet 44pt minimum height", () => {
    const clip = makeClip({ sourceId: "src-1", snippetText: "A".repeat(400) });
    render(<ClipCard clip={clip} onDelete={vi.fn()} onSourceTap={vi.fn()} />);

    // Source title button
    const sourceBtn = screen.getByText("Interview Notes");
    expect(sourceBtn.style.minHeight).toBe("44px");

    // Overflow menu button
    const menuBtn = screen.getByLabelText("Clip actions");
    expect(menuBtn.style.minHeight).toBe("44px");

    // Show more button
    const showMore = screen.getByText("Show more");
    expect(showMore.style.minHeight).toBe("44px");
  });
});
