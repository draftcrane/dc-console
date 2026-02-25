"use client";

import { useState } from "react";

interface DuplicateProjectDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Project title to display in the confirmation message */
  projectTitle: string;
  /** Called when the user confirms duplication */
  onConfirm: () => Promise<void>;
  /** Called when the user cancels */
  onCancel: () => void;
}

/**
 * DuplicateProjectDialog - Confirmation dialog for duplicating a project/book.
 *
 * Owns its own submitting state internally.
 *
 * iPad-first: 44pt minimum touch targets.
 */
export function DuplicateProjectDialog({
  isOpen,
  projectTitle,
  onConfirm,
  onCancel,
}: DuplicateProjectDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
    >
      <div className="bg-[var(--dc-color-surface-primary)] rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h2
          id="duplicate-dialog-title"
          className="text-lg font-semibold text-[var(--dc-color-text-primary)] mb-2"
        >
          Duplicate Book
        </h2>
        <p className="text-sm text-[var(--dc-color-text-muted)] mb-6">
          Duplicate &ldquo;{projectTitle}&rdquo;? This creates a full copy of all chapters.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-[var(--dc-color-text-secondary)] bg-[var(--dc-color-surface-tertiary)] rounded-lg
                       hover:bg-gray-200 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg
                       hover:bg-gray-800 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Duplicating..." : "Duplicate"}
          </button>
        </div>
      </div>
    </div>
  );
}
