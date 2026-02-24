"use client";

import { usePathname, useParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Auto-captured context sent alongside feedback submissions (#342).
 *
 * Five actionable fields. Collected at submission time (not on mount)
 * to capture the state at the moment the user reports an issue.
 */
export interface FeedbackContext {
  userAgent: string;
  currentRoute: string;
  projectId: string | null;
  chapterId: string | null;
  onlineStatus: boolean;
}

/**
 * Returns a function that collects feedback context on demand.
 * Call `collectContext()` at submission time.
 */
export function useFeedbackContext() {
  const pathname = usePathname();
  const params = useParams<{ projectId?: string; chapterId?: string }>();

  const collectContext = useCallback((): FeedbackContext => {
    return {
      userAgent: navigator.userAgent,
      currentRoute: pathname,
      projectId: (params?.projectId as string) ?? null,
      chapterId: (params?.chapterId as string) ?? null,
      onlineStatus: navigator.onLine,
    };
  }, [pathname, params]);

  return { collectContext };
}
