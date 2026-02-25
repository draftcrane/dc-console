"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AIRewriteResult, SheetState } from "@/hooks/use-ai-rewrite";
import { StreamingResponse } from "./streaming-response";
import { useSourcesContext } from "@/contexts/sources-context";
import { InstructionPicker } from "@/components/sources/instruction-picker";
import { CHAPTER_INSTRUCTIONS } from "@/components/instruction-set-picker";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type EditorPanelState = "empty" | "streaming" | "complete" | "error";

interface ChapterEditorPanelProps {
  /** Current state of the rewrite sheet */
  sheetState: SheetState;
  /** The current AI rewrite result being reviewed */
  result: AIRewriteResult | null;
  /** Error message to display inline */
  errorMessage: string | null;
  /** The currently selected text from the editor */
  selectedText: string;
  /** Called when user taps "Use This" — accepts the rewrite */
  onAccept: (result: AIRewriteResult) => void;
  /** Called when user taps "Try Again" — sends a new request */
  onRetry: (result: AIRewriteResult, instruction: string) => void;
  /** Called when user taps "Discard" / "Cancel" */
  onDiscard: (result: AIRewriteResult) => void;
  /** Called when user taps "Go Deeper" — escalate to frontier */
  onGoDeeper?: (result: AIRewriteResult) => void;
  /** Called when user selects a chip or types instruction and triggers rewrite */
  onRewriteWithInstruction?: (instruction: string) => void;
}

/**
 * ChapterEditorPanel — Chapter-mode content for the Editor Panel.
 *
 * Displays:
 * 1. Selected text display area (collapsible for long selections)
 * 2. Instruction chips (5 defaults + Custom via InstructionPicker)
 * 3. Freeform instruction text field
 * 4. Streaming response area with blinking cursor
 * 5. Action buttons: Discard, Try Again, Use This
 *
 * The panel persists after accept/reject — ready for next selection.
 * Per Design Charter: "Rewrite" not "AI Rewrite". "Editor" not "AI Assistant".
 */
export function ChapterEditorPanel({
  sheetState,
  result,
  errorMessage,
  selectedText,
  onAccept,
  onRetry,
  onDiscard,
  onGoDeeper,
  onRewriteWithInstruction,
}: ChapterEditorPanelProps) {
  const { rewriteInstructions, createInstruction, updateInstruction, removeInstruction } =
    useSourcesContext();

  const [editedInstruction, setEditedInstruction] = useState("");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [lastResultId, setLastResultId] = useState<string | null>(null);
  const [selectedExpanded, setSelectedExpanded] = useState(false);
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = sheetState === "streaming";
  const isComplete = sheetState === "complete";
  const isIdle = sheetState === "idle";
  const hasResult = result !== null;
  const hasSelectedText = selectedText.length > 0;

  // Derive panel state
  const panelState: EditorPanelState = (() => {
    if (errorMessage && !result?.rewriteText) return "error";
    if (isStreaming) return "streaming";
    if (isComplete && hasResult) return "complete";
    return "empty";
  })();

  // Sync instruction field when new result arrives
  const resultId = result?.interactionId ?? null;
  const streamingKey =
    result && !result.interactionId && sheetState === "streaming" ? "streaming" : null;
  const trackingKey = resultId || streamingKey;

  if (trackingKey && trackingKey !== lastResultId) {
    if (!hasUserEdited) setEditedInstruction("");
    setHasUserEdited(false);
    setLastResultId(trackingKey);
    if (resultId) {
      const isShort = result!.originalText.split(/\s+/).length < 50;
      setSelectedExpanded(isShort);
    }
  }

  // Handle chip selection
  const handleChipSelect = useCallback(
    (instruction: string) => {
      setEditedInstruction(instruction);
      setHasUserEdited(true);

      // If we have a result, treat as retry with new instruction
      if (hasResult && result) {
        onRetry(result, instruction);
      } else if (onRewriteWithInstruction) {
        onRewriteWithInstruction(instruction);
      }
    },
    [hasResult, result, onRetry, onRewriteWithInstruction],
  );

  // Handle freeform instruction submit
  const handleInstructionSubmit = useCallback(() => {
    const instruction = editedInstruction.trim();
    if (!instruction) return;

    if (hasResult && result) {
      onRetry(result, instruction);
    } else if (onRewriteWithInstruction) {
      onRewriteWithInstruction(instruction);
    }
  }, [editedInstruction, hasResult, result, onRetry, onRewriteWithInstruction]);

  // Handle keyboard shortcut for instruction submit
  const handleInstructionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleInstructionSubmit();
      }
    },
    [handleInstructionSubmit],
  );

  const handleAccept = useCallback(() => {
    if (result) onAccept(result);
  }, [result, onAccept]);

  const handleRetry = useCallback(() => {
    if (result) {
      onRetry(result, editedInstruction.trim() || result.instruction);
      setHasUserEdited(false);
    }
  }, [result, editedInstruction, onRetry]);

  const handleDiscard = useCallback(() => {
    if (result) onDiscard(result);
  }, [result, onDiscard]);

  const handleGoDeeper = useCallback(() => {
    if (result && onGoDeeper) onGoDeeper(result);
  }, [result, onGoDeeper]);

  // Focus instruction field when panel becomes idle with selected text
  useEffect(() => {
    if (isIdle && hasSelectedText && instructionRef.current) {
      instructionRef.current.focus();
    }
  }, [isIdle, hasSelectedText]);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
        {/* Empty state — no text selected */}
        {!hasSelectedText && panelState === "empty" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-10 h-10 text-[var(--dc-color-text-placeholder)] mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <p className="text-sm text-[var(--dc-color-text-muted)]">
              Select text in your chapter to start rewriting.
            </p>
          </div>
        )}

        {/* Selected text display */}
        {hasSelectedText && (
          <div>
            <button
              type="button"
              onClick={() => setSelectedExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 min-h-[44px] text-xs font-medium text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)] transition-colors"
              aria-expanded={selectedExpanded}
              aria-controls="selected-text-content"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-150 ${selectedExpanded ? "rotate-90" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
              Selected text
            </button>
            {selectedExpanded && (
              <div
                id="selected-text-content"
                className="mt-1 p-3 bg-[var(--dc-color-surface-secondary)] rounded-lg text-xs text-[var(--dc-color-text-secondary)] leading-relaxed whitespace-pre-wrap line-clamp-[10]"
              >
                {selectedText}
              </div>
            )}
          </div>
        )}

        {/* Instruction chips - unified from CHAPTER_INSTRUCTIONS (#358) */}
        {hasSelectedText && (
          <div>
            <div
              className="flex flex-wrap gap-1.5"
              role="listbox"
              aria-label="Rewrite instructions"
            >
              {CHAPTER_INSTRUCTIONS.map((inst) => (
                <button
                  key={inst.label}
                  type="button"
                  role="option"
                  aria-selected={editedInstruction === inst.instructionText}
                  onClick={() => handleChipSelect(inst.instructionText)}
                  disabled={isStreaming}
                  className={`h-9 px-3 text-xs font-medium rounded-full transition-colors
                             min-h-[36px] border
                             ${
                               editedInstruction === inst.instructionText
                                 ? "bg-[var(--dc-color-interactive-escalation-subtle)] text-[var(--dc-color-interactive-escalation)] border-[var(--dc-color-interactive-escalation-border)]"
                                 : "bg-white text-[var(--dc-color-text-secondary)] border-[var(--dc-color-border-strong)] hover:bg-[var(--dc-color-interactive-escalation-subtle)] hover:border-[var(--dc-color-interactive-escalation-border)]"
                             }
                             disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {inst.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Freeform instruction field */}
        {hasSelectedText && (
          <div>
            <label
              htmlFor="editor-panel-instruction"
              className="text-xs font-medium text-[var(--dc-color-text-muted)] mb-1.5 block"
            >
              Custom instruction
            </label>
            <div className="flex gap-2">
              <textarea
                id="editor-panel-instruction"
                ref={instructionRef}
                value={editedInstruction || (result?.instruction ?? "")}
                onChange={(e) => {
                  setEditedInstruction(e.target.value);
                  setHasUserEdited(true);
                }}
                onKeyDown={handleInstructionKeyDown}
                disabled={isStreaming}
                className="flex-1 p-2.5 text-sm border border-[var(--dc-color-border-strong)] rounded-lg resize-none
                           focus:outline-none focus:ring-2 focus:ring-[var(--dc-color-interactive-escalation)] focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed
                           placeholder:text-[var(--dc-color-text-placeholder)]"
                rows={2}
                placeholder="Type an instruction or select a chip above..."
              />
              <button
                type="button"
                onClick={handleInstructionSubmit}
                disabled={isStreaming || !editedInstruction.trim()}
                className="self-end h-10 w-10 shrink-0 flex items-center justify-center rounded-lg
                           bg-[var(--dc-color-interactive-escalation)] text-white
                           hover:bg-[var(--dc-color-interactive-escalation-hover)]
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors min-h-[44px] min-w-[44px]"
                aria-label="Send instruction"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-1.5">
              <InstructionPicker
                instructions={rewriteInstructions}
                type="rewrite"
                onSelect={(text) => {
                  setEditedInstruction(text);
                  setHasUserEdited(true);
                }}
                onCreate={async (input) => {
                  await createInstruction(input);
                }}
                onUpdate={updateInstruction}
                onRemove={removeInstruction}
              />
            </div>
          </div>
        )}

        {/* Streaming response area */}
        {hasResult && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-[var(--dc-color-interactive-escalation)]">
                Rewrite
              </h3>
              {isStreaming && (
                <span className="text-xs text-[var(--dc-color-interactive-escalation)] flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
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
                  Writing...
                </span>
              )}
              {isComplete && result.attemptNumber > 0 && (
                <span className="text-xs text-[var(--dc-color-text-muted)]">
                  Attempt {result.attemptNumber}
                </span>
              )}
            </div>
            <StreamingResponse
              text={result.rewriteText}
              isStreaming={isStreaming}
              errorMessage={errorMessage}
            />
          </div>
        )}
      </div>

      {/* Action buttons — pinned to bottom */}
      {hasResult && (
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex gap-2 shrink-0">
          {/* Discard / Cancel */}
          <button
            type="button"
            onClick={handleDiscard}
            className="flex-1 h-10 rounded-lg border border-[var(--dc-color-border-strong)] text-sm font-medium
                       text-[var(--dc-color-text-secondary)]
                       hover:bg-[var(--dc-color-surface-secondary)] transition-colors
                       min-w-[44px] min-h-[44px]"
            aria-label={isStreaming ? "Cancel rewrite" : "Discard rewrite"}
          >
            {isStreaming ? "Cancel" : "Discard"}
          </button>

          {/* Try Again */}
          <button
            type="button"
            onClick={handleRetry}
            disabled={isStreaming}
            className="flex-1 h-10 rounded-lg border border-[var(--dc-color-interactive-escalation-border)] text-sm font-medium
                       text-[var(--dc-color-interactive-escalation)]
                       hover:bg-[var(--dc-color-interactive-escalation-subtle)] transition-colors
                       min-w-[44px] min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Try again with current instruction"
          >
            Try Again
          </button>

          {/* Go Deeper — shown only for edge tier results that are complete */}
          {isComplete && result.tier === "edge" && onGoDeeper && (
            <button
              type="button"
              onClick={handleGoDeeper}
              className="flex-1 h-10 rounded-lg border border-[var(--dc-color-interactive-escalation-border)] text-sm font-medium
                         text-[var(--dc-color-interactive-escalation)]
                         hover:bg-[var(--dc-color-interactive-escalation-subtle)] transition-colors
                         min-w-[44px] min-h-[44px]"
              aria-label="Rewrite with more powerful model"
            >
              Go Deeper
            </button>
          )}

          {/* Use This (primary action) */}
          <button
            type="button"
            onClick={handleAccept}
            disabled={isStreaming || !result.rewriteText}
            className="flex-1 h-10 rounded-lg text-sm font-medium text-white
                       bg-[var(--dc-color-interactive-escalation)]
                       hover:bg-[var(--dc-color-interactive-escalation-hover)] transition-colors
                       min-w-[44px] min-h-[44px]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Use this rewrite to replace selected text"
          >
            Use This
          </button>
        </div>
      )}
    </div>
  );
}
