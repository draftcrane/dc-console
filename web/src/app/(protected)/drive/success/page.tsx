"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useDriveStatus } from "@/hooks/use-drive-status";

const STORAGE_KEY = "dc_pending_drive_project";

/**
 * Module-level snapshot for the pending project ID.
 * Read once from sessionStorage and cleared immediately.
 * This avoids ref-during-render and setState-in-effect lint issues.
 */
let pendingProjectSnapshot: string | null = null;
let snapshotRead = false;

function readPendingProject(): string | null {
  if (!snapshotRead && typeof window !== "undefined") {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) {
      pendingProjectSnapshot = value;
      sessionStorage.removeItem(STORAGE_KEY);
    }
    snapshotRead = true;
  }
  return pendingProjectSnapshot;
}

function subscribePendingProject(): () => void {
  // Value is read once and never changes - no subscription needed
  return () => {};
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Drive OAuth Success Page
 *
 * After the OAuth callback redirects here, we:
 * 1. Confirm the Drive connection succeeded
 * 2. If a project ID is stored in sessionStorage (from setup or editor),
 *    auto-create the book folder in Google Drive (US-006)
 * 3. Show folder confirmation with name, green checkmark, and "View in Google Drive" link
 * 4. If folder creation fails, show error and retry button
 * 5. Auto-redirect to editor (if project) or dashboard after success
 *
 * Per PRD Section 8 (US-005/US-006): Works with iPad Safari redirect flow.
 */
export default function DriveSuccessPage() {
  const router = useRouter();
  const { status, isLoading: isLoadingDrive } = useDriveStatus();
  const projectId = useSyncExternalStore(
    subscribePendingProject,
    readPendingProject,
    getServerSnapshot,
  );



  // Auto-redirect after successful connection
  useEffect(() => {
    const shouldRedirect = !isLoadingDrive && status?.connected;

    if (!shouldRedirect) return;

    // Redirect after a short delay
    setTimeout(() => {
      const destination = projectId ? `/editor/${projectId}` : "/dashboard";
      router.push(destination);
    }, 3000); // 3-second delay to show success message
  }, [isLoadingDrive, status?.connected, projectId, router]);



  const handleContinue = useCallback(() => {
    const destination = projectId ? `/editor/${projectId}` : "/dashboard";
    router.push(destination);
  }, [projectId, router]);

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

        <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
          Google Drive Connected
        </h1>

        {isLoadingDrive ? (
          <p className="text-muted-foreground">Verifying connection...</p>
        ) : status?.connected ? (
          <p className="text-muted-foreground">
            Connected as <span className="font-medium text-foreground">{status.email}</span>.
          </p>
        ) : (
          <p className="text-muted-foreground">Your Google Drive is now connected.</p>
        )}


      </div>
    </div>
  );
}
