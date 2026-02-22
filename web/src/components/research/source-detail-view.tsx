"use client";

import { useEffect, useState, useCallback } from "react";
import { useSourceContent } from "@/hooks/use-source-content";
import { SourceContentRenderer } from "./source-content-renderer";
import { SelectionToolbar } from "./selection-toolbar";
import { useResearchClips, type SaveClipInput } from "@/hooks/use-research-clips";
import { useToast } from "@/components/toast";
import { InstructionManager } from "@/components/ai/instruction-manager";
import { useAiAnalysis } from "@/hooks/use-ai-analysis";

// === Types ===

interface Chapter {
  id: string;
  title: string;
}

interface SourceDetailViewProps {
  sourceId: string;
  title: string;
  projectId: string;
  onBack: () => void;
  /** Custom back label for cross-tab navigation (e.g. "Back to Ask", "Back to Clips") */
  backLabel?: string;
  /** Optional: text to scroll to and highlight on load */
  scrollToText?: string;
  /** Chapters available for clip tagging */
  chapters?: Chapter[];
  /** Insert source content into the active chapter */
  onInsertIntoChapter?: (content: string, sourceTitle: string) => void;
  /** Whether insert is available (editor exists and chapter is selected) */
  canInsert?: boolean;
  /** Title of the active chapter for button label */
  activeChapterTitle?: string;
  /** Import source as a new chapter */
  onImportAsChapter?: (sourceId: string) => Promise<void>;
  /** Drive connection ID for AI analysis */
  driveConnectionId?: string;
  /** Drive file ID for AI analysis */
  driveFileId?: string;
}

// === Hint localStorage key ===

const HINT_KEY_PREFIX = "source-detail-hint-count-";
const MAX_HINT_VIEWS = 3;

function getHintCount(projectId: string): number {
  try {
    const val = localStorage.getItem(`${HINT_KEY_PREFIX}${projectId}`);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

function incrementHintCount(projectId: string): void {
  try {
    const current = getHintCount(projectId);
    localStorage.setItem(`${HINT_KEY_PREFIX}${projectId}`, String(current + 1));
  } catch {
    // localStorage unavailable -- silently ignore
  }
}

// === Source Detail View Component ===

/**
 * Source Detail View - inline replacement within the Sources tab.
 *
 * Shows source document content with always-visible search and text selection.
 * The back button label is customizable for cross-tab navigation:
 * - "Sources" (default) when navigating within the Sources tab
 * - "Back to Ask" when arriving from the Ask tab
 * - "Back to Clips" when arriving from the Clips tab
 *
 * Features:
 * - SourceContentRenderer for rendering and searching content
 * - Floating SelectionToolbar for Copy + Save to Clips
 * - First-3-views hint about text selection (localStorage based)
 * - Toast notification on successful save
 */
export function SourceDetailView({
  sourceId,
  title,
  projectId,
  onBack,
  backLabel,
  scrollToText,
  chapters = [],
  onInsertIntoChapter,
  canInsert = false,
  activeChapterTitle,
  onImportAsChapter,
  driveConnectionId,
  driveFileId,
}: SourceDetailViewProps) {
  const { content, wordCount, isLoading, error, fetchContent, reset } = useSourceContent();
  const { saveClip, savedContents, isSaving } = useResearchClips(projectId);
  const { showToast } = useToast();
  const [selectedText, setSelectedText] = useState("");

  // AI Analysis state
  const canAnalyze = !!driveConnectionId && !!driveFileId;
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [selectedInstruction, setSelectedInstruction] = useState("");
  const {
    result: analysisResult,
    isLoading: analysisLoading,
    error: analysisError,
    startAnalysis,
  } = useAiAnalysis();

  // Show hint on first 3 views -- lazy init from localStorage, then increment
  const [showHint, setShowHint] = useState(() => {
    const count = getHintCount(projectId);
    if (count < MAX_HINT_VIEWS) {
      incrementHintCount(projectId);
      return true;
    }
    return false;
  });

  useEffect(() => {
    fetchContent(sourceId);
    return () => reset();
  }, [sourceId, fetchContent, reset]);

  // Auto-dismiss hint after 5 seconds
  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [showHint]);

  // Track text selection from the content renderer
  const handleTextSelect = useCallback((text: string) => {
    setSelectedText(text);
  }, []);

  // Dedup key to check if content is already saved
  const dedupKey = `${sourceId ?? "no-source"}::${selectedText}`;
  const isCurrentSelectionSaved = savedContents.has(dedupKey);

  const handleCopy = useCallback(() => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText).catch(() => {
        // Fallback: clipboard API may not be available
      });
      showToast("Copied to clipboard");
    }
  }, [selectedText, showToast]);

  const handleSaveToClips = useCallback(
    async (chapterId: string | null) => {
      if (!selectedText) return;

      const input: SaveClipInput = {
        content: selectedText,
        sourceTitle: title,
        sourceId: sourceId,
        sourceLocation: null,
        chapterId,
      };

      const result = await saveClip(input);
      if (result) {
        if (result.existed) {
          showToast("Already in Clips");
        } else {
          showToast("Saved to Clips");
        }
      }
    },
    [selectedText, sourceId, title, saveClip, showToast],
  );

  const displayBackLabel = backLabel ?? "Sources";

  return (
    <div className="flex flex-col h-full">
      {/* Header with back breadcrumb and title */}
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center gap-2 h-12 px-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700
                       min-h-[44px] px-1 transition-colors shrink-0"
            aria-label={backLabel ? backLabel : "Back to sources list"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {displayBackLabel}
          </button>
        </div>

        {/* Title and metadata */}
        <div className="px-4 pb-2">
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          {wordCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {wordCount.toLocaleString()} words
            </span>
          )}
        </div>
      </div>

      {/* Action bar — Insert into Chapter + Import as New Chapter + Analyze */}
      {content && (onInsertIntoChapter || onImportAsChapter || canAnalyze) && (
        <div className="shrink-0 px-4 py-2 border-b border-border flex items-center gap-2">
          {onInsertIntoChapter && (
            <button
              onClick={() => onInsertIntoChapter(content, title)}
              disabled={!canInsert}
              className="h-8 px-3 text-xs font-medium rounded-md bg-blue-600 text-white
                         hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canInsert
                ? `Insert into ${activeChapterTitle || "Chapter"}`
                : "Select a chapter first"}
            </button>
          )}
          {onImportAsChapter && (
            <button
              onClick={() => onImportAsChapter(sourceId)}
              className="h-8 px-3 text-xs font-medium rounded-md border border-border
                         hover:bg-gray-50 transition-colors text-foreground"
            >
              Import as New Chapter
            </button>
          )}
          {canAnalyze && (
            <button
              onClick={() => setAnalysisOpen((prev) => !prev)}
              className={`h-8 px-3 text-xs font-medium rounded-md transition-colors ${
                analysisOpen
                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                  : "border border-border hover:bg-gray-50 text-foreground"
              }`}
            >
              {analysisOpen ? "Hide Analysis" : "Analyze with AI"}
            </button>
          )}
        </div>
      )}

      {/* AI Analysis Panel */}
      {analysisOpen && canAnalyze && (
        <div className="shrink-0 border-b border-border px-4 py-3 space-y-3 bg-gray-50/50">
          <InstructionManager
            type="analysis"
            onSelectInstruction={(inst) => setSelectedInstruction(inst.instructionText)}
          />

          {selectedInstruction && (
            <div className="p-2 bg-white rounded-md border text-xs text-gray-700">
              {selectedInstruction}
            </div>
          )}

          <button
            onClick={() => {
              if (!selectedInstruction) return;
              startAnalysis({
                connectionId: driveConnectionId!,
                fileId: driveFileId!,
                instruction: selectedInstruction,
              });
            }}
            disabled={!selectedInstruction || analysisLoading}
            className="w-full h-9 text-sm font-medium rounded-md bg-purple-600 text-white
                       hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {analysisLoading && (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {analysisLoading ? "Analyzing..." : "Run Analysis"}
          </button>

          {analysisError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {analysisError}
            </div>
          )}

          {analysisResult && (
            <div className="p-3 bg-white rounded-md border text-sm text-gray-800 leading-relaxed whitespace-pre-wrap max-h-60 overflow-auto">
              {analysisResult}
              {analysisLoading && (
                <span
                  className="inline-block w-0.5 h-4 bg-purple-600 ml-0.5 align-text-bottom animate-pulse"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Hint banner */}
      {showHint && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-500 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-blue-700">Tip: Select text to save passages to Clips</p>
          <button
            onClick={() => setShowHint(false)}
            className="ml-auto text-blue-400 hover:text-blue-600"
            aria-label="Dismiss hint"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading document...
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="px-4 py-3 m-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => fetchContent(sourceId)}
              className="text-xs text-red-600 underline mt-1"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loaded content with search and scroll-to */}
        {!isLoading && !error && content && (
          <div className="flex-1 min-h-0 relative">
            <SourceContentRenderer
              content={content}
              searchEnabled={true}
              scrollToText={scrollToText ?? undefined}
              onTextSelect={handleTextSelect}
            />

            {/* Floating selection toolbar */}
            {selectedText && (
              <SelectionToolbar
                chapters={chapters}
                onSaveToClips={handleSaveToClips}
                onCopy={handleCopy}
                isSaving={isSaving}
                isSaved={isCurrentSelectionSaved}
              />
            )}
          </div>
        )}

        {/* Empty content (loaded but no content) */}
        {!isLoading && !error && !content && wordCount === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <p className="text-sm text-muted-foreground">
              No content available for this source yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
