import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorSidebar } from "@/components/editor/editor-sidebar";

/**
 * Tests for EditorSidebar — the responsive sidebar wrapper.
 *
 * The component renders:
 * - A desktop sidebar (hidden on mobile via lg:block)
 * - A mobile sidebar (hidden on desktop via lg:hidden) with:
 *   - A collapsed pill sidebar
 *   - A SidebarOverlay for the full sidebar
 *
 * Mock strategy: We mock the Sidebar and SidebarOverlay components since they
 * have complex drag-and-drop dependencies. We verify the component's rendering
 * structure and prop forwarding.
 */

// Mock the Sidebar and SidebarOverlay components
vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({
    collapsed,
    activeChapterId,
    totalWordCount,
  }: {
    collapsed: boolean;
    activeChapterId: string | undefined;
    totalWordCount: number;
  }) => (
    <div
      data-testid={collapsed ? "sidebar-collapsed" : "sidebar-expanded"}
      data-active-chapter={activeChapterId}
      data-word-count={totalWordCount}
    >
      Sidebar ({collapsed ? "collapsed" : "expanded"})
    </div>
  ),
  SidebarOverlay: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="sidebar-overlay" data-open={isOpen}>
      {children}
    </div>
  ),
}));

function makeProps(overrides?: Partial<React.ComponentProps<typeof EditorSidebar>>) {
  return {
    chapters: [
      { id: "ch-1", title: "Chapter 1", wordCount: 100, sortOrder: 1 },
      { id: "ch-2", title: "Chapter 2", wordCount: 200, sortOrder: 2 },
    ],
    activeChapterId: "ch-1",
    onChapterSelect: vi.fn(),
    onAddChapter: vi.fn(),
    onDeleteChapter: vi.fn(),
    onChapterRename: vi.fn(),
    onChapterReorder: vi.fn(),
    totalWordCount: 300,
    activeChapterWordCount: 100,
    sidebarCollapsed: false,
    onToggleSidebarCollapsed: vi.fn(),
    mobileOverlayOpen: false,
    onOpenMobileOverlay: vi.fn(),
    onCloseMobileOverlay: vi.fn(),
    ...overrides,
  };
}

describe("EditorSidebar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────
  // Desktop sidebar
  // ────────────────────────────────────────────

  it("renders a desktop sidebar in a hidden-on-mobile container", () => {
    const { container } = render(<EditorSidebar {...makeProps()} />);

    // Desktop container has lg:block class
    const desktopContainer = container.querySelector(".lg\\:block");
    expect(desktopContainer).toBeInTheDocument();
  });

  it("desktop sidebar respects the collapsed prop", () => {
    const { container } = render(<EditorSidebar {...makeProps({ sidebarCollapsed: true })} />);

    // Desktop container should have a collapsed sidebar
    const desktopContainer = container.querySelector(".lg\\:block");
    expect(desktopContainer).toBeInTheDocument();
    const collapsed = desktopContainer!.querySelector('[data-testid="sidebar-collapsed"]');
    expect(collapsed).toBeInTheDocument();
  });

  it("desktop sidebar is expanded when not collapsed", () => {
    const { container } = render(<EditorSidebar {...makeProps({ sidebarCollapsed: false })} />);

    const desktopContainer = container.querySelector(".lg\\:block");
    const expanded = desktopContainer!.querySelector('[data-testid="sidebar-expanded"]');
    expect(expanded).toBeInTheDocument();
  });

  // ────────────────────────────────────────────
  // Mobile sidebar
  // ────────────────────────────────────────────

  it("renders a mobile sidebar in a hidden-on-desktop container", () => {
    const { container } = render(<EditorSidebar {...makeProps()} />);

    // Mobile container has lg:hidden class
    const mobileContainer = container.querySelector(".lg\\:hidden");
    expect(mobileContainer).toBeInTheDocument();
  });

  it("mobile sidebar always renders a collapsed pill", () => {
    const { container } = render(<EditorSidebar {...makeProps()} />);

    const mobileContainer = container.querySelector(".lg\\:hidden");
    // The direct child collapsed sidebar (not the one in the overlay)
    const collapsedPills = mobileContainer!.querySelectorAll('[data-testid="sidebar-collapsed"]');
    expect(collapsedPills.length).toBeGreaterThanOrEqual(1);
  });

  it("mobile overlay contains an expanded sidebar", () => {
    render(<EditorSidebar {...makeProps({ mobileOverlayOpen: true })} />);

    const overlay = screen.getByTestId("sidebar-overlay");
    expect(overlay).toHaveAttribute("data-open", "true");

    // The overlay always contains an expanded sidebar
    const expandedInOverlay = overlay.querySelector('[data-testid="sidebar-expanded"]');
    expect(expandedInOverlay).toBeInTheDocument();
  });

  it("mobile overlay is marked as closed when not open", () => {
    render(<EditorSidebar {...makeProps({ mobileOverlayOpen: false })} />);

    const overlay = screen.getByTestId("sidebar-overlay");
    expect(overlay).toHaveAttribute("data-open", "false");
  });

  // ────────────────────────────────────────────
  // Prop forwarding
  // ────────────────────────────────────────────

  it("forwards activeChapterId to sidebars", () => {
    render(<EditorSidebar {...makeProps({ activeChapterId: "ch-2" })} />);

    // Check that the active chapter was passed to all sidebar instances
    const sidebarElements = screen.getAllByTestId(/sidebar-(collapsed|expanded)/);
    const withActiveChapter = sidebarElements.filter(
      (el) => el.getAttribute("data-active-chapter") === "ch-2",
    );
    expect(withActiveChapter.length).toBeGreaterThan(0);
  });

  it("forwards totalWordCount to sidebars", () => {
    render(<EditorSidebar {...makeProps({ totalWordCount: 5000 })} />);

    const sidebarElements = screen.getAllByTestId(/sidebar-(collapsed|expanded)/);
    const withWordCount = sidebarElements.filter(
      (el) => el.getAttribute("data-word-count") === "5000",
    );
    expect(withWordCount.length).toBeGreaterThan(0);
  });
});
