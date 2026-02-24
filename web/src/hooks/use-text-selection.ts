"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { countWordsInText } from "@/utils/word-count";

export interface FloatingBarPosition {
  /** Top position relative to the container element */
  top: number;
  /** Left position relative to the container element (centered) */
  left: number;
}

export interface TextSelectionState {
  /** Whether text is currently selected within the editor */
  hasSelection: boolean;
  /** The selected plain text */
  selectedText: string;
  /** Word count of the selected text */
  wordCount: number;
  /** Whether the selection exceeds the maximum word limit */
  exceedsLimit: boolean;
  /** Computed position for the floating bar, relative to the container */
  floatingBarPosition: FloatingBarPosition | null;
}

const MAX_WORDS = 2000;

/**
 * Gets the bounding rectangle of the current DOM selection,
 * merging all client rects into a single envelope.
 */
function getSelectionBounds(
  selection: Selection,
): { top: number; bottom: number; left: number; right: number; centerX: number } | null {
  if (selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();

  if (rects.length === 0) {
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      centerX: rect.left + rect.width / 2,
    };
  }

  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (rect.width === 0 && rect.height === 0) continue;
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
  }

  if (top === Infinity) return null;

  return {
    top,
    bottom,
    left,
    right,
    centerX: left + (right - left) / 2,
  };
}

/**
 * Computes the floating bar position relative to a container element.
 * Positions below the selection (opposite side from native iPadOS menu).
 */
function computeFloatingBarPosition(
  selectionBounds: { top: number; bottom: number; centerX: number },
  container: HTMLElement,
): FloatingBarPosition {
  const containerRect = container.getBoundingClientRect();
  const barHeight = 48;
  const gap = 8;

  // Position below the selection (opposite side from native iPadOS menu which appears above)
  let top = selectionBounds.bottom + gap - containerRect.top + container.scrollTop;
  const left = selectionBounds.centerX - containerRect.left;

  // Clamp horizontal position to stay within the container
  const barWidthEstimate = 160;
  const halfBar = barWidthEstimate / 2;
  const minLeft = halfBar + 8;
  const maxLeft = containerRect.width - halfBar - 8;
  const clampedLeft = Math.max(minLeft, Math.min(maxLeft, left));

  // If the bar would go below the visible area, show it above the selection instead
  const visibleBottom = container.scrollTop + containerRect.height;
  if (top + barHeight > visibleBottom) {
    top = selectionBounds.top - barHeight - gap - containerRect.top + container.scrollTop;
  }

  return { top, left: clampedLeft };
}

/**
 * Hook that tracks text selection within a Tiptap editor.
 *
 * Returns the current selection state including selected text,
 * word count, limit enforcement, and a pre-computed floating bar position.
 *
 * The selection state is updated with a configurable delay (default 200ms)
 * after the native iPadOS text menu appears, to avoid interference.
 *
 * @param editor - The Tiptap editor instance
 * @param containerRef - Ref to the container element used for position calculations
 * @param delay - Delay in ms before updating state (default: 200)
 */
export function useTextSelection(
  editor: Editor | null,
  containerRef: React.RefObject<HTMLElement | null>,
  delay = 200,
): TextSelectionState {
  const [state, setState] = useState<TextSelectionState>({
    hasSelection: false,
    selectedText: "",
    wordCount: 0,
    exceedsLimit: false,
    floatingBarPosition: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const updateSelection = useCallback(() => {
    if (!editor) {
      setState({
        hasSelection: false,
        selectedText: "",
        wordCount: 0,
        exceedsLimit: false,
        floatingBarPosition: null,
      });
      return;
    }

    const { from, to, empty } = editor.state.selection;

    if (empty || from === to) {
      setState({
        hasSelection: false,
        selectedText: "",
        wordCount: 0,
        exceedsLimit: false,
        floatingBarPosition: null,
      });
      return;
    }

    // Get the selected text from the editor document
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    const words = countWordsInText(selectedText);

    // Get DOM selection bounds and compute floating bar position
    const domSelection = window.getSelection();
    const bounds = domSelection ? getSelectionBounds(domSelection) : null;
    const container = containerRef.current;

    let floatingBarPosition: FloatingBarPosition | null = null;
    if (bounds && container) {
      floatingBarPosition = computeFloatingBarPosition(bounds, container);
    }

    setState({
      hasSelection: true,
      selectedText,
      wordCount: words,
      exceedsLimit: words > MAX_WORDS,
      floatingBarPosition,
    });
  }, [editor, containerRef]);

  useEffect(() => {
    if (!editor) return;

    // Listen to Tiptap's selection update event
    const handleSelectionUpdate = () => {
      clearTimer();
      timerRef.current = setTimeout(updateSelection, delay);
    };

    // Listen to Tiptap's blur event to clear selection state
    const handleBlur = () => {
      clearTimer();
      // Small delay to allow for click-on-floating-bar to register
      timerRef.current = setTimeout(() => {
        setState({
          hasSelection: false,
          selectedText: "",
          wordCount: 0,
          exceedsLimit: false,
          floatingBarPosition: null,
        });
      }, 150);
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    editor.on("blur", handleBlur);

    // Also listen to native selectionchange for handle-drag tracking
    const handleNativeSelectionChange = () => {
      if (!editor.isFocused) return;
      const { empty } = editor.state.selection;
      if (!empty) {
        clearTimer();
        timerRef.current = setTimeout(updateSelection, delay);
      }
    };

    document.addEventListener("selectionchange", handleNativeSelectionChange);

    return () => {
      clearTimer();
      editor.off("selectionUpdate", handleSelectionUpdate);
      editor.off("blur", handleBlur);
      document.removeEventListener("selectionchange", handleNativeSelectionChange);
    };
  }, [editor, delay, updateSelection, clearTimer]);

  return state;
}
