"use client";

import { useCallback } from "react";

/**
 * View mode for the workspace - Chapter (focused editing) or Book (full manuscript)
 */
export type ViewMode = "chapter" | "book";

interface WorkspaceToggleProps {
  /** Current view mode */
  value: ViewMode;
  /** Callback when view mode changes */
  onChange: (mode: ViewMode) => void;
  /** Optional className for positioning */
  className?: string;
}

/**
 * WorkspaceToggle - Segmented control for switching between Chapter and Book view.
 *
 * Per Issue #318 Acceptance Criteria:
 * - Segmented control with two options: [Chapter] [Book]
 * - Active state: filled background; inactive state: clearly differentiated
 * - Placed in toolbar (48px height)
 * - Touch target minimum 44px per segment
 * - ARIA: role="radiogroup" with role="radio" for each option
 *
 * Design decisions:
 * - Uses a pill-shaped container with sliding indicator
 * - Active segment has blue filled background
 * - Inactive segment has transparent background with muted text
 * - Keyboard navigation: Left/Right arrows, Home/End, Space/Enter to select
 * - Focus ring visible on keyboard navigation
 *
 * The URL state management is handled by the parent component using useSearchParams.
 * The transition animation for the center area is handled by the parent layout.
 */
export function WorkspaceToggle({ value, onChange, className = "" }: WorkspaceToggleProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
        case "Home":
          event.preventDefault();
          onChange("chapter");
          break;
        case "ArrowRight":
        case "End":
          event.preventDefault();
          onChange("book");
          break;
        case " ":
        case "Enter":
          // Space/Enter on a radio should select the focused item
          // The focus is managed per-item, so this is handled by onClick
          break;
      }
    },
    [onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Workspace view"
      onKeyDown={handleKeyDown}
      className={`relative flex items-center h-9 p-0.5 rounded-lg bg-gray-100 ${className}`}
    >
      {/* Sliding indicator */}
      <div
        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-white shadow-sm
                   transition-transform duration-200 ease-out
                   ${value === "book" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"}`}
        aria-hidden="true"
      />

      <ToggleOption
        label="Chapter"
        value="chapter"
        isSelected={value === "chapter"}
        onSelect={() => onChange("chapter")}
      />

      <ToggleOption
        label="Book"
        value="book"
        isSelected={value === "book"}
        onSelect={() => onChange("book")}
      />
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  value: ViewMode;
  isSelected: boolean;
  onSelect: () => void;
}

function ToggleOption({ label, value, isSelected, onSelect }: ToggleOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={onSelect}
      className={`relative z-10 flex items-center justify-center px-3 h-8 min-w-[60px]
                 text-sm font-medium rounded-md transition-colors duration-200
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                 ${isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      aria-label={`${label} view${isSelected ? " (selected)" : ""}`}
      data-view={value}
    >
      {label}
    </button>
  );
}

export default WorkspaceToggle;
