"use client";

import { useEffect, useRef, useCallback, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useDriveStatus } from "@/hooks/use-drive-status";

const STORAGE_KEY = "dc_pending_drive_project";
const SOURCE_LINK_KEY = "dc_pending_source_link";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Module-level snapshot for the pending project ID (backup folder flow).
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

/**
 * Module-level snapshot for the pending source link project ID.
 * Separate from backup flow — used when linking a Drive account as a research source.
 */
let pendingSourceLinkSnapshot: string | null = null;
let sourceLinkSnapshotRead = false;

function readPendingSourceLink(): string | null {
  if (!sourceLinkSnapshotRead && typeof window !== "undefined") {
    const value = sessionStorage.getItem(SOURCE_LINK_KEY);
    if (value) {
      pendingSourceLinkSnapshot = value;
      sessionStorage.removeItem(SOURCE_LINK_KEY);
    }
    sourceLinkSnapshotRead = true;
  }
  return pendingSourceLinkSnapshot;
}

function subscribeNoop(): () => void {
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
 * 2. If dc_pending_drive_project is in sessionStorage (from setup or editor),
 *    auto-create the book folder in Google Drive (US-006)
 * 3. If dc_pending_source_link is in sessionStorage (from "+ Link" in Sources),
 *    auto-link the connection as a research source for the project
 * 4. Show confirmation and auto-redirect to editor or dashboard
 *
 * The ?cid= query param (set by the OAuth callback) identifies which
 * Drive connection was just created/updated.
 *
 * Per PRD Section 8 (US-005/US-006): Works with iPad Safari redirect flow.
 */
export default function DriveSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { status, isLoading: isLoadingDrive } = useDriveStatus();

  // Connection ID from OAuth callback redirect
  const connectionId = searchParams.get("cid");

  // Backup folder flow: project ID from sessionStorage
  const projectId = useSyncExternalStore(subscribeNoop, readPendingProject, getServerSnapshot);

  // Source-link flow: project ID from sessionStorage
  const sourceLinkProjectId = useSyncExternalStore(
    subscribeNoop,
    readPendingSourceLink,
    getServerSnapshot,
  );

  // Determine redirect destination (source-link flow also has a projectId)
  const redirectProjectId = projectId || sourceLinkProjectId;

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const createAttempted = useRef(false);
  const linkAttempted = useRef(false);

  // Auto-redirect after successful connection
  useEffect(() => {
    const shouldRedirect = !isLoadingDrive && status?.connected;

    if (!shouldRedirect) return;

    // Redirect after a short delay
    setTimeout(() => {
      const destination = redirectProjectId ? `/editor/${redirectProjectId}` : "/dashboard";
      router.push(destination);
    }, 3000); // 3-second delay to show success message
  }, [isLoadingDrive, status?.connected, redirectProjectId, router]);

  const handleContinue = useCallback(() => {
    const destination = redirectProjectId ? `/editor/${redirectProjectId}` : "/dashboard";
    router.push(destination);
  }, [redirectProjectId, router]);

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

  // After OAuth success, auto-create the book folder if projectId is present (backup flow).
  useEffect(() => {
    if (createAttempted.current) return;
    if (isLoadingDrive) return;
    if (!status?.connected) return;
    if (!projectId) return;
    createAttempted.current = true;
    void createFolder();
  }, [isLoadingDrive, status?.connected, projectId, createFolder]);

  // After OAuth success, auto-link the connection as a research source (source-link flow).
  useEffect(() => {
    if (linkAttempted.current) return;
    if (isLoadingDrive) return;
    if (!status?.connected) return;
    if (!sourceLinkProjectId || !connectionId) return;
    linkAttempted.current = true;

    void (async () => {
      try {
        const token = await getToken();
        await fetch(`${API_URL}/projects/${sourceLinkProjectId}/source-connections`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ driveConnectionId: connectionId }),
        });
        // Best-effort — if it fails (e.g. already linked), we still redirect
      } catch {
        // Non-blocking: user can manually link from the editor
      }
    })();
  }, [isLoadingDrive, status?.connected, sourceLinkProjectId, connectionId, getToken]);

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

        {sourceLinkProjectId && !projectId && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Linked as a research source. Redirecting to editor...
            </p>
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
