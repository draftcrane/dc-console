"use client";

import { useEffect, useRef, useCallback, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useDriveAccounts } from "@/hooks/use-drive-accounts";

const SOURCE_LINK_KEY = "dc_pending_source_link";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Module-level snapshot for the pending source link project ID.
 * Used when linking a Drive account as a research source.
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
 * 2. If dc_pending_source_link is in sessionStorage (from "+ Link" in Sources),
 *    auto-link the connection as a research source for the project
 * 3. Show confirmation and auto-redirect to editor or dashboard
 *
 * The ?cid= query param (set by the OAuth callback) identifies which
 * Drive connection was just created/updated.
 * The ?email= query param provides the connected email for immediate display
 * (avoids a read-after-write race with the API).
 *
 * Per PRD Section 8 (US-005/US-006): Works with iPad Safari redirect flow.
 */
export default function DriveSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { accounts, isLoading: isLoadingDrive } = useDriveAccounts();

  // Connection ID and email from OAuth callback redirect
  const connectionId = searchParams.get("cid");
  const connectedEmail = searchParams.get("email");

  // Derive connection state from accounts array
  const isConnected = accounts.length > 0;

  // Display email: prefer URL param (immediate), fall back to matching account, then first account
  const fallbackEmail = accounts.find((a) => a.id === connectionId)?.email ?? accounts[0]?.email;
  const displayEmail = connectedEmail || fallbackEmail;

  // Source-link flow: project ID from sessionStorage
  const sourceLinkProjectId = useSyncExternalStore(
    subscribeNoop,
    readPendingSourceLink,
    getServerSnapshot,
  );

  const [linkComplete, setLinkComplete] = useState(false);
  const linkAttempted = useRef(false);

  // Determine when we're ready to auto-redirect
  const readyToRedirect =
    !isLoadingDrive &&
    isConnected &&
    // No pending flow — redirect immediately
    (!sourceLinkProjectId ||
      // Source-link flow — wait for link completion
      linkComplete);

  // Auto-redirect after async flows complete
  useEffect(() => {
    if (!readyToRedirect) return;

    const timer = setTimeout(() => {
      const destination = sourceLinkProjectId ? `/editor/${sourceLinkProjectId}` : "/dashboard";
      router.push(destination);
    }, 3000);

    return () => clearTimeout(timer);
  }, [readyToRedirect, sourceLinkProjectId, router]);

  const handleContinue = useCallback(() => {
    const destination = sourceLinkProjectId ? `/editor/${sourceLinkProjectId}` : "/dashboard";
    router.push(destination);
  }, [sourceLinkProjectId, router]);

  // After OAuth success, auto-link the connection as a research source (source-link flow).
  useEffect(() => {
    if (linkAttempted.current) return;
    if (isLoadingDrive) return;
    if (!isConnected) return;
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
      } finally {
        setLinkComplete(true);
      }
    })();
  }, [isLoadingDrive, isConnected, sourceLinkProjectId, connectionId, getToken]);

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
        ) : isConnected ? (
          <p className="text-muted-foreground">
            Connected as <span className="font-medium text-foreground">{displayEmail}</span>.
          </p>
        ) : (
          <p className="text-muted-foreground">Your Google Drive is now connected.</p>
        )}

        {sourceLinkProjectId && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              {linkComplete
                ? "Linked as a research source. Redirecting to editor..."
                : "Linking as a research source..."}
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
