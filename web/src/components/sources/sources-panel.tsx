"use client";

import { useSourcesContext } from "@/contexts/sources-context";
import { LibraryTab } from "./library-tab";
import { AssistTab } from "./assist-tab";
import type { SourcesTab } from "@/hooks/use-sources-panel";

const TABS: { id: SourcesTab; label: string }[] = [
  { id: "sources", label: "Library" },
  { id: "ask", label: "Ask" },
];

/**
 * Main Sources panel container.
 * Shell: fixed header (tab bar + close button) + scrollable content area.
 * Width: w-[320px] on desktop, full on overlay.
 */
export function SourcesPanel() {
  const { activeTab, setActiveTab, closePanel, isPanelOpen } = useSourcesContext();

  if (!isPanelOpen) return null;

  return (
    <div className="hidden lg:flex sources-panel w-[320px] h-full flex-col border-l border-border bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-8 px-3 text-xs font-medium rounded-md transition-colors min-h-[32px]
                         ${
                           activeTab === tab.id
                             ? "bg-blue-50 text-blue-700"
                             : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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
          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors
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
        {activeTab === "sources" && <LibraryTab />}
        {activeTab === "ask" && <AssistTab />}
      </div>
    </div>
  );
}
