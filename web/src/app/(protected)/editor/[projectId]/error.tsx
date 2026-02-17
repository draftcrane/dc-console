"use client";

import { useEffect } from "react";

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Editor error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2>
        <p className="text-sm text-red-600 mb-4 font-mono break-all">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
