"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";

// === localStorage Key ===

function getNudgeKey(projectId: string): string {
  return `research-nudge-dismissed-${projectId}`;
}

// === Exported Helpers (testable) ===

/**
 * Check if the nudge has been dismissed for a given project.
 * Returns true if the nudge should NOT be shown.
 */
export function isNudgeDismissed(projectId: string): boolean {
  try {
    return localStorage.getItem(getNudgeKey(projectId)) === "true";
  } catch {
    // localStorage unavailable (private browsing, etc.)
    return false;
  }
}

/**
 * Mark the nudge as dismissed for a given project.
 */
export function dismissNudge(projectId: string): void {
  try {
    localStorage.setItem(getNudgeKey(projectId), "true");
    emitNudgeChange();
  } catch {
    // localStorage unavailable -- silently ignore
  }
}

// === External Store for localStorage (avoids setState-in-effect lint errors) ===

let nudgeListeners: Array<() => void> = [];

function subscribeNudge(listener: () => void): () => void {
  nudgeListeners = [...nudgeListeners, listener];
  return () => {
    nudgeListeners = nudgeListeners.filter((l) => l !== listener);
  };
}

function emitNudgeChange() {
  for (const listener of nudgeListeners) {
    listener();
  }
}

function getServerSnapshot(): boolean {
  return false; // Assume not dismissed on server
}

// === Inner tooltip timer hook ===

/**
 * Manages the tooltip show/hide lifecycle with delay and auto-dismiss.
 * Only renders when the nudge is active (mounted conditionally).
 */
function useTooltipTimer(): {
  showTooltip: boolean;
  dismiss: () => void;
} {
  // Phase: "waiting" (500ms delay) -> "visible" (up to 8s) -> "dismissed"
  const [phase, setPhase] = useState<"waiting" | "visible" | "dismissed">("waiting");

  // 500ms show delay
  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = setTimeout(() => {
      setPhase("visible");
    }, 500);
    return () => clearTimeout(timer);
  }, [phase]);

  // 8s auto-dismiss
  useEffect(() => {
    if (phase !== "visible") return;
    const timer = setTimeout(() => {
      setPhase("dismissed");
    }, 8000);
    return () => clearTimeout(timer);
  }, [phase]);

  const dismiss = useCallback(() => {
    setPhase("dismissed");
  }, []);

  return {
    showTooltip: phase === "visible",
    dismiss,
  };
}

// === Hook: useFirstUseNudge ===

interface UseFirstUseNudgeOptions {
  projectId: string;
  hasAnySources: boolean;
  isResearchPanelOpen: boolean;
}

interface UseFirstUseNudgeResult {
  /** Whether to show the pulsing dot indicator on the Research button */
  showPulsingDot: boolean;
  /** Whether the nudge is active (controls tooltip timer mounting) */
  isActive: boolean;
  /** Call when the research panel opens to permanently dismiss */
  permanentlyDismiss: () => void;
}

/**
 * Manages the first-use nudge state for the Research Panel.
 *
 * The nudge appears when:
 * - The project has zero sources
 * - The Research Panel has never been opened (not dismissed in localStorage)
 *
 * The pulsing dot persists until the panel is opened.
 */
export function useFirstUseNudge({
  projectId,
  hasAnySources,
  isResearchPanelOpen,
}: UseFirstUseNudgeOptions): UseFirstUseNudgeResult {
  // Read dismissed state from localStorage via useSyncExternalStore
  const dismissed = useSyncExternalStore(
    subscribeNudge,
    () => isNudgeDismissed(projectId),
    () => getServerSnapshot(),
  );

  // Determine if the nudge should be active at all
  const isActive = !dismissed && !hasAnySources && !isResearchPanelOpen;

  // When the Research Panel opens, permanently dismiss the nudge via localStorage
  useEffect(() => {
    if (isResearchPanelOpen && !dismissed) {
      dismissNudge(projectId);
    }
  }, [isResearchPanelOpen, dismissed, projectId]);

  const permanentlyDismiss = useCallback(() => {
    dismissNudge(projectId);
  }, [projectId]);

  return {
    showPulsingDot: isActive,
    isActive,
    permanentlyDismiss,
  };
}

// === Pulsing Dot Component ===

/**
 * Small pulsing dot indicator overlaid on the Research button.
 * Uses CSS animation; respects prefers-reduced-motion (static dot instead).
 */
export function PulsingDot() {
  return (
    <span
      className="research-nudge-dot absolute -top-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-blue-500"
      aria-hidden="true"
    />
  );
}

// === Tooltip Component ===

interface FirstUseTooltipProps {
  targetRef: RefObject<HTMLButtonElement | null>;
  onDismiss: () => void;
}

/**
 * Tooltip rendered via createPortal, positioned below the Research toolbar button.
 * Dismisses on tap anywhere or after 8 seconds (handled by useTooltipTimer).
 */
function FirstUseTooltip({ targetRef, onDismiss }: FirstUseTooltipProps) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  // Calculate position relative to the target button
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    function updatePosition() {
      const rect = target!.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8, // 8px gap below button
        right: window.innerWidth - rect.right,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [targetRef]);

  if (!position) return null;

  return createPortal(
    <>
      {/* Invisible backdrop to capture taps */}
      <div
        className="fixed inset-0 z-[90]"
        onClick={onDismiss}
        onTouchStart={onDismiss}
        aria-hidden="true"
      />

      {/* Tooltip */}
      <div
        className="fixed z-[91] w-56 rounded-xl bg-gray-900 px-4 py-3 shadow-lg"
        style={{
          top: `${position.top}px`,
          right: `${position.right}px`,
        }}
        role="tooltip"
        aria-live="polite"
      >
        {/* Arrow pointing up */}
        <div
          className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 bg-gray-900"
          aria-hidden="true"
        />
        <p className="relative text-sm leading-relaxed text-white">
          Have research files? Tap here to bring them in.
        </p>
      </div>
    </>,
    document.body,
  );
}

// === Tooltip Controller ===

/**
 * Internal component that manages the tooltip timer lifecycle.
 * Mounted only when the nudge is active, so unmounting = timer cleanup.
 * Uses a key prop from the parent to reset state when conditions change.
 */
function TooltipController({ targetRef }: { targetRef: RefObject<HTMLButtonElement | null> }) {
  const { showTooltip, dismiss } = useTooltipTimer();

  if (!showTooltip) return null;

  return <FirstUseTooltip targetRef={targetRef} onDismiss={dismiss} />;
}

// === Main FirstUseNudge Component ===

interface FirstUseNudgeProps {
  projectId: string;
  hasAnySources: boolean;
  isResearchPanelOpen: boolean;
  targetRef: RefObject<HTMLButtonElement | null>;
}

/**
 * FirstUseNudge - Shows a tooltip on the Research toolbar button when the project
 * has no sources and the panel has never been opened.
 *
 * Per design spec Section 5 (First-Use Experience) and Section 7 (Component Spec):
 * - Appears once per project, only when project has zero sources
 * - Dismisses on tap anywhere, or after 8 seconds
 * - Pulsing dot persists until panel is opened for first time
 * - State stored in localStorage: research-nudge-dismissed-{projectId}
 * - Uses createPortal to render above other content
 * - Pulsing dot: CSS animation, prefers-reduced-motion disables animation
 */
export function FirstUseNudge({
  projectId,
  hasAnySources,
  isResearchPanelOpen,
  targetRef,
}: FirstUseNudgeProps) {
  const { isActive } = useFirstUseNudge({
    projectId,
    hasAnySources,
    isResearchPanelOpen,
  });

  // TooltipController is only mounted when active.
  // Unmounting resets the timer state automatically.
  if (!isActive) return null;

  return <TooltipController targetRef={targetRef} />;
}
