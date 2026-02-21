"use client";

import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useResearchPanel, type ResearchTab } from "./research-panel-provider";
import { SourcesTab } from "./sources-tab";
import { AskTab } from "./ask-tab";
import { ClipsTab } from "./clips-tab";
import { useResearchClips } from "@/hooks/use-research-clips";
import type { InsertResult } from "@/hooks/use-clip-insert";

// === Tab Definitions ===

const TABS: Array<{ id: ResearchTab; label: string }> = [
  { id: "sources", label: "Sources" },
  { id: "ask", label: "Ask" },
  { id: "clips", label: "Clips" },
];

// === Panel Layout Mode ===

/**
 * Determines the panel display mode based on viewport width.
 * - "side": 1024pt+ landscape, panel pushes editor (340pt wide)
 * - "overlay": below 1024pt, panel overlays at 85% width
 */
function useLayoutMode() {
  const [mode, setMode] = useState<"side" | "overlay">("side");

  useEffect(() => {
    function check() {
      setMode(window.innerWidth >= 1024 ? "side" : "overlay");
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return mode;
}

// === Focus Trap Hook (overlay mode) ===

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = container!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, enabled]);
}

// === Swipe-to-Dismiss Hook ===

function useSwipeToDismiss(
  elementRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  onDismiss: () => void,
) {
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const el = elementRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchCurrentX.current = e.touches[0].clientX;
      isSwiping.current = true;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!isSwiping.current) return;
      touchCurrentX.current = e.touches[0].clientX;
      const delta = touchCurrentX.current - touchStartX.current;
      // Only allow swiping right (positive delta)
      if (delta > 0) {
        el!.style.transform = `translateX(${delta}px)`;
      }
    }

    function handleTouchEnd() {
      if (!isSwiping.current) return;
      isSwiping.current = false;
      const delta = touchCurrentX.current - touchStartX.current;
      if (delta > 60) {
        onDismiss();
      }
      el!.style.transform = "";
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [elementRef, enabled, onDismiss]);
}

// === Keyboard Shortcuts Hook ===

function useKeyboardShortcuts(
  isOpen: boolean,
  openPanel: (tab?: ResearchTab) => void,
  closePanel: () => void,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) toggles panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
        e.preventDefault();
        if (isOpen) {
          closePanel();
        } else {
          openPanel();
        }
      }
      // Escape closes panel
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closePanel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openPanel, closePanel]);
}

// === Tab Bar Component ===

function TabBar({
  activeTab,
  onTabChange,
  clipCount,
}: {
  activeTab: ResearchTab;
  onTabChange: (tab: ResearchTab) => void;
  clipCount: number;
}) {
  return (
    <div role="tablist" aria-label="Research tabs" className="flex border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          id={`research-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`research-tabpanel-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 h-11 text-base font-medium transition-colors relative
            ${
              activeTab === tab.id
                ? "text-foreground border-b-2 border-blue-600"
                : "text-muted-foreground hover:text-foreground"
            }`}
        >
          {tab.label}
          {tab.id === "clips" && clipCount > 0 && (
            <span
              className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                         text-[10px] font-semibold leading-none rounded-full bg-blue-600 text-white"
              aria-label={`${clipCount} clips`}
            >
              {clipCount > 99 ? "99+" : clipCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// === Tab Content Component ===

function TabContent({
  activeTab,
  onInsertClip,
  canInsert,
  activeChapterTitle,
}: {
  activeTab: ResearchTab;
  onInsertClip: (text: string, sourceTitle: string) => InsertResult;
  canInsert: boolean;
  activeChapterTitle?: string;
}) {
  // Render all tabs but only show the active one.
  // This preserves state when switching tabs (acceptance criteria).
  return (
    <div className="flex-1 min-h-0 relative">
      <TabPanel id="sources" activeTab={activeTab}>
        <SourcesTab
          onInsertContent={onInsertClip}
          canInsert={canInsert}
          activeChapterTitle={activeChapterTitle}
        />
      </TabPanel>
      <TabPanel id="ask" activeTab={activeTab}>
        <AskTab />
      </TabPanel>
      <TabPanel id="clips" activeTab={activeTab}>
        <ClipsTab onInsertClip={onInsertClip} canInsert={canInsert} />
      </TabPanel>
    </div>
  );
}

function TabPanel({
  id,
  activeTab,
  children,
}: {
  id: ResearchTab;
  activeTab: ResearchTab;
  children: ReactNode;
}) {
  const isActive = activeTab === id;
  return (
    <div
      role="tabpanel"
      id={`research-tabpanel-${id}`}
      aria-labelledby={`research-tab-${id}`}
      className={`absolute inset-0 flex flex-col ${isActive ? "" : "hidden"}`}
      tabIndex={isActive ? 0 : -1}
    >
      {children}
    </div>
  );
}

// === Main Research Panel Component ===

export interface ResearchPanelProps {
  onInsertClip?: (text: string, sourceTitle: string) => InsertResult;
  canInsert?: boolean;
  activeChapterTitle?: string;
}

export function ResearchPanel({
  onInsertClip,
  canInsert = false,
  activeChapterTitle,
}: ResearchPanelProps) {
  const { isOpen, activeTab, setActiveTab, closePanel, openPanel } = useResearchPanel();
  const params = useParams();
  const projectId = params.projectId as string;

  // Fetch clip count for badge display
  const { clipCount, fetchClips } = useResearchClips(projectId);

  // Fetch clips when panel opens to update badge count
  useEffect(() => {
    if (isOpen && projectId) {
      fetchClips();
    }
  }, [isOpen, projectId, fetchClips]);

  const handleInsertClip = useCallback(
    (text: string, sourceTitle: string): InsertResult => {
      if (onInsertClip) return onInsertClip(text, sourceTitle);
      return "no-editor";
    },
    [onInsertClip],
  );

  const layoutMode = useLayoutMode();
  const panelRef = useRef<HTMLDivElement>(null);
  const isOverlay = layoutMode === "overlay";

  // Keyboard shortcuts
  useKeyboardShortcuts(isOpen, openPanel, closePanel);

  // Focus trap in overlay mode
  useFocusTrap(panelRef, isOpen && isOverlay);

  // Swipe-to-dismiss in overlay mode
  const handleDismiss = useCallback(() => {
    closePanel();
  }, [closePanel]);
  useSwipeToDismiss(panelRef, isOpen && isOverlay, handleDismiss);

  // Focus the panel when it opens in overlay mode
  useEffect(() => {
    if (isOpen && isOverlay && panelRef.current) {
      // Focus the first focusable element after a short delay
      const timer = setTimeout(() => {
        const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isOverlay]);

  if (!isOpen) return null;

  // Side panel mode (1024pt+ landscape)
  if (!isOverlay) {
    return (
      <div
        ref={panelRef}
        id="research-panel"
        role="complementary"
        aria-label="Research panel"
        className="research-panel w-[340px] shrink-0 border-l border-border bg-background flex flex-col
                   research-panel-slide-in"
      >
        <PanelHeader onClose={closePanel} />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} clipCount={clipCount} />
        <TabContent
          activeTab={activeTab}
          onInsertClip={handleInsertClip}
          canInsert={canInsert}
          activeChapterTitle={activeChapterTitle}
        />
      </div>
    );
  }

  // Overlay mode (portrait / narrow viewports)
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 research-backdrop-fade-in"
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Overlay panel */}
      <div
        ref={panelRef}
        id="research-panel"
        role="complementary"
        aria-label="Research panel"
        className="research-panel-overlay fixed top-0 right-0 bottom-0 w-[85%] z-50
                   bg-background flex flex-col shadow-xl research-panel-slide-in"
      >
        <PanelHeader onClose={closePanel} />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} clipCount={clipCount} />
        <TabContent
          activeTab={activeTab}
          onInsertClip={handleInsertClip}
          canInsert={canInsert}
          activeChapterTitle={activeChapterTitle}
        />
      </div>
    </>
  );
}

// === Panel Header ===

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between h-12 px-4 shrink-0">
      <h2 className="text-base font-semibold text-foreground">Research</h2>
      <button
        onClick={onClose}
        className="w-11 h-11 flex items-center justify-center rounded-lg
                   text-muted-foreground hover:text-foreground hover:bg-gray-100
                   transition-colors"
        aria-label="Close research panel"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
