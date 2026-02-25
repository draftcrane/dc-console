"use client";

import { type ReactNode } from "react";
import { useDelayedUnmount } from "@/hooks/use-delayed-unmount";

/**
 * EditorPanel — Left-side persistent panel shell for the writing environment.
 *
 * ARIA: role="complementary" when persistent (desktop/landscape),
 * role="dialog" when displayed as a mobile overlay.
 *
 * Per Design Charter Section 6:
 * - Editor panel is on the LEFT (violet accent)
 * - Library panel is on the RIGHT (blue accent)
 * - 320px width, slides from left with 200ms ease-out
 *
 * This component provides the shell (header + close button). The content
 * is provided by the variant-specific component (ChapterEditorPanel or
 * future BookEditorPanel).
 *
 * Per Issue #317:
 * - Panel persists after accept/reject actions
 * - No conflict with iPad virtual keyboard (slides from left, not bottom)
 * - Uses --dc-color-interactive-escalation (violet) for panel identity
 */

interface EditorPanelProps {
  /** Whether the panel is currently open */
  isOpen: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Panel content (chapter-specific or book-specific) */
  children: ReactNode;
}

/**
 * Desktop/landscape persistent panel.
 * Hidden on portrait (< 1024px). Use EditorPanelOverlay for portrait.
 */
export function EditorPanel({ isOpen, onClose, children }: EditorPanelProps) {
  const { shouldRender, isClosing } = useDelayedUnmount(isOpen, 200);

  if (!shouldRender) return null;

  return (
    <div
      className={`hidden lg:flex editor-panel w-[320px] h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-background)] shrink-0
                  ${isClosing ? "editor-panel-slide-out" : "editor-panel-slide-in"}`}
      role="complementary"
      aria-label="Chapter editor"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--color-border)] shrink-0">
        <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Chapter Editor</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)] transition-colors
                     min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close editor panel"
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
      {children}
    </div>
  );
}

/**
 * Portrait/tablet overlay version of the editor panel.
 * Full-screen overlay with backdrop, slides in from the left.
 */
export function EditorPanelOverlay({ isOpen, onClose, children }: EditorPanelProps) {
  const { shouldRender, isClosing } = useDelayedUnmount(isOpen, 200);

  if (!shouldRender) return null;

  return (
    <>
      {/* Panel — non-modal so users can still select text in the editor */}
      <div
        className={`editor-panel-overlay fixed inset-y-0 left-0 z-50 w-full max-w-[380px]
                   bg-[var(--color-background)] shadow-xl flex flex-col lg:hidden
                   ${isClosing ? "editor-panel-slide-out" : "editor-panel-slide-in"}`}
        role="complementary"
        aria-label="Chapter editor"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Chapter Editor</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)] transition-colors
                       min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close editor panel"
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
        {children}

        {/* Safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </>
  );
}
