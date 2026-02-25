"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Focusable element selector for focus management.
 * Matches all interactive elements that can receive focus.
 */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  /** Whether the focus trap is currently active */
  isOpen: boolean;
  /** Optional callback invoked when Escape is pressed */
  onEscape?: () => void;
}

/**
 * useFocusTrap - Manages focus trapping within a container element.
 *
 * Handles:
 * - Capturing the trigger element (document.activeElement) when the trap activates
 * - Focusing the first focusable element within the container on activation
 * - Tab/Shift+Tab cycling within the container boundary
 * - Focus restoration to the trigger element on deactivation
 * - Optional Escape key callback
 *
 * @param options.isOpen - Whether the focus trap is active
 * @param options.onEscape - Optional callback for Escape key
 * @returns A ref to attach to the container element
 */
export function useFocusTrap({ isOpen, onEscape }: UseFocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const prevIsOpenRef = useRef(false);

  // Focus management: capture trigger on open, focus first element, restore on close
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      // Opening: capture the element that triggered the overlay
      triggerRef.current = document.activeElement;

      // Focus the first focusable element inside the container
      if (containerRef.current) {
        const firstFocusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    } else if (!isOpen && wasOpen) {
      // Closing: return focus to the trigger element
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger instanceof HTMLElement) {
        trigger.focus();
      }
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen || !onEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onEscape]);

  // Focus trap: Tab/Shift+Tab cycling within the container
  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Tab" || !containerRef.current) return;

    const focusableElements =
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [isOpen, handleFocusTrap]);

  return containerRef;
}
