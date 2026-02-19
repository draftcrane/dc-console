"use client";

import { useState } from "react";

interface DeleteChapterDialogProps {
  /** The chapter title to display in the confirmation message */
  chapterTitle: string;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when the user confirms deletion */
  onConfirm: () => Promise<void>;
  /** Called when the user cancels */
  onCancel: () => void;
}

/**
 * DeleteChapterDialog - Confirmation dialog for deleting a chapter.
 *
 * Per US-014 acceptance criteria:
 * - Confirmation dialog required before deletion
 * - Chapter title displayed in confirmation message
 * - Destructive (red) Delete button + Cancel button
 * - iPad-first: 44pt minimum touch targets
 */
export function DeleteChapterDialog({
  chapterTitle,
  isOpen,
  onConfirm,
  onCancel,
}: DeleteChapterDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  async function handleConfirm() {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chapter-title"
      aria-describedby="delete-chapter-description"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Warning icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2
          id="delete-chapter-title"
          className="text-lg font-semibold text-gray-900 mb-2 text-center"
        >
          Delete Chapter
        </h2>

        <p id="delete-chapter-description" className="text-sm text-gray-600 mb-2 text-center">
          Are you sure you want to delete &ldquo;{chapterTitle}&rdquo;?
        </p>

        <p className="text-sm text-gray-500 mb-6 text-center">
          This action cannot be undone. If connected to Google Drive, the file will be moved to
          trash.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                       hover:bg-gray-200 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg
                       hover:bg-red-700 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete Chapter"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteChapterDialog;
