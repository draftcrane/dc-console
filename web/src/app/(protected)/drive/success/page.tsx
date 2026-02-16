"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDriveStatus } from "@/hooks/use-drive-status";

/**
 * Drive OAuth Success Page
 *
 * After the OAuth callback redirects here, we confirm the connection
 * succeeded and redirect the user back to their previous context
 * (dashboard or editor). This page auto-redirects after a brief confirmation.
 *
 * Per PRD Section 8 (US-005): Works with iPad Safari redirect flow.
 */
export default function DriveSuccessPage() {
  const router = useRouter();
  const { status, isLoading } = useDriveStatus();
  const [countdown, setCountdown] = useState(3);

  // Auto-redirect after 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Success checkmark */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-2">Google Drive Connected</h1>

        {isLoading ? (
          <p className="text-muted-foreground">Verifying connection...</p>
        ) : status?.connected ? (
          <p className="text-muted-foreground">
            Connected as <span className="font-medium text-foreground">{status.email}</span>. Your
            chapters will be safely stored in your Google Drive.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Your Google Drive is now connected. Your chapters will be safely stored in your Google
            Drive.
          </p>
        )}

        <p className="mt-4 text-sm text-muted-foreground">
          Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}...
        </p>

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Continue to DraftCrane
        </button>
      </div>
    </div>
  );
}
