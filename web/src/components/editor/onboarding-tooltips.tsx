"use client";

import { useState, useEffect, useCallback } from "react";

const ONBOARDING_KEY = "dc_onboarding_completed";

interface OnboardingStep {
  /** Unique key for the step */
  key: string;
  /** Main text shown to the user */
  text: string;
  /** Which region of the editor this step points to */
  target: "editor" | "sidebar" | "text-selection" | "sources";
}

/**
 * The four onboarding steps per issue #38:
 * 1. "This is your chapter" - pointing at editor
 * 2. "Use the sidebar for chapters" - pointing at sidebar
 * 3. "Add documents" - pointing at sources/library
 * 4. "Select text for AI" - pointing at text area
 */
const STEPS: OnboardingStep[] = [
  {
    key: "chapter",
    text: "This is your chapter. Start writing here, or paste what you already have.",
    target: "editor",
  },
  {
    key: "sidebar",
    text: "Your chapters live here. Switch between them, add new ones, or drag to reorder.",
    target: "sidebar",
  },
  {
    key: "sources",
    text: "Your documents are here \u2014 anything you have added from Google Drive or your device.",
    target: "sources",
  },
  {
    key: "ai",
    text: "Your Editor is here. Select any text, then tap Editor for a rewrite.",
    target: "text-selection",
  },
];

/**
 * Clear onboarding completion state so the tour replays on next editor visit.
 * Called from the Help page "Replay the tour" action.
 */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // Silently fail if localStorage unavailable
  }
}

/**
 * OnboardingTooltips - First-time tooltip flow for the Writing Environment.
 *
 * Per Issue #38 + redesign (#337):
 * - 4 steps with pointer arrow, step label, smooth animations
 * - Stored in localStorage so tooltips only show once
 * - iPad-first: 44pt minimum touch targets
 * - Shadow: elevated layered shadow with subtle ring
 * - Width: 300px, max 100vw-32px
 * - Entrance: tooltip-enter animation from globals.css
 * - Step transitions: CSS opacity crossfade
 *
 * Positioning strategy:
 * - "editor" target: centered in the main content area
 * - "sidebar" target: positioned near the left sidebar
 * - "sources" target: near top-right Library button
 * - "text-selection" target: centered in the main content area
 *
 * The component uses fixed positioning with simple layout-based placement
 * rather than measuring DOM elements, for reliability across iPad Safari.
 */
export function OnboardingTooltips() {
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Check localStorage on mount - only show if not completed
  useEffect(() => {
    try {
      const completed = localStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        // Delay slightly so the editor has time to render
        const timer = setTimeout(() => setCurrentStep(0), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable (private browsing, etc.) - skip onboarding
    }
  }, []);

  /** Whether to skip animation delays for prefers-reduced-motion */
  const prefersReducedMotion = useCallback(() => {
    return (
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  const handleNext = useCallback(() => {
    if (isExiting) return;
    const delay = prefersReducedMotion() ? 0 : 150;

    setIsExiting(true);
    setTimeout(() => {
      setCurrentStep((prev) => {
        if (prev === null) return null;
        if (prev >= STEPS.length - 1) {
          try {
            localStorage.setItem(ONBOARDING_KEY, "true");
          } catch {
            // Silently fail if localStorage unavailable
          }
          return null;
        }
        return prev + 1;
      });
      setIsExiting(false);
    }, delay);
  }, [isExiting, prefersReducedMotion]);

  const handleSkip = useCallback(() => {
    if (isExiting) return;
    const delay = prefersReducedMotion() ? 0 : 150;

    setIsExiting(true);
    setTimeout(() => {
      try {
        localStorage.setItem(ONBOARDING_KEY, "true");
      } catch {
        // Silently fail
      }
      setCurrentStep(null);
      setIsExiting(false);
    }, delay);
  }, [isExiting, prefersReducedMotion]);

  if (currentStep === null || currentStep >= STEPS.length) {
    return null;
  }

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  // Position classes based on target
  const positionClasses = getPositionClasses(step.target);
  const arrowPosition = getArrowPosition(step.target);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {/* Semi-transparent backdrop to draw attention */}
      <div
        className="pointer-events-auto absolute inset-0 bg-black/20"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Tooltip card */}
      <div
        key={currentStep}
        className={`pointer-events-auto absolute ${positionClasses} ${isExiting ? "tooltip-exit" : "tooltip-enter"}`}
        role="dialog"
        aria-label={`Tip ${currentStep + 1} of ${STEPS.length}`}
        aria-live="polite"
      >
        <div
          className="relative w-[300px] max-w-[calc(100vw-32px)] rounded-xl bg-white p-5
                        shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04]"
        >
          {/* Pointer arrow */}
          <PointerArrow position={arrowPosition} />

          {/* Step label */}
          <p className="mb-2 text-xs text-gray-500">
            Step {currentStep + 1} of {STEPS.length}
          </p>

          {/* Progress dots */}
          <div className="mb-3 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === currentStep ? "w-6 bg-blue-600" : "w-1.5 bg-gray-300"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>

          {/* Step text */}
          <p className="mb-4 text-sm leading-relaxed text-gray-700">{step.text}</p>

          {/* Actions - 44pt minimum touch targets */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="min-h-[44px] px-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip
            </button>

            <button
              onClick={handleNext}
              className="min-h-[44px] min-w-[80px] rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 active:bg-gray-950"
            >
              {isLastStep ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Pointer arrow rendered as a CSS border triangle.
 * Positioned based on which edge the arrow should point from.
 */
type ArrowPosition = "top" | "left" | "right";

function PointerArrow({ position }: { position: ArrowPosition }) {
  const classes: Record<ArrowPosition, string> = {
    top: "absolute -top-2 left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white",
    left: "absolute top-6 -left-2 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-white",
    right:
      "absolute top-6 -right-2 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-white",
  };

  return <div className={classes[position]} aria-hidden="true" />;
}

/**
 * Returns Tailwind positioning classes based on which area the tooltip targets.
 * Uses safe, responsive positioning that works on iPad in both orientations.
 */
function getPositionClasses(target: OnboardingStep["target"]): string {
  switch (target) {
    case "editor":
      // Center of the content area, slightly above middle
      return "top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2";
    case "sidebar":
      // Near the left edge where the sidebar lives
      return "top-1/3 left-4 lg:left-[270px]";
    case "sources":
      // Near the top-right where the Library button is in the toolbar
      return "top-16 right-4 lg:right-[200px]";
    case "text-selection":
      // Center of the content area, slightly below middle
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    default:
      return "top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2";
  }
}

/**
 * Returns which edge the pointer arrow should appear on,
 * based on where the tooltip is positioned relative to its target.
 */
function getArrowPosition(target: OnboardingStep["target"]): ArrowPosition {
  switch (target) {
    case "editor":
      return "top";
    case "sidebar":
      return "left";
    case "sources":
      return "right";
    case "text-selection":
      return "top";
    default:
      return "top";
  }
}

export default OnboardingTooltips;
