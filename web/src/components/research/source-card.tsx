"use client";

import type { ReactNode } from "react";
import type { SourceMaterial } from "@/hooks/use-sources";

/**
 * SourceCard — shared between Source Manager (with actionSlot) and Content Manager (bare).
 *
 * Displays a source document row with icon, title, word count, and badge.
 * The optional `actionSlot` prop allows the Source Manager to inject a three-dot
 * menu without the Content Manager needing to know about management actions.
 */
export function SourceCard({
  source,
  sourceBadge,
  onTap,
  actionSlot,
}: {
  source: SourceMaterial;
  sourceBadge: string;
  onTap: () => void;
  actionSlot?: ReactNode;
}) {
  const isError = source.status === "error";
  const isArchived = source.status === "archived";

  return (
    <li className={`min-h-[56px] ${isArchived ? "opacity-60" : ""}`}>
      <div className="flex items-start">
        <button
          onClick={isError || isArchived ? undefined : onTap}
          className={`flex-1 text-left px-4 py-3 flex items-start gap-3 transition-colors min-w-0
            ${isError || isArchived ? "" : "hover:bg-gray-50"}`}
          disabled={isError || isArchived}
        >
          {/* Doc icon */}
          <div
            className={`h-9 w-9 flex items-center justify-center rounded-lg shrink-0 ${
              isError ? "bg-red-50" : isArchived ? "bg-gray-100" : "bg-blue-50"
            }`}
          >
            <svg
              className={`w-4 h-4 ${isError ? "text-red-400" : isArchived ? "text-gray-400" : "text-blue-500"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
            <p className="text-sm font-medium text-foreground truncate">{source.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {isError ? (
                <span className="text-xs text-red-500">Could not extract text</span>
              ) : isArchived ? (
                <span className="text-xs text-amber-600">Account disconnected</span>
              ) : source.cachedAt ? (
                <>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {source.wordCount.toLocaleString()} words
                  </span>
                  <span className="text-xs text-gray-300" aria-hidden="true">
                    &middot;
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {sourceBadge}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {sourceBadge}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Action slot — Source Manager injects the three-dot menu here */}
        {actionSlot}
      </div>
    </li>
  );
}
