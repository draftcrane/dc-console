"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useDriveStatus } from "@/hooks/use-drive-status";
import { useDriveFolder } from "@/hooks/use-drive-folder";

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
  const { createFolder, folder, isCreating, error: folderError } = useDriveFolder();
  const projectId = useSyncExternalStore(
    subscribePendingProject,
    readPendingProject,
    getServerSnapshot,
  );
  const folderAttemptedRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-create the folder once Drive is confirmed connected and we have a project ID
  useEffect(() => {
    if (!isLoadingDrive && status?.connected && projectId && !folderAttemptedRef.current) {
      folderAttemptedRef.current = true;
      createFolder(projectId);
    }
  }, [isLoadingDrive, status?.connected, projectId, createFolder]);

  // Auto-redirect after folder creation or when no project
  useEffect(() => {
    const shouldRedirect =
      !isLoadingDrive && status?.connected && (folder || (!projectId && !isCreating));

    if (!shouldRedirect) return;

    redirectTimerRef.current = setTimeout(() => {
      const destination = projectId ? `/editor/${projectId}` : "/dashboard";
      router.push(destination);
    }, 3000);

    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [isLoadingDrive, status?.connected, folder, projectId, isCreating, router]);

  const handleRetry = useCallback(() => {
    if (projectId) {
      folderAttemptedRef.current = false;
      createFolder(projectId);
    }
  }, [projectId, createFolder]);

  const handleContinue = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }
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

        {/* Folder creation status */}
        {projectId && (
          <div className="mt-6">
            {isCreating && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Creating book folder in Drive...</span>
              </div>
            )}

            {folder && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800">Book folder created</p>
                    <p className="text-sm text-green-700 truncate">{folder.name}</p>
                  </div>
                </div>
                <a
                  href={folder.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-900 underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  View in Google Drive
                </a>
              </div>
            )}

            {folderError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                <p className="text-sm font-medium text-red-800">Failed to create book folder</p>
                <p className="text-sm text-red-700 mt-1">{folderError}</p>
                <button
                  onClick={handleRetry}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors min-h-[44px]"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Redirect info */}
        {(folder || (!projectId && !isCreating && !isLoadingDrive && status?.connected)) && (
          <p className="mt-4 text-sm text-muted-foreground">Redirecting automatically...</p>
        )}

        {/* Show continue button when folder is done or there's an error */}
        {(folder || folderError || !projectId) && !isCreating && (
          <button
            onClick={handleContinue}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            {projectId ? "Continue to Editor" : "Continue to DraftCrane"}
          </button>
        )}
      </div>
    </div>
  );
}
