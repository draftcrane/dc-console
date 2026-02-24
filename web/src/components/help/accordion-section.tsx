"use client";

import { useState, useId, type ReactNode } from "react";

interface AccordionSectionProps {
  /** URL-friendly identifier for deep linking via hash */
  id: string;
  /** Section heading text */
  title: string;
  /** Icon rendered left of the title */
  icon: ReactNode;
  /** Whether the section starts expanded */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * AccordionSection - Collapsible FAQ section for the Help page (#343).
 *
 * Each section manages its own open/closed state independently.
 * Supports URL hash deep linking: navigating to /help#getting-started
 * auto-expands that section on mount.
 *
 * Animation uses grid-template-rows for smooth expand/collapse
 * (Safari 17.4+; snaps on older versions - acceptable progressive enhancement).
 *
 * Keyboard: Enter/Space toggle via native <button> behavior.
 * Touch target: 48px minimum height header row.
 */
export function AccordionSection({
  id,
  title,
  icon,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const reactId = useId();
  const headerId = `${reactId}-header`;
  const panelId = `${reactId}-panel`;

  const [isOpen, setIsOpen] = useState(() => {
    if (defaultOpen) return true;
    // Auto-expand if URL hash matches this section's id
    if (typeof window !== "undefined" && window.location.hash === `#${id}`) {
      return true;
    }
    return false;
  });

  return (
    <div id={id} className="border-b border-gray-200">
      <h3>
        <button
          id={headerId}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 py-4 text-left min-h-[48px]
                     text-base font-medium text-gray-900
                     hover:text-gray-700 transition-colors"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-500">
            {icon}
          </span>
          <span className="flex-1">{title}</span>
          <svg
            className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pb-4 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
