"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * useDropdown - Manages dropdown open/close state with click-outside and Escape key dismiss.
 *
 * Consolidates the duplicated dismiss logic from ExportMenu, SettingsMenu, and ProjectSwitcher.
 *
 * - Listens for mousedown outside the ref container to close
 * - Listens for Escape key to close
 * - Listeners are only attached while the dropdown is open (no unnecessary global listeners)
 */
export function useDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  return { isOpen, ref, toggle, close, open, setIsOpen };
}
