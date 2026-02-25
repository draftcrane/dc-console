"use client";

import type { ReactElement } from "react";

interface EmptyStateProps {
  icon: ReactElement;
  message: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Reusable empty state component for the Sources panel.
 * Used for: no sources, no connections, no search results, no source selected.
 */
export function EmptyState({
  icon,
  message,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 text-[var(--dc-color-text-placeholder)]">{icon}</div>
      <p className="text-sm font-medium text-[var(--dc-color-text-secondary)] mb-1">{message}</p>
      {description && (
        <p className="text-xs text-[var(--dc-color-text-muted)] mb-4 max-w-[240px]">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col items-center gap-2">
          {action && (
            <button
              onClick={action.onClick}
              className="h-9 px-4 rounded-lg bg-blue-600 text-sm font-medium text-white
                       hover:bg-blue-700 transition-colors min-h-[44px] min-w-[44px]"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-xs text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)] transition-colors min-h-[44px]"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
