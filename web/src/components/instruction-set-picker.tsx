"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Instruction definition with label and system prompt behavior.
 */
export interface DefaultInstruction {
  /** Display label for the chip (e.g., "Simpler language") */
  label: string;
  /** Full instruction text sent to the AI */
  instructionText: string;
}

/**
 * Three instruction sets for different contexts:
 * - chapter: Text rewriting in Chapter View (5 chips)
 * - book: Cross-chapter analysis in Book View (4 chips)
 * - desk: Source document analysis in Library/Desk (4 chips)
 */
export type InstructionSetType = "chapter" | "book" | "desk";

/**
 * Chapter set (5 chips) — text rewriting in Chapter View.
 * "Stronger" was flagged as vague → resolved to "More direct"
 */
export const CHAPTER_INSTRUCTIONS: DefaultInstruction[] = [
  {
    label: "Simpler language",
    instructionText:
      "Rewrite using simpler, more accessible vocabulary. Prefer common words over jargon. Aim for an 8th-grade reading level while preserving the core meaning and technical accuracy.",
  },
  {
    label: "More concise",
    instructionText:
      "Make this more concise. Remove filler words, redundant phrases, and unnecessary qualifiers. Keep the essential meaning in fewer words.",
  },
  {
    label: "More conversational",
    instructionText:
      "Rewrite in a more conversational, friendly tone. Use contractions, shorter sentences, and direct address where appropriate. It should sound like one person talking to another.",
  },
  {
    label: "More direct",
    instructionText:
      "Make this more direct and assertive. Lead with the main point. Remove hedging language like 'perhaps', 'maybe', 'it seems', 'in my opinion'. State claims confidently.",
  },
  {
    label: "Expand",
    instructionText:
      "Expand this passage with more detail. Add examples, explanations, or supporting points. Develop the ideas more fully while maintaining the original voice and structure.",
  },
];

/**
 * Book set (4 chips) — cross-chapter analysis in Book View.
 */
export const BOOK_INSTRUCTIONS: DefaultInstruction[] = [
  {
    label: "Find redundancies",
    instructionText:
      "Analyze these chapters for redundant content. Identify passages that repeat the same ideas, examples, or explanations. List specific locations and suggest which to keep or consolidate.",
  },
  {
    label: "Find contradictions",
    instructionText:
      "Scan these chapters for contradictions or inconsistencies. Flag any places where claims, data, or recommendations conflict with each other. Quote the specific passages that contradict.",
  },
  {
    label: "Find recurring topics",
    instructionText:
      "Identify recurring themes, topics, or concepts across these chapters. List each recurring element with the chapters where it appears. Note if any topic deserves its own dedicated chapter.",
  },
  {
    label: "Suggest connections",
    instructionText:
      "Analyze the relationships between these chapters. Suggest transitions, cross-references, or connections that could strengthen the narrative flow. Identify ideas in one chapter that could be referenced or built upon in another.",
  },
];

/**
 * Desk set (4 chips) — source document analysis in Library/Desk.
 */
export const DESK_INSTRUCTIONS: DefaultInstruction[] = [
  {
    label: "Summarize",
    instructionText:
      "Provide a concise summary of this document. Capture the main argument, key findings, and conclusions in 2-3 paragraphs. Focus on what's most relevant for a nonfiction book author.",
  },
  {
    label: "Find key points",
    instructionText:
      "Extract the key points, main arguments, and notable claims from this document as a bulleted list. Include page numbers or section references where possible.",
  },
  {
    label: "Extract quotes",
    instructionText:
      "Find quotable passages in this document — memorable phrases, strong claims, vivid examples, or statistics that could be cited in a book. List each quote with its context.",
  },
  {
    label: "Suggest connections",
    instructionText:
      "Analyze how this source connects to the other selected documents. Identify shared themes, complementary perspectives, or contrasting viewpoints. Suggest how these sources could be synthesized.",
  },
];

/**
 * Get the default instructions for a given set type.
 */
export function getInstructionSet(type: InstructionSetType): DefaultInstruction[] {
  switch (type) {
    case "chapter":
      return CHAPTER_INSTRUCTIONS;
    case "book":
      return BOOK_INSTRUCTIONS;
    case "desk":
      return DESK_INSTRUCTIONS;
    default:
      return CHAPTER_INSTRUCTIONS;
  }
}

interface InstructionSetPickerProps {
  /** Which instruction set to display */
  type: InstructionSetType;
  /** Currently selected instruction text (for tracking selection state) */
  selectedInstruction?: string;
  /** Called when a chip is selected. Receives the full instruction text. */
  onSelect: (instructionText: string) => void;
  /** Called when "+ Custom" is selected. Parent should focus the textarea. */
  onCustom?: () => void;
  /** Whether the picker is disabled (e.g., during streaming) */
  disabled?: boolean;
}

/**
 * InstructionSetPicker — chip-based selector for default AI instructions.
 *
 * Displays a horizontal row of tappable chips for common instructions,
 * plus a "+ Custom" option for freeform input.
 *
 * ARIA: role="listbox" with role="option" and aria-selected for accessibility.
 * Touch targets meet 44px minimum height requirement.
 */
export function InstructionSetPicker({
  type,
  selectedInstruction,
  onSelect,
  onCustom,
  disabled = false,
}: InstructionSetPickerProps) {
  const instructions = getInstructionSet(type);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Find which chip is currently selected based on instruction text match
  const selectedIndex = instructions.findIndex(
    (inst) => inst.instructionText === selectedInstruction,
  );
  const isCustomSelected = Boolean(selectedInstruction) && selectedIndex === -1;

  // Total options count (instructions + custom button)
  const totalOptions = instructions.length + 1;

  // Handle keyboard navigation within the listbox
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % totalOptions);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
        break;
      case "Home":
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        event.preventDefault();
        setFocusedIndex(totalOptions - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < instructions.length) {
          onSelect(instructions[focusedIndex].instructionText);
        } else if (focusedIndex === instructions.length && onCustom) {
          onCustom();
        }
        break;
    }
  };

  // Focus the appropriate chip when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && listboxRef.current) {
      const buttons = listboxRef.current.querySelectorAll('[role="option"]');
      if (buttons[focusedIndex]) {
        (buttons[focusedIndex] as HTMLElement).focus();
      }
    }
  }, [focusedIndex]);

  return (
    <div
      ref={listboxRef}
      role="listbox"
      aria-label={`${type} instruction options`}
      aria-orientation="horizontal"
      aria-disabled={disabled}
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-2"
    >
      {instructions.map((instruction, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={instruction.label}
            role="option"
            aria-selected={isSelected}
            tabIndex={focusedIndex === index ? 0 : -1}
            onClick={() => !disabled && onSelect(instruction.instructionText)}
            disabled={disabled}
            className={`
              px-3 py-1.5 rounded-full text-sm font-medium
              min-h-[36px] min-w-[44px]
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            `}
          >
            {instruction.label}
          </button>
        );
      })}

      {/* Custom option */}
      {onCustom && (
        <button
          role="option"
          aria-selected={isCustomSelected}
          tabIndex={focusedIndex === instructions.length ? 0 : -1}
          onClick={() => !disabled && onCustom()}
          disabled={disabled}
          className={`
            px-3 py-1.5 rounded-full text-sm font-medium
            min-h-[36px] min-w-[44px]
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              isCustomSelected
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600 border border-blue-300 hover:bg-blue-50"
            }
          `}
        >
          + Custom
        </button>
      )}
    </div>
  );
}
