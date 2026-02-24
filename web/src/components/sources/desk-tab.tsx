"use client";

import { useState, useCallback, useMemo } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { InstructionPicker } from "./instruction-picker";
import { EmptyState } from "./empty-state";
import { useToast } from "@/components/toast";

/**
 * Desk tab — tagged documents workspace with multi-select AI analysis.
 *
 * Shows documents the user has "checked out" from the Library (tagged via bookmark).
 * Users select one or more documents, write an instruction, and run AI analysis.
 * Results can be copied or inserted into the current chapter.
 */
export function DeskTab() {
  const {
    sources,
    removeSource,
    analyze,
    analysisText,
    isAnalyzing,
    isAnalysisComplete,
    analysisError,
    resetAnalysis,
    analysisInstructions,
    createInstruction,
    updateInstruction,
    removeInstruction,
    editorRef,
    projectId,
    isPanelOpen,
    closePanel,
  } = useSourcesContext();

  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [instruction, setInstruction] = useState("Summarize key points");

  // Only active (tagged) sources appear on the desk
  const deskSources = useMemo(
    () => sources.filter((s) => s.status === "active"),
    [sources],
  );

  const allSelected = deskSources.length > 0 && selectedIds.size === deskSources.length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deskSources.map((s) => s.id)));
    }
  }, [allSelected, deskSources]);

  const handleUntag = useCallback(
    async (sourceId: string, title: string) => {
      try {
        await removeSource(sourceId);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(sourceId);
          return next;
        });
        showToast(`Removed "${title}" from desk`);
      } catch (err) {
        console.error("Failed to remove from desk:", err);
      }
    },
    [removeSource, showToast],
  );

  const handleAnalyze = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !instruction.trim()) return;
    analyze(projectId, ids, instruction);
  }, [selectedIds, instruction, projectId, analyze]);

  const handleRetry = useCallback(() => {
    resetAnalysis();
    handleAnalyze();
  }, [resetAnalysis, handleAnalyze]);

  const handleCopy = useCallback(async () => {
    if (!analysisText) return;
    try {
      await navigator.clipboard.writeText(analysisText);
      showToast("Copied to clipboard");
    } catch {
      showToast("Failed to copy");
    }
  }, [analysisText, showToast]);

  const handleInsert = useCallback(() => {
    if (!analysisText) return;
    const editor = editorRef.current?.getEditor();
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const hasCursor = from === to && from > 0;

    if (hasCursor) {
      editor.chain().focus().insertContent(`<p>${analysisText}</p>`).run();
      showToast("Inserted at cursor");
    } else {
      editor.chain().focus("end").insertContent(`<p>${analysisText}</p>`).run();
      showToast("Added to end of chapter");
    }

    const isPortrait = window.matchMedia("(max-width: 1023px)").matches;
    if (isPortrait && isPanelOpen) {
      closePanel();
    }
  }, [analysisText, editorRef, showToast, isPanelOpen, closePanel]);

  const handleSelectInstruction = useCallback((text: string) => {
    setInstruction(text);
  }, []);

  // Empty desk
  if (deskSources.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16"
            />
          </svg>
        }
        message="Tag documents from the Library to work with them here."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto min-h-0">
        {/* Document list header */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700
                       transition-colors min-h-[32px]"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                allSelected
                  ? "bg-blue-600 border-blue-600"
                  : "border-gray-300"
              }`}
            >
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-[10px] text-gray-400 ml-auto">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${deskSources.length} on desk`}
          </span>
        </div>

        {/* Document rows */}
        <div>
          {deskSources.map((source) => {
            const isSelected = selectedIds.has(source.id);
            return (
              <div
                key={source.id}
                className="flex items-center w-full border-b border-gray-50 hover:bg-gray-50"
              >
                {/* Checkbox + title (tap to select) */}
                <button
                  onClick={() => toggleSelect(source.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 px-4 min-h-[44px] cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <svg
                    className="w-4 h-4 text-blue-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm text-gray-900 truncate flex-1 text-left">
                    {source.title}
                  </span>
                </button>

                {/* Untag (remove from desk) */}
                <button
                  onClick={() => handleUntag(source.id, source.title)}
                  className="p-2 mr-1 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center
                             text-blue-600 hover:text-gray-400 transition-colors"
                  aria-label="Remove from desk"
                >
                  <svg className="w-5 h-5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Analysis section */}
        <div className="px-4 py-4 space-y-4">
          {/* Instruction area */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Instruction</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={isAnalyzing}
              className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
              rows={3}
              placeholder="What would you like to know about these documents?"
              maxLength={2000}
            />
            <div className="mt-2">
              <InstructionPicker
                instructions={analysisInstructions}
                type="analysis"
                onSelect={handleSelectInstruction}
                onCreate={async (input) => {
                  await createInstruction(input);
                }}
                onUpdate={updateInstruction}
                onRemove={removeInstruction}
              />
            </div>
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={selectedIds.size === 0 || !instruction.trim() || isAnalyzing}
            className="w-full h-10 rounded-lg bg-blue-600 text-sm font-medium text-white
                       hover:bg-blue-700 transition-colors min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
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
                Analyzing...
              </>
            ) : selectedIds.size === 0 ? (
              "Select documents to analyze"
            ) : (
              `Analyze ${selectedIds.size} document${selectedIds.size !== 1 ? "s" : ""}`
            )}
          </button>

          {/* Streaming response */}
          {(analysisText || isAnalyzing || analysisError) && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500">Analysis</h3>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900 leading-relaxed whitespace-pre-wrap min-h-[60px]">
                {analysisText}
                {isAnalyzing && (
                  <span
                    className="inline-block w-0.5 h-4 bg-blue-600 ml-0.5 align-text-bottom animate-pulse"
                    aria-hidden="true"
                  />
                )}
                {analysisError && (
                  <div className="mt-2">
                    <p className="text-xs text-red-600 mb-1">{analysisError}</p>
                    <button
                      onClick={handleRetry}
                      className="text-xs text-blue-600 hover:text-blue-700 min-h-[32px]"
                    >
                      Tap to retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action bar (shown when analysis is complete) */}
      {isAnalysisComplete && analysisText && !analysisError && (
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex-1 h-10 rounded-lg border border-gray-300 text-sm font-medium text-gray-700
                       hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            Copy
          </button>
          <button
            onClick={handleInsert}
            className="flex-1 h-10 rounded-lg bg-blue-600 text-sm font-medium text-white
                       hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            Insert into Chapter
          </button>
        </div>
      )}
    </div>
  );
}
