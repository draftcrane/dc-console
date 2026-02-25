"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface SettingsMenuProps {
  /** Open rename book dialog */
  onRenameBook: () => void;
  /** Open duplicate book dialog */
  onDuplicateBook: () => void;
  /** Whether a duplication is in progress */
  isDuplicating: boolean;
  /** Open delete project dialog */
  onDeleteProject: () => void;
  /** Sign out handler */
  onSignOut: () => void;
  /** Whether sign-out is in progress */
  isSigningOut: boolean;
}

/**
 * SettingsMenu - Settings dropdown for the editor toolbar.
 *
 * iPad-first: 44pt touch targets.
 */
export function SettingsMenu({
  onRenameBook,
  onDuplicateBook,
  isDuplicating,
  onDeleteProject,
  onSignOut,
  isSigningOut,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click (US-023)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape (US-023)
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

  const handleMenuItem = useCallback((action: () => void) => {
    setIsOpen(false);
    action();
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--dc-color-surface-tertiary)] transition-colors"
        aria-label="Settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="w-5 h-5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          role="menu"
          aria-label="Project settings"
        >
          {/* Rename Book */}
          <button
            onClick={() => handleMenuItem(onRenameBook)}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100
                       transition-colors min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Rename Book
          </button>

          {/* Duplicate Book */}
          <button
            onClick={() => handleMenuItem(onDuplicateBook)}
            disabled={isDuplicating}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100
                       transition-colors min-h-[44px] flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {isDuplicating ? "Duplicating..." : "Duplicate Book"}
          </button>

          <div className="my-1 border-t border-gray-200" role="separator" />

          <button
            onClick={() => handleMenuItem(onDeleteProject)}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50
                       transition-colors min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete Project
          </button>

          {/* Help & Support (#340) */}
          <Link
            href="/help"
            onClick={() => setIsOpen(false)}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100
                       transition-colors min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Help & Support
          </Link>

          {/* Separator */}
          <div className="my-1 border-t border-gray-200" role="separator" />

          {/* Sign out (US-003) */}
          <button
            onClick={() => handleMenuItem(onSignOut)}
            disabled={isSigningOut}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100
                       transition-colors min-h-[44px] flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {isSigningOut ? "Signing out\u2026" : "Sign Out"}
          </button>
        </div>
      )}
    </div>
  );
}
