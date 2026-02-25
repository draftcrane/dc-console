"use client";

import { useState, useCallback } from "react";
import type { AIInstruction } from "@/hooks/use-ai-instructions";

interface InstructionPickerProps {
  instructions: AIInstruction[];
  type: "desk" | "book" | "chapter";
  onSelect: (instructionText: string) => void;
  onCreate: (input: {
    label: string;
    instructionText: string;
    type: "desk" | "book" | "chapter";
  }) => Promise<void>;
  onUpdate?: (id: string, input: { label?: string; instructionText?: string }) => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
}

/**
 * Dropdown for selecting saved instructions.
 * Compact: doesn't dominate the UI. Includes manage mode for edit/delete.
 */
export function InstructionPicker({
  instructions,
  type,
  onSelect,
  onCreate,
  onUpdate,
  onRemove,
}: InstructionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editText, setEditText] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSelect = useCallback(
    (instruction: AIInstruction) => {
      onSelect(instruction.instructionText);
      setIsOpen(false);
    },
    [onSelect],
  );

  const handleStartEdit = useCallback((instruction: AIInstruction) => {
    setEditingId(instruction.id);
    setEditLabel(instruction.label);
    setEditText(instruction.instructionText);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !onUpdate) return;
    await onUpdate(editingId, { label: editLabel, instructionText: editText });
    setEditingId(null);
  }, [editingId, editLabel, editText, onUpdate]);

  const handleCreate = useCallback(async () => {
    if (!newLabel.trim() || !newText.trim()) return;
    await onCreate({ label: newLabel.trim(), instructionText: newText.trim(), type });
    setNewLabel("");
    setNewText("");
    setIsAdding(false);
  }, [newLabel, newText, type, onCreate]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-700 transition-colors min-h-[44px] flex items-center"
      >
        Use saved instruction
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-500">Saved Instructions</span>
        <div className="flex items-center gap-2">
          {onUpdate && onRemove && (
            <button
              onClick={() => setIsManaging(!isManaging)}
              className="text-xs text-gray-500 hover:text-gray-700 min-h-[44px] flex items-center"
            >
              {isManaging ? "Done" : "Manage"}
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs text-gray-400 hover:text-gray-600 min-h-[44px] flex items-center px-1"
            aria-label="Close instruction picker"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Instruction list */}
      <div className="max-h-[200px] overflow-auto">
        {instructions.length === 0 && !isAdding && (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No saved instructions</p>
        )}

        {instructions.map((instruction) => (
          <div key={instruction.id}>
            {editingId === instruction.id ? (
              <div className="px-3 py-2 space-y-2 bg-gray-50">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                  placeholder="Label"
                />
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded resize-none"
                  rows={2}
                  placeholder="Instruction text"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="text-xs text-blue-600 hover:text-blue-700 min-h-[32px]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 min-h-[32px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 px-3 py-2 min-h-[44px] transition-colors
                            ${isManaging ? "" : "cursor-pointer hover:bg-gray-50 active:bg-gray-100"}`}
                onClick={isManaging ? undefined : () => handleSelect(instruction)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{instruction.label}</p>
                </div>
                {isManaging && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(instruction)}
                      className="p-1 text-gray-400 hover:text-gray-600 min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label={`Edit ${instruction.label}`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    {onRemove && (
                      <button
                        onClick={() => onRemove(instruction.id)}
                        className="p-1 text-gray-400 hover:text-red-600 min-h-[32px] min-w-[32px] flex items-center justify-center"
                        aria-label={`Delete ${instruction.label}`}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add new instruction */}
        {isAdding ? (
          <div className="px-3 py-2 space-y-2 bg-gray-50 border-t border-gray-100">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
              placeholder="Label (e.g., 'Find counterarguments')"
              maxLength={100}
            />
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded resize-none"
              rows={2}
              placeholder="Instruction text"
              maxLength={2000}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newLabel.trim() || !newText.trim()}
                className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 min-h-[32px]"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewLabel("");
                  setNewText("");
                }}
                className="text-xs text-gray-500 hover:text-gray-700 min-h-[32px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full px-3 py-2 text-xs text-blue-600 hover:bg-gray-50 text-left min-h-[44px] border-t border-gray-100"
          >
            + New instruction
          </button>
        )}
      </div>
    </div>
  );
}
