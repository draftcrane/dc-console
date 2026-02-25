"use client";

import { usePathname, useParams } from "next/navigation";
import { useCallback } from "react";
import { getRecentErrors, type CapturedError } from "@/lib/error-store";

/**
 * Auto-captured context sent alongside feedback submissions (#373).
 *
 * 14 fields collected automatically at submission time (not on mount)
 * so the snapshot reflects the user's state at the moment they report.
 * None of these fields are user-editable.
 */
export interface FeedbackContext {
  /** Full user-agent string */
  userAgent: string;
  /** Viewport width in CSS pixels */
  viewportWidth: number;
  /** Viewport height in CSS pixels */
  viewportHeight: number;
  /** Device pixel ratio (1 = standard, 2 = Retina, etc.) */
  devicePixelRatio: number;
  /** Whether a virtual keyboard is likely visible (viewport shrank significantly) */
  keyboardVisible: boolean;
  /** Whether the device supports touch input */
  touchSupport: boolean;
  /** Whether the browser reports being online */
  onlineStatus: boolean;
  /** Current Next.js route pathname */
  currentRoute: string;
  /** Active project ID from route params, or null */
  projectId: string | null;
  /** Active chapter ID from route params, or null */
  chapterId: string | null;
  /** Drive connection status: "connected", "disconnected", or "unknown" */
  driveConnectionStatus: "connected" | "disconnected" | "unknown";
  /** App version from package.json, exposed via NEXT_PUBLIC_APP_VERSION */
  appVersion: string;
  /** Ring buffer of the last 5 client-side errors */
  recentErrors: CapturedError[];
  /** ISO 8601 timestamp of when the feedback was submitted */
  submittedAt: string;
}

/**
 * Detect whether a virtual keyboard is likely open.
 *
 * Uses the VirtualKeyboard API if available (Chromium), otherwise falls back
 * to comparing the visual viewport height against the layout viewport.
 * A >25% reduction in visual height is a strong signal on iPad/mobile.
 */
function detectKeyboardVisible(): boolean {
  if (typeof window === "undefined") return false;

  // VirtualKeyboard API (Chromium-based browsers)
  if ("virtualKeyboard" in navigator) {
    const vk = (navigator as { virtualKeyboard?: { boundingRect?: DOMRect } }).virtualKeyboard;
    if (vk?.boundingRect && vk.boundingRect.height > 0) {
      return true;
    }
  }

  // Visual viewport heuristic: if visual viewport is significantly shorter
  // than the layout viewport, a keyboard is likely open.
  if (window.visualViewport) {
    const ratio = window.visualViewport.height / window.innerHeight;
    return ratio < 0.75;
  }

  return false;
}

/**
 * Detect Drive connection status from local cues without making an API call.
 *
 * Checks sessionStorage for the OAuth success signal that the Drive callback
 * page sets. This is a best-effort heuristic — accurate when the user has
 * connected Drive during this browser session.
 */
function detectDriveStatus(): "connected" | "disconnected" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  try {
    // The drive success page sets this flag in sessionStorage
    const flag = sessionStorage.getItem("dc_drive_connected");
    if (flag === "true") return "connected";
    if (flag === "false") return "disconnected";
  } catch {
    // sessionStorage unavailable (e.g., private mode restrictions)
  }
  return "unknown";
}

/**
 * Returns a function that collects all 14 feedback context fields on demand.
 * Call `collectContext()` at submission time — not on mount — so the snapshot
 * reflects the user's state at the moment they report.
 */
export function useFeedbackContext() {
  const pathname = usePathname();
  const params = useParams<{ projectId?: string; chapterId?: string }>();

  const collectContext = useCallback((): FeedbackContext => {
    return {
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio ?? 1,
      keyboardVisible: detectKeyboardVisible(),
      touchSupport: "ontouchstart" in window || navigator.maxTouchPoints > 0,
      onlineStatus: navigator.onLine,
      currentRoute: pathname,
      projectId: (params?.projectId as string) ?? null,
      chapterId: (params?.chapterId as string) ?? null,
      driveConnectionStatus: detectDriveStatus(),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      recentErrors: getRecentErrors(),
      submittedAt: new Date().toISOString(),
    };
  }, [pathname, params]);

  return { collectContext };
}
