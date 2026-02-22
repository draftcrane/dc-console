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
}

/**
 * Reusable empty state component for the Sources panel.
 * Used for: no sources, no connections, no search results, no source selected.
 */
export function EmptyState({ icon, message, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 text-gray-400">{icon}</div>
      <p className="text-sm font-medium text-gray-700 mb-1">{message}</p>
      {description && <p className="text-xs text-gray-500 mb-4 max-w-[240px]">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="h-9 px-4 rounded-lg bg-blue-600 text-sm font-medium text-white
                     hover:bg-blue-700 transition-colors min-h-[44px] min-w-[44px]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
