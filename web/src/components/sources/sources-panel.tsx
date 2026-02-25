"use client";

import { useMemo } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { LibraryTab } from "./library-tab";
import { DeskTab } from "./desk-tab";
import type { SourcesTab } from "@/hooks/use-sources-panel";

/**
 * Main Sources panel container.
 * Shell: fixed header (tab bar + close button) + scrollable content area.
 * Width: w-[320px] on desktop, full on overlay.
 */
export function SourcesPanel() {
  const { activeTab, setActiveTab, closePanel, isPanelOpen, sources } = useSourcesContext();

  const deskCount = useMemo(() => sources.filter((s) => s.status === "active").length, [sources]);

  const tabs: { id: SourcesTab; label: string }[] = useMemo(
    () => [
      { id: "library", label: "Library" },
      { id: "desk", label: deskCount > 0 ? `Desk (${deskCount})` : "Desk" },
    ],
    [deskCount],
  );

  if (!isPanelOpen) return null;

  return (
    <div className="hidden lg:flex sources-panel w-[320px] h-full flex-col border-l border-border bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-8 px-3 text-xs font-medium rounded-md transition-colors min-h-[32px]
                         ${
                           activeTab === tab.id
                             ? "bg-[var(--dc-color-interactive-primary-subtle)] text-[var(--dc-color-interactive-primary-on-subtle)]"
                             : "text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-primary)] hover:bg-[var(--dc-color-surface-secondary)]"
                         }`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={closePanel}
          className="p-1.5 text-[var(--dc-color-text-placeholder)] hover:text-[var(--dc-color-text-muted)] transition-colors
                     min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close library panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex flex-col">
        {activeTab === "library" && <LibraryTab />}
        {activeTab === "desk" && <DeskTab />}
      </div>
    </div>
  );
}
