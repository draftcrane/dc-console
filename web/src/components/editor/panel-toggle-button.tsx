"use client";

import type { ReactNode } from "react";

interface PanelToggleButtonProps {
  /** Button label text */
  label: string;
  /** Icon element */
  icon: ReactNode;
  /** Whether the associated panel is open */
  isOpen: boolean;
  /** Toggle handler */
  onToggle: () => void;
  /** Color zone — determines active-state palette */
  zone: "editor" | "library";
}

const zoneStyles = {
  editor: {
    active:
      "bg-[var(--dc-color-interactive-escalation-subtle)] text-[var(--dc-color-interactive-escalation)]",
    idle: "text-[var(--dc-color-text-muted)] hover:bg-[var(--dc-color-surface-tertiary)]",
  },
  library: {
    active:
      "bg-[var(--dc-color-interactive-primary-subtle)] text-[var(--dc-color-interactive-primary-on-subtle)]",
    idle: "text-[var(--dc-color-text-muted)] hover:bg-[var(--dc-color-surface-tertiary)]",
  },
};

/**
 * PanelToggleButton — Shared toggle for Editor and Library panel buttons.
 *
 * Standardizes touch targets (44px), color tokens, transition timing,
 * icon sizing, and label breakpoint across both panel toggles.
 */
export function PanelToggleButton({ label, icon, isOpen, onToggle, zone }: PanelToggleButtonProps) {
  const styles = zoneStyles[zone];

  return (
    <button
      onClick={onToggle}
      className={`min-h-[44px] px-2.5 flex items-center gap-1.5 rounded-lg text-sm font-medium
                 transition-colors duration-150 ease-in-out ${isOpen ? styles.active : styles.idle}`}
      aria-label={
        isOpen ? `Close ${label.toLowerCase()} panel` : `Open ${label.toLowerCase()} panel`
      }
      aria-pressed={isOpen}
    >
      <span className="w-5 h-5 shrink-0 [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
