import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ClipCard, type ResearchClip } from "@/components/research/clip-card";

describe("ClipCard", () => {
  const baseClip: ResearchClip = {
    id: "clip-1",
    content: "Psychological safety was the strongest predictor of team performance.",
    sourceId: "src-1",
    sourceTitle: "Workshop Notes March 2024",
    sourceLocation: "Section 3",
    chapterId: "ch-4",
    chapterTitle: "Chapter 4: Case Studies",
    createdAt: new Date().toISOString(),
  };

  const defaultProps = {
    clip: baseClip,
    onInsert: vi.fn(),
    onDelete: vi.fn(),
    onViewSource: vi.fn(),
    canInsert: true,
  };

  it("renders clip content", () => {
    render(<ClipCard {...defaultProps} />);

    expect(screen.getByText(/Psychological safety/)).toBeInTheDocument();
  });

  it("renders source title as a tappable citation link", () => {
    render(<ClipCard {...defaultProps} />);

    const link = screen.getByRole("button", { name: /View source: Workshop Notes/ });
    expect(link).toBeInTheDocument();
  });

  it("calls onViewSource with sourceId and 'clips' returnTo when source title is tapped", () => {
    const onViewSource = vi.fn();
    render(<ClipCard {...defaultProps} onViewSource={onViewSource} />);

    fireEvent.click(screen.getByRole("button", { name: /View source:/ }));
    expect(onViewSource).toHaveBeenCalledWith("src-1", "clips", "Section 3");
  });

  it("shows '[Source removed]' when sourceId is null", () => {
    const clipWithoutSource: ResearchClip = { ...baseClip, sourceId: null };
    render(<ClipCard {...defaultProps} clip={clipWithoutSource} />);

    expect(screen.getByText("[Source removed]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View source:/ })).not.toBeInTheDocument();
  });

  it("shows chapter tag as compact 'Ch. N' label when assigned", () => {
    render(<ClipCard {...defaultProps} />);

    const tag = screen.getByTestId("chapter-tag");
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent("Ch. 4");
  });

  it("shows full title for non-standard chapter names", () => {
    const clip: ResearchClip = { ...baseClip, chapterTitle: "Introduction" };
    render(<ClipCard {...defaultProps} clip={clip} />);

    const tag = screen.getByTestId("chapter-tag");
    expect(tag).toHaveTextContent("Introduction");
  });

  it("truncates long non-standard chapter names", () => {
    const clip: ResearchClip = {
      ...baseClip,
      chapterTitle: "A Very Long Chapter Title That Exceeds Twenty Characters",
    };
    render(<ClipCard {...defaultProps} clip={clip} />);

    const tag = screen.getByTestId("chapter-tag");
    expect(tag.textContent!.length).toBeLessThanOrEqual(21); // 18 chars + "..."
  });

  it("does not show chapter tag when chapterTitle is null", () => {
    const clipNoChapter: ResearchClip = { ...baseClip, chapterId: null, chapterTitle: null };
    render(<ClipCard {...defaultProps} clip={clipNoChapter} />);

    expect(screen.queryByTestId("chapter-tag")).not.toBeInTheDocument();
  });

  it("truncates content longer than 300 chars with 'Show more'", () => {
    const longContent = "A".repeat(350);
    const longClip: ResearchClip = { ...baseClip, content: longContent };
    render(<ClipCard {...defaultProps} clip={longClip} />);

    // Should show truncated content with "..."
    expect(screen.getByText(/A{100,}\.{3}/)).toBeInTheDocument();
    expect(screen.getByText("Show more")).toBeInTheDocument();
  });

  it("expands content when 'Show more' is tapped", () => {
    const longContent = "A".repeat(350);
    const longClip: ResearchClip = { ...baseClip, content: longContent };
    render(<ClipCard {...defaultProps} clip={longClip} />);

    fireEvent.click(screen.getByText("Show more"));

    // Should now show full content
    expect(screen.getByText(longContent)).toBeInTheDocument();
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("does not truncate content 300 chars or shorter", () => {
    const shortContent = "B".repeat(300);
    const shortClip: ResearchClip = { ...baseClip, content: shortContent };
    render(<ClipCard {...defaultProps} clip={shortClip} />);

    expect(screen.queryByText("Show more")).not.toBeInTheDocument();
  });

  it("renders Insert button", () => {
    render(<ClipCard {...defaultProps} />);

    const insertBtn = screen.getByRole("button", { name: /Insert quote/ });
    expect(insertBtn).toBeInTheDocument();
  });

  it("calls onInsert when Insert button is tapped", () => {
    const onInsert = vi.fn();
    render(<ClipCard {...defaultProps} onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("button", { name: /Insert quote/ }));
    expect(onInsert).toHaveBeenCalledOnce();
  });

  it("disables Insert button when canInsert is false", () => {
    render(<ClipCard {...defaultProps} canInsert={false} />);

    const insertBtn = screen.getByRole("button", { name: /Insert quote/ });
    expect(insertBtn).toBeDisabled();
  });

  it("renders Delete button", () => {
    render(<ClipCard {...defaultProps} />);

    const deleteBtn = screen.getByRole("button", { name: "Delete clip" });
    expect(deleteBtn).toBeInTheDocument();
  });

  it("calls onDelete when Delete button is tapped", () => {
    const onDelete = vi.fn();
    render(<ClipCard {...defaultProps} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete clip" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("has 44pt minimum touch targets on action buttons", () => {
    render(<ClipCard {...defaultProps} />);

    const insertBtn = screen.getByRole("button", { name: /Insert quote/ });
    const deleteBtn = screen.getByRole("button", { name: "Delete clip" });

    expect(insertBtn.className).toContain("min-h-[44px]");
    expect(deleteBtn.className).toContain("min-h-[44px]");
  });

  describe("swipe-to-delete gesture", () => {
    it("reveals delete action behind card after swipe exceeding threshold", () => {
      render(<ClipCard {...defaultProps} />);

      const card = screen.getByTestId("clip-card");
      const swipeTarget = card.querySelector("[class*='transition-transform']")!;

      // Simulate swipe left > 60px threshold
      fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 300 }] });
      fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 230 }] });
      fireEvent.touchEnd(swipeTarget);

      // Card should be translated to reveal delete
      expect(swipeTarget).toHaveStyle("transform: translateX(-80px)");
    });

    it("does not reveal delete for small swipes below threshold", () => {
      render(<ClipCard {...defaultProps} />);

      const card = screen.getByTestId("clip-card");
      const swipeTarget = card.querySelector("[class*='transition-transform']")!;

      // Simulate small swipe < 60px threshold
      fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 300 }] });
      fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 260 }] });
      fireEvent.touchEnd(swipeTarget);

      // Card should snap back
      expect(swipeTarget).toHaveStyle("transform: translateX(-0px)");
    });

    it("calls onDelete when swipe-revealed delete button is tapped", () => {
      const onDelete = vi.fn();
      render(<ClipCard {...defaultProps} onDelete={onDelete} />);

      const card = screen.getByTestId("clip-card");
      const swipeTarget = card.querySelector("[class*='transition-transform']")!;

      // Swipe to reveal
      fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 300 }] });
      fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 230 }] });
      fireEvent.touchEnd(swipeTarget);

      // Tap the revealed delete button
      const swipeDeleteBtn = screen.getByRole("button", { name: "Swipe delete clip" });
      fireEvent.click(swipeDeleteBtn);
      expect(onDelete).toHaveBeenCalledOnce();
    });

    it("resets swipe on right swipe (dismissal)", () => {
      render(<ClipCard {...defaultProps} />);

      const card = screen.getByTestId("clip-card");
      const swipeTarget = card.querySelector("[class*='transition-transform']")!;

      // Swipe left first
      fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 300 }] });
      fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 230 }] });
      fireEvent.touchEnd(swipeTarget);
      expect(swipeTarget).toHaveStyle("transform: translateX(-80px)");

      // Now swipe right to dismiss
      fireEvent.touchStart(swipeTarget, { touches: [{ clientX: 220 }] });
      fireEvent.touchMove(swipeTarget, { touches: [{ clientX: 280 }] });
      fireEvent.touchEnd(swipeTarget);
      expect(swipeTarget).toHaveStyle("transform: translateX(-0px)");
    });
  });
});
