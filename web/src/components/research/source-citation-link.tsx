"use client";

/**
 * SourceCitationLink - Tappable source title for AI result cards and clip cards.
 *
 * Requirements (design-spec.md Section 7, issue #194):
 * - 44pt minimum touch target (iPad-first)
 * - Tapping navigates to Sources tab > Source Detail View via ResearchPanelProvider
 * - If source has been removed (sourceId is null), shows "[Source removed]" - not tappable
 * - Styled as a link (blue, underline on hover)
 */

interface SourceCitationLinkProps {
  /** Source title to display */
  sourceTitle: string;
  /** Source ID - null means source has been removed */
  sourceId: string | null;
  /** Source location text for scroll-to-position in detail view */
  sourceLocation?: string | null;
  /** Which tab to return to after viewing source */
  returnTo: "ask" | "clips";
  /** Navigate to source detail via provider */
  onNavigateToSource: (
    sourceId: string,
    returnTo: "ask" | "clips",
    sourceLocation?: string | null,
  ) => void;
}

export function SourceCitationLink({
  sourceTitle,
  sourceId,
  sourceLocation,
  returnTo,
  onNavigateToSource,
}: SourceCitationLinkProps) {
  // Source has been removed - show non-tappable indicator
  if (!sourceId) {
    return (
      <span className="text-sm text-muted-foreground italic" aria-label="Source has been removed">
        [Source removed]
      </span>
    );
  }

  return (
    <button
      onClick={() => onNavigateToSource(sourceId, returnTo, sourceLocation)}
      className="min-h-[44px] min-w-[44px] flex items-center text-left
                 text-sm font-medium text-blue-600 hover:text-blue-700
                 hover:underline transition-colors px-0 py-2"
      aria-label={`View source: ${sourceTitle}`}
    >
      {sourceTitle}
    </button>
  );
}
