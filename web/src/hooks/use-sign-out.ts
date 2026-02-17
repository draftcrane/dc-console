"use client";

import { useCallback, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { clearAllDrafts } from "@/lib/indexeddb";

/**
 * useSignOut - Handles the complete sign-out flow per US-003.
 *
 * Acceptance criteria:
 * 1. Auto-save completes before session termination (wait for pending save)
 * 2. Session terminated server-side (Clerk session revoked)
 * 3. Cached data cleared from browser including IndexedDB
 * 4. User redirected to landing page after sign-out
 * 5. Subsequent visits require re-authentication
 *
 * @param saveNow - Optional function to flush any pending auto-save before sign-out.
 *                  When called from the editor, pass the auto-save's saveNow function.
 */
export function useSignOut(saveNow?: () => Promise<void>) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      // Step 1: Wait for any pending auto-save to complete (US-003 AC: auto-save before termination)
      if (saveNow) {
        await saveNow();
      }

      // Step 2: Clear all cached data from IndexedDB (US-003 AC: clear cached data)
      await clearAllDrafts();

      // Step 3: Clear any sessionStorage/localStorage app data
      if (typeof window !== "undefined") {
        // Remove app-specific storage items (preserve Clerk's own storage)
        sessionStorage.removeItem("dc_pending_drive_project");
      }

      // Step 4: Sign out via Clerk (revokes session server-side) and redirect to landing page
      // Clerk's signOut handles session revocation and redirect (US-003 AC: session terminated, redirect)
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      console.error("Sign-out failed:", err);
      setIsSigningOut(false);
      // Even if cleanup fails, attempt sign-out to ensure security
      try {
        await signOut({ redirectUrl: "/" });
      } catch {
        // Last resort: force redirect
        window.location.href = "/";
      }
    }
  }, [isSigningOut, saveNow, signOut]);

  return { handleSignOut, isSigningOut };
}
