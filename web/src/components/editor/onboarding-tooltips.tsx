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
 * The three onboarding steps per issue #38:
 * 1. "This is your chapter" - pointing at editor
 * 2. "Use the sidebar for chapters" - pointing at sidebar
 * 3. "Select text for AI" - pointing at text area
 */
const STEPS: OnboardingStep[] = [
  {
    key: "chapter",
    text: "This is your chapter. Start writing here, or paste what you already have.",
    target: "editor",
  },
  {
    key: "sidebar",
    text: "Use the sidebar to switch between chapters or add new ones.",
    target: "sidebar",
  },
  {
    key: "sources",
    text: "Add documents from Google Drive or your device.",
    target: "sources",
  },
  {
    key: "ai",
    text: "Select any text to get AI suggestions for rewriting.",
    target: "text-selection",
  },
];

/**
 * OnboardingTooltips - First-time tooltip flow for the Writing Environment.
 *
 * Per Issue #38:
 * - 3 steps max
 * - Small floating card with text and Next/Done buttons
 * - Stored in localStorage so tooltips only show once
 * - iPad-first: 44pt minimum touch targets
 *
 * Positioning strategy:
 * - "editor" target: centered in the main content area
 * - "sidebar" target: positioned near the left sidebar
 * - "text-selection" target: centered in the main content area
 *
 * The component uses fixed positioning with simple layout-based placement
 * rather than measuring DOM elements, for reliability across iPad Safari.
 */
export function OnboardingTooltips() {
  const [currentStep, setCurrentStep] = useState<number | null>(null);

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

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === null) return null;
      if (prev >= STEPS.length - 1) {
        // Mark onboarding as complete
        try {
          localStorage.setItem(ONBOARDING_KEY, "true");
        } catch {
          // Silently fail if localStorage unavailable
        }
        return null;
      }
      return prev + 1;
    });
  }, []);

  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
      // Silently fail
    }
    setCurrentStep(null);
  }, []);

  if (currentStep === null || currentStep >= STEPS.length) {
    return null;
  }

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  // Position classes based on target
  const positionClasses = getPositionClasses(step.target);

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
        className={`pointer-events-auto absolute ${positionClasses}`}
        role="dialog"
        aria-label={`Tip ${currentStep + 1} of ${STEPS.length}`}
        aria-live="polite"
      >
        <div className="w-72 rounded-xl bg-white p-5 shadow-xl ring-1 ring-gray-200">
          {/* Step indicator */}
          <div className="mb-3 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-colors ${
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
      // Near the top-right where the Sources button is in the toolbar
      return "top-16 right-4 lg:right-[200px]";
    case "text-selection":
      // Center of the content area, slightly below middle
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    default:
      return "top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2";
  }
}

export default OnboardingTooltips;
