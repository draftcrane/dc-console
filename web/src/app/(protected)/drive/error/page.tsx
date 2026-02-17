"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied:
    "You declined the Google Drive connection. You can connect anytime from the editor.",
  token_exchange_failed: "We could not complete the connection to Google Drive. Please try again.",
};

/**
 * Drive OAuth Error Page
 *
 * Handles errors from the Google OAuth flow. The API callback redirects here
 * with an error query parameter. Shows a friendly message and allows retry.
 *
 * Per PRD Section 8 (US-005): "Maybe later" - Drive connection is optional.
 */
function DriveErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorCode = searchParams.get("error") || "unknown";
  const errorMessage =
    ERROR_MESSAGES[errorCode] ||
    "Something went wrong connecting to Google Drive. Please try again.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Error icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-8 w-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
          Drive Connection Issue
        </h1>

        <p className="text-muted-foreground">{errorMessage}</p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Back to DraftCrane
          </button>

          <p className="text-sm text-muted-foreground">
            You can connect Google Drive anytime from the editor.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DriveErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <DriveErrorContent />
    </Suspense>
  );
}
