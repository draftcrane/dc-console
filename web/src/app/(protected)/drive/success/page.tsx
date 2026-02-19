"use client";

import { useEffect, useRef, useCallback, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useDriveStatus } from "@/hooks/use-drive-status";

const STORAGE_KEY = "dc_pending_drive_project";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

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
  const { getToken } = useAuth();
  const { status, isLoading: isLoadingDrive } = useDriveStatus();
  const projectId = useSyncExternalStore(
    subscribePendingProject,
    readPendingProject,
    getServerSnapshot,
  );
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const createAttempted = useRef(false);

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

  const createFolder = useCallback(async () => {
    if (!projectId) return;
    setIsCreatingFolder(true);
    setFolderError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/projects/${projectId}/connect-drive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to create Drive folder");
      }

      const data = (await response.json()) as { driveFolderId: string };
      setFolderId(data.driveFolderId);
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Failed to create Drive folder");
    } finally {
      setIsCreatingFolder(false);
    }
  }, [getToken, projectId]);

  // After OAuth success, auto-create the book folder if projectId is present.
  useEffect(() => {
    if (createAttempted.current) return;
    if (isLoadingDrive) return;
    if (!status?.connected) return;
    if (!projectId) return;
    createAttempted.current = true;
    void createFolder();
  }, [isLoadingDrive, status?.connected, projectId, createFolder]);

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

        {projectId && (
          <div className="mt-4">
            {isCreatingFolder && (
              <p className="text-sm text-muted-foreground">Creating your book folder...</p>
            )}
            {folderId && (
              <div className="text-sm text-muted-foreground">
                Folder created.{" "}
                <a
                  className="text-foreground underline"
                  href={`https://drive.google.com/drive/folders/${folderId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View in Google Drive
                </a>
              </div>
            )}
            {folderError && (
              <div className="mt-3">
                <p className="text-sm text-red-600">{folderError}</p>
                <button
                  onClick={createFolder}
                  className="mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Retry folder creation
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleContinue}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
