"use client";

import { useState, useEffect } from "react";

interface RenameProjectDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Current project title (pre-fills the input) */
  projectTitle: string;
  /** Called when the user confirms with the new title */
  onConfirm: (newTitle: string) => Promise<void>;
  /** Called when the user cancels */
  onCancel: () => void;
}

/**
 * RenameProjectDialog - Dialog for renaming a project/book.
 *
 * Owns its own input value and submitting state internally.
 * The caller provides the initial title and a confirm callback.
 *
 * iPad-first: 44pt minimum touch targets.
 */
export function RenameProjectDialog({
  isOpen,
  projectTitle,
  onConfirm,
  onCancel,
}: RenameProjectDialogProps) {
  const [value, setValue] = useState(projectTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync input value when dialog opens with a new title
  useEffect(() => {
    if (isOpen) {
      setValue(projectTitle);
    }
  }, [isOpen, projectTitle]);

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!value.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(value.trim());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
    >
      <div className="bg-[var(--dc-color-surface-primary)] rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h2
          id="rename-dialog-title"
          className="text-lg font-semibold text-[var(--dc-color-text-primary)] mb-4"
        >
          Rename Book
        </h2>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          className="w-full px-3 py-2 border border-[var(--dc-color-border-strong)] rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={500}
          autoFocus
        />
        <div className="flex gap-3 justify-end mt-4">
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
            onClick={handleSubmit}
            disabled={isSubmitting || !value.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg
                       hover:bg-gray-800 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
