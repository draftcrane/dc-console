"use client";

import type { ReactNode } from "react";

interface SourceItemProps {
  title: string;
  mimeType: string;
  wordCount: number;
  onClick?: () => void;
  actions?: ReactNode;
  selected?: boolean;
}

/** MIME type to icon mapping */
function SourceIcon({ mimeType }: { mimeType: string }) {
  // Google Doc
  if (mimeType === "application/vnd.google-apps.document") {
    return (
      <svg className="w-5 h-5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v2H8v-2zm0 4h8v2H8v-2zm0-8h3v2H8V9z" />
      </svg>
    );
  }
  // PDF
  if (mimeType === "application/pdf") {
    return (
      <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM9 15.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm3-2a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm3 2a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
      </svg>
    );
  }
  // Text / Markdown / default
  return (
    <svg
      className="w-5 h-5 text-[var(--dc-color-text-muted)] shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z" />
    </svg>
  );
}

/**
 * Reusable source row component.
 * 44pt touch targets throughout.
 */
export function SourceItem({
  title,
  mimeType,
  wordCount,
  onClick,
  actions,
  selected,
}: SourceItemProps) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors min-h-[44px]
                  ${onClick ? "cursor-pointer hover:bg-[var(--dc-color-surface-secondary)] active:bg-[var(--dc-color-surface-tertiary)]" : ""}
                  ${selected ? "bg-blue-50 ring-1 ring-blue-200" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <SourceIcon mimeType={mimeType} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--dc-color-text-primary)] truncate leading-tight">
          {title}
        </p>
        {wordCount > 0 && (
          <p className="text-xs text-[var(--dc-color-text-muted)]">
            {wordCount.toLocaleString()} words
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
