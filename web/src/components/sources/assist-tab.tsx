"use client";

import { useState, useCallback } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { InstructionPicker } from "./instruction-picker";
import { EmptyState } from "./empty-state";
import { useToast } from "@/components/toast";

/**
 * Assist tab — AI-powered source analysis with SSE streaming.
 *
 * Features:
 * - Source selector (pre-populated if user came via "Analyze" action)
 * - Instruction picker for saved analysis instructions
 * - Freeform text field for custom instructions
 * - Streaming response with blinking cursor
 * - Error handling with retry affordance
 * - Copy/Insert actions on completion
 */
export function AssistTab() {
  const {
    sources,
    selectedSourceId,
    selectSource,
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
  const [instruction, setInstruction] = useState("Summarize key points");
  const [sourceId, setSourceId] = useState<string>(selectedSourceId || "");

  // Sync sourceId when selectedSourceId changes (e.g., coming from "Analyze" button)
  // Uses the React-recommended "adjusting state during render" pattern
  const [prevSelectedSourceId, setPrevSelectedSourceId] = useState(selectedSourceId);
  if (selectedSourceId && selectedSourceId !== prevSelectedSourceId) {
    setPrevSelectedSourceId(selectedSourceId);
    setSourceId(selectedSourceId);
  }

  const handleAnalyze = useCallback(() => {
    if (!sourceId || !instruction.trim()) return;
    analyze(projectId, sourceId, instruction);
  }, [sourceId, instruction, projectId, analyze]);

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

  // No sources
  if (sources.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        }
        message="Add sources to use AI analysis"
        description="Import sources from your Drive or upload files first."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Source selector */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Source</label>
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              selectSource(e.target.value || null);
            }}
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       bg-white min-h-[44px]"
          >
            <option value="">Select a source...</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

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
            placeholder="What would you like to know about this source?"
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
          disabled={!sourceId || !instruction.trim() || isAnalyzing}
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
          ) : (
            "Analyze"
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
