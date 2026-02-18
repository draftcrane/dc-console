"use client";

import { useEffect, useCallback } from "react";
import type { SourceMaterial } from "@/hooks/use-sources";

interface SourcesPanelProps {
  isOpen: boolean;
  sources: SourceMaterial[];
  isLoading: boolean;
  error: string | null;
  isPickerLoading: boolean;
  onClose: () => void;
  onAddFromPicker: () => void;
  onViewSource: (source: SourceMaterial) => void;
  onImportAsChapter: (sourceId: string) => void;
  onRemoveSource: (sourceId: string) => void;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

export function SourcesPanel({
  isOpen,
  sources,
  isLoading,
  error,
  isPickerLoading,
  onClose,
  onAddFromPicker,
  onViewSource,
  onImportAsChapter,
  onRemoveSource,
}: SourcesPanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
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
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Source materials"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Sources</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onAddFromPicker}
              disabled={isPickerLoading}
              className="h-10 px-3 flex items-center gap-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium
                         hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="Add sources from Google Docs"
            >
              {isPickerLoading ? (
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
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              )}
              Add
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

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading && sources.length === 0 && (
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
                Loading sources...
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!isLoading && !error && sources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <svg
                className="w-12 h-12 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="text-sm text-gray-500 mb-1">No sources yet</p>
              <p className="text-xs text-gray-400">
                Add Google Docs to use as reference material for your book.
              </p>
            </div>
          )}

          {sources.length > 0 && (
            <ul className="divide-y divide-gray-100" role="list">
              {sources.map((source) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  onView={() => onViewSource(source)}
                  onImport={() => onImportAsChapter(source.id)}
                  onRemove={() => onRemoveSource(source.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <p className="text-xs text-gray-400">
            {sources.length > 0
              ? `${sources.length} source${sources.length === 1 ? "" : "s"}`
              : "Select Google Docs to add as reference material."}
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceRow({
  source,
  onView,
  onImport,
  onRemove,
}: {
  source: SourceMaterial;
  onView: () => void;
  onImport: () => void;
  onRemove: () => void;
}) {
  const isError = source.status === "error";

  return (
    <li className="px-4 py-3 min-h-[56px]">
      <div className="flex items-start gap-3">
        {/* Doc icon */}
        <div
          className={`h-9 w-9 flex items-center justify-center rounded-lg shrink-0 ${
            isError ? "bg-red-50" : "bg-blue-50"
          }`}
        >
          <svg
            className={`w-4.5 h-4.5 ${isError ? "text-red-400" : "text-blue-500"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{source.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {isError ? (
              <span className="text-xs text-red-500">Could not import</span>
            ) : source.cachedAt ? (
              <>
                <span className="text-xs text-gray-400 tabular-nums">
                  {source.wordCount.toLocaleString()} words
                </span>
                <span className="text-xs text-gray-300" aria-hidden="true">
                  --
                </span>
                <span className="text-xs text-gray-400">
                  Cached {formatRelativeTime(source.cachedAt)}
                </span>
              </>
            ) : source.driveModifiedTime ? (
              <span className="text-xs text-gray-400">
                Edited in Drive {formatRelativeTime(source.driveModifiedTime)}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Not yet loaded</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-2 ml-12">
        {!isError && (
          <>
            <button
              onClick={onView}
              className="h-8 px-2.5 text-xs font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              View
            </button>
            <button
              onClick={onImport}
              className="h-8 px-2.5 text-xs font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              Import as Chapter
            </button>
          </>
        )}
        <button
          onClick={onRemove}
          className="h-8 px-2.5 text-xs font-medium text-red-500 rounded-md hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export default SourcesPanel;
