"use client";

import { useEffect, useCallback, useRef } from "react";
import { SourceContentRenderer } from "@/components/research/source-content-renderer";

interface SourceViewerSheetProps {
  isOpen: boolean;
  title: string;
  content: string;
  wordCount: number;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onImportAsChapter: () => void;
}

export function SourceViewerSheet({
  isOpen,
  title,
  content,
  wordCount,
  isLoading,
  error,
  onClose,
  onImportAsChapter,
}: SourceViewerSheetProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
      // Cmd+F (Mac) or Ctrl+F (Windows/Linux) focuses the search field
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Source: ${title}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
            {wordCount > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                {wordCount.toLocaleString()} words
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onImportAsChapter}
              disabled={isLoading || !!error}
              className="h-10 px-3 flex items-center gap-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium
                         hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Import as Chapter
            </button>
            <button
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Source tabs (shown when multiple linked sources) */}
        {tabs && tabs.length > 1 && onTabChange && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 overflow-x-auto shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  activeTabId === tab.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab.title}
              </button>
            ))}
          </div>
        )}

        {/* Content with integrated search */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading content...
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!isLoading && !error && content && (
            <SourceContentRenderer
              content={content}
              searchEnabled={true}
              searchInputRef={searchInputRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default SourceViewerSheet;
