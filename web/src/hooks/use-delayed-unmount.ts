"use client";

import { useState, useEffect, useSyncExternalStore } from "react";

/**
 * Subscribe to the `prefers-reduced-motion` media query via useSyncExternalStore.
 * Returns true when the user prefers reduced motion.
 */
function subscribeToReducedMotion(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

/**
 * useDelayedUnmount — Keeps a component in the DOM during its exit animation.
 *
 * On open:  `shouldRender` becomes true synchronously (during render).
 * On close: `shouldRender` stays true for `durationMs` so the exit animation
 *           can play, then becomes false to unmount.
 *
 * `isClosing` is derived: true when the component is rendered but `isOpen`
 * has become false (i.e. the exit animation window).
 *
 * Respects `prefers-reduced-motion: reduce` — when active, `durationMs` is
 * treated as 0 so the component unmounts immediately with no exit animation.
 *
 * @param isOpen    Whether the overlay/panel is logically open.
 * @param durationMs  Exit animation duration in milliseconds.
 *
 * @example
 * ```tsx
 * const { shouldRender, isClosing } = useDelayedUnmount(isOpen, 200);
 * if (!shouldRender) return null;
 * return <div className={isClosing ? "slide-out" : "slide-in"}>...</div>;
 * ```
 */
export function useDelayedUnmount(isOpen: boolean, durationMs: number) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Synchronous open: set shouldRender during render (no effect needed)
  if (isOpen && !shouldRender) {
    setShouldRender(true);
  }

  // Stable reference for the delayed close effect
  const effectiveDuration = prefersReducedMotion ? 0 : durationMs;

  // Delayed close: unmount after exit animation completes
  useEffect(() => {
    if (!isOpen && shouldRender) {
      const timer = setTimeout(() => setShouldRender(false), effectiveDuration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender, effectiveDuration]);

  return {
    shouldRender,
    isClosing: shouldRender && !isOpen,
  };
}
