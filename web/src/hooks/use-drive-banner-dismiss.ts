"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "dc_drive_banner_dismiss";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parse the stored dismiss state from "count:timestamp" format.
 * Returns { count: 0, timestamp: 0 } on missing or corrupted data.
 */
export function parseDismissState(raw: string | null): {
  count: number;
  timestamp: number;
} {
  if (!raw) return { count: 0, timestamp: 0 };

  const sep = raw.indexOf(":");
  if (sep === -1) return { count: 0, timestamp: 0 };

  const count = parseInt(raw.slice(0, sep), 10);
  const timestamp = parseInt(raw.slice(sep + 1), 10);

  if (Number.isNaN(count) || Number.isNaN(timestamp) || count < 0) {
    return { count: 0, timestamp: 0 };
  }

  return { count, timestamp };
}

/**
 * Determine whether the banner should be shown based on dismiss state.
 */
export function computeShouldShow(
  count: number,
  timestamp: number,
  now: number = Date.now(),
): boolean {
  if (count === 0) return true;
  if (count >= 2) return false;
  // count === 1: show again after 7 days
  return now - timestamp >= SEVEN_DAYS_MS;
}

// Snapshot for useSyncExternalStore — reads localStorage synchronously.
function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Server snapshot — always null (no localStorage on server).
function getServerSnapshot(): string | null {
  return null;
}

// Listeners for the external store pattern.
let listeners: Array<() => void> = [];

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Progressive Drive banner dismissal hook.
 *
 * Stores dismiss count and timestamp in localStorage as "count:timestamp".
 * - 1st dismiss: hides banner for 7 days, label stays "Maybe later"
 * - 2nd dismiss: hides banner permanently, label shows "Don't show again"
 *
 * Falls back to session-only behavior (shouldShow = true) if localStorage
 * is unavailable (Safari private browsing, ITP eviction).
 *
 * The toolbar DriveStatusIndicator always shows "Connect Drive" regardless
 * of banner state, ensuring the feature remains discoverable.
 */
export function useDriveBannerDismiss(): {
  shouldShow: boolean;
  dismissCount: number;
  dismiss: () => void;
} {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { count, timestamp } = parseDismissState(raw);
  const shouldShow = computeShouldShow(count, timestamp);

  const dismiss = useCallback(() => {
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      const current = parseDismissState(currentRaw);
      const newCount = current.count + 1;
      localStorage.setItem(STORAGE_KEY, `${newCount}:${Date.now()}`);
      emitChange();
    } catch {
      // localStorage unavailable — session-only dismiss handled by component state
    }
  }, []);

  return { shouldShow, dismissCount: count, dismiss };
}
