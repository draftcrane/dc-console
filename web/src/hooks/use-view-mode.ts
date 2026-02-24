"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ViewMode } from "@/components/editor/workspace-toggle";

/**
 * Hook for managing workspace view mode with URL state.
 *
 * Per Issue #318 Acceptance Criteria:
 * - URL updates on toggle (`?view=book`) for direct linking and browser back support
 * - Default view is "chapter" when no query param is present
 *
 * Uses Next.js useSearchParams + useRouter for URL state management.
 * Browser back/forward buttons will restore the previous view mode.
 */
export function useViewMode() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse current view mode from URL
  const viewMode: ViewMode = useMemo(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "book") {
      return "book";
    }
    // Default to chapter view
    return "chapter";
  }, [searchParams]);

  // Update URL when view mode changes
  const setViewMode = useCallback(
    (mode: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());

      if (mode === "book") {
        params.set("view", "book");
      } else {
        // Remove the param for chapter view (default)
        params.delete("view");
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

      // Use push instead of replace to support browser back button
      router.push(newUrl);
    },
    [pathname, router, searchParams],
  );

  return {
    viewMode,
    setViewMode,
    isBookView: viewMode === "book",
    isChapterView: viewMode === "chapter",
  };
}
