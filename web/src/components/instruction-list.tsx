"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { AIInstruction } from "@/hooks/use-ai-instructions";
import { useToast } from "@/components/toast";

// ── Types ──

interface InstructionListProps {
  instructions: AIInstruction[];
  type: "desk" | "book" | "chapter";
  onSelect: (instruction: AIInstruction) => void;
  onCreate: (input: {
    label: string;
    instructionText: string;
    type: "desk" | "book" | "chapter";
  }) => Promise<AIInstruction>;
  onUpdate?: (id: string, input: { label?: string; instructionText?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onTouch?: (id: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  variant?: "primary" | "escalation";
}

// ── Constants ──

const SEARCH_THRESHOLD = 6;
const RECENTS_COUNT = 3;
const DELETE_UNDO_DURATION = 5000;

// ── Component ──

/**
 * InstructionList — unified instruction selector with recents, search,
 * inline CRUD, and manage mode.
 *
 * Replaces InstructionSetPicker (default chips) and InstructionPicker
 * (saved instructions dropdown) with a single vertical list.
 */
export function InstructionList({
  instructions,
  type,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onTouch,
  isLoading,
  disabled = false,
  variant = "primary",
}: InstructionListProps) {
  const { showToast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isManaging, setIsManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editText, setEditText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newText, setNewText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Refs
  const listboxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const newLabelRef = useRef<HTMLInputElement>(null);

  // Variant tokens
  const tokens = variant === "escalation" ? escalationTokens : primaryTokens;

  // ── Derived data ──

  const showSearch = instructions.length >= SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return instructions;
    const q = searchQuery.toLowerCase();
    return instructions.filter((inst) => inst.label.toLowerCase().includes(q));
  }, [instructions, searchQuery]);

  const recents = useMemo(() => {
    return instructions
      .filter((inst) => inst.lastUsedAt !== null)
      .sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""))
      .slice(0, RECENTS_COUNT);
  }, [instructions]);

  const alphabetical = useMemo(() => {
    return [...filtered].sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered]);

  // Recents only shown when not searching and not managing
  const showRecents = recents.length > 0 && !searchQuery.trim() && !isManaging;

  // All visible items for keyboard navigation
  const visibleItems = useMemo(() => {
    const items: AIInstruction[] = [];
    if (showRecents) {
      items.push(...recents);
    }
    items.push(...alphabetical);
    return items;
  }, [showRecents, recents, alphabetical]);

  // ── Handlers ──

  const handleSelect = useCallback(
    (instruction: AIInstruction) => {
      if (disabled || isManaging) return;
      onTouch?.(instruction.id);
      onSelect(instruction);
    },
    [disabled, isManaging, onSelect, onTouch],
  );

  const handleStartEdit = useCallback((instruction: AIInstruction) => {
    setEditingId(instruction.id);
    setEditLabel(instruction.label);
    setEditText(instruction.instructionText);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !onUpdate) return;
    if (!editLabel.trim() || !editText.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(editingId, { label: editLabel.trim(), instructionText: editText.trim() });
      setEditingId(null);
    } finally {
      setIsSaving(false);
    }
  }, [editingId, editLabel, editText, onUpdate]);

  const handleDelete = useCallback(
    async (instruction: AIInstruction) => {
      if (!onDelete) return;

      // Store for undo
      const { id, label } = instruction;
      let undone = false;

      // Optimistic delete — the hook handles it
      await onDelete(id);

      showToast(`Deleted "${label}"`, DELETE_UNDO_DURATION, {
        label: "Undo",
        onClick: () => {
          undone = true;
          // Re-create the instruction to undo
          onCreate({
            label: instruction.label,
            instructionText: instruction.instructionText,
            type,
          }).catch(() => {
            // Best-effort undo
          });
        },
      });

      // The undone variable is used by the closure above
      void undone;
    },
    [onDelete, onCreate, type, showToast],
  );

  const handleCreate = useCallback(async () => {
    if (!newLabel.trim() || !newText.trim()) return;
    setIsSaving(true);
    try {
      await onCreate({
        label: newLabel.trim(),
        instructionText: newText.trim(),
        type,
      });
      setNewLabel("");
      setNewText("");
      setIsCreating(false);
    } finally {
      setIsSaving(false);
    }
  }, [newLabel, newText, type, onCreate]);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setNewLabel("");
    setNewText("");
  }, []);

  // ── Keyboard navigation ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const count = visibleItems.length;
      if (count === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % count);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + count) % count);
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(count - 1);
          break;
        case "Enter":
        case " ":
          if (focusedIndex >= 0 && focusedIndex < count && !isManaging) {
            e.preventDefault();
            handleSelect(visibleItems[focusedIndex]);
          }
          break;
        case "Escape":
          setFocusedIndex(-1);
          searchRef.current?.blur();
          break;
      }
    },
    [disabled, visibleItems, focusedIndex, isManaging, handleSelect],
  );

  // Focus the item when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && listboxRef.current) {
      const items = listboxRef.current.querySelectorAll('[role="option"]');
      if (items[focusedIndex]) {
        (items[focusedIndex] as HTMLElement).focus();
      }
    }
  }, [focusedIndex]);

  // Focus new label input when create form opens
  useEffect(() => {
    if (isCreating && newLabelRef.current) {
      newLabelRef.current.focus();
    }
  }, [isCreating]);

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Empty state ──

  if (instructions.length === 0 && !isCreating) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-[var(--dc-color-text-muted)] mb-3">No instructions yet.</p>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          disabled={disabled}
          className={`text-sm font-medium ${tokens.textInteractive} hover:underline
                     disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]`}
        >
          Create your first instruction
        </button>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="space-y-0">
      {/* Header: search + manage toggle */}
      <div className="flex items-center gap-2 mb-1">
        {showSearch && (
          <div className="flex-1 relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--dc-color-text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(-1);
              }}
              placeholder="Search instructions"
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-[var(--dc-color-border-strong)] rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-[var(--dc-color-text-placeholder)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)]"
                aria-label="Clear search"
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
            )}
          </div>
        )}
        {onUpdate && onDelete && (
          <button
            type="button"
            onClick={() => {
              setIsManaging(!isManaging);
              setEditingId(null);
            }}
            className={`text-xs font-medium min-h-[32px] px-2 transition-colors
                       ${isManaging ? tokens.textInteractive : "text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)]"}`}
          >
            {isManaging ? "Done" : "Manage"}
          </button>
        )}
      </div>

      {/* SR-only status */}
      <div className="sr-only" aria-live="polite" role="status">
        {searchQuery
          ? `${filtered.length} instruction${filtered.length !== 1 ? "s" : ""} found`
          : `${instructions.length} instruction${instructions.length !== 1 ? "s" : ""}`}
      </div>

      {/* Listbox */}
      <div
        ref={listboxRef}
        role="listbox"
        aria-label={`${type} instructions`}
        onKeyDown={handleKeyDown}
        className="border border-[var(--dc-color-border-strong)] rounded-lg overflow-hidden bg-white"
      >
        {/* Recents section */}
        {showRecents && (
          <>
            {recents.map((inst, idx) => (
              <InstructionRow
                key={`recent-${inst.id}`}
                instruction={inst}
                isManaging={isManaging}
                isEditing={editingId === inst.id}
                editLabel={editLabel}
                editText={editText}
                isSaving={isSaving}
                disabled={disabled}
                tokens={tokens}
                tabIndex={focusedIndex === idx ? 0 : -1}
                onSelect={() => handleSelect(inst)}
                onStartEdit={() => handleStartEdit(inst)}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => handleDelete(inst)}
                onEditLabelChange={setEditLabel}
                onEditTextChange={setEditText}
              />
            ))}
            {/* Separator */}
            <div className="border-t border-[var(--dc-color-border-strong)]" />
          </>
        )}

        {/* Alphabetical section */}
        {alphabetical.length === 0 && searchQuery ? (
          <p className="px-3 py-4 text-xs text-[var(--dc-color-text-muted)] text-center">
            No matching instructions
          </p>
        ) : (
          alphabetical.map((inst, idx) => {
            const globalIdx = showRecents ? recents.length + idx : idx;
            return (
              <InstructionRow
                key={inst.id}
                instruction={inst}
                isManaging={isManaging}
                isEditing={editingId === inst.id}
                editLabel={editLabel}
                editText={editText}
                isSaving={isSaving}
                disabled={disabled}
                tokens={tokens}
                tabIndex={focusedIndex === globalIdx ? 0 : -1}
                onSelect={() => handleSelect(inst)}
                onStartEdit={() => handleStartEdit(inst)}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => handleDelete(inst)}
                onEditLabelChange={setEditLabel}
                onEditTextChange={setEditText}
              />
            );
          })
        )}

        {/* Create form / button — sticky at bottom */}
        {isCreating ? (
          <div className="px-3 py-2.5 space-y-2 bg-[var(--dc-color-surface-secondary)] border-t border-[var(--dc-color-border-strong)]">
            <input
              ref={newLabelRef}
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-[var(--dc-color-border-strong)] rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Label (e.g., 'Find counterarguments')"
              maxLength={100}
            />
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-[var(--dc-color-border-strong)] rounded-lg resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Instruction text"
              maxLength={2000}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newLabel.trim() || !newText.trim() || isSaving}
                className={`text-xs font-medium ${tokens.textInteractive} min-h-[32px]
                           disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelCreate}
                className="text-xs text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)] min-h-[32px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={disabled}
            className={`w-full px-3 py-2.5 text-xs font-medium ${tokens.textInteractive} text-left
                       hover:bg-[var(--dc-color-surface-secondary)] transition-colors
                       min-h-[44px] border-t border-[var(--dc-color-border-strong)]
                       disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            + New instruction
          </button>
        )}
      </div>
    </div>
  );
}

// ── InstructionRow ──

interface InstructionRowProps {
  instruction: AIInstruction;
  isManaging: boolean;
  isEditing: boolean;
  editLabel: string;
  editText: string;
  isSaving: boolean;
  disabled: boolean;
  tokens: TokenSet;
  tabIndex: number;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onEditLabelChange: (value: string) => void;
  onEditTextChange: (value: string) => void;
}

function InstructionRow({
  instruction,
  isManaging,
  isEditing,
  editLabel,
  editText,
  isSaving,
  disabled,
  tokens,
  tabIndex,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditLabelChange,
  onEditTextChange,
}: InstructionRowProps) {
  if (isEditing) {
    return (
      <div className="px-3 py-2.5 space-y-2 bg-[var(--dc-color-surface-secondary)]">
        <input
          type="text"
          value={editLabel}
          onChange={(e) => onEditLabelChange(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs border border-[var(--dc-color-border-strong)] rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Label"
          maxLength={100}
          autoFocus
        />
        <textarea
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs border border-[var(--dc-color-border-strong)] rounded-lg resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          placeholder="Instruction text"
          maxLength={2000}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSaveEdit}
            disabled={!editLabel.trim() || !editText.trim() || isSaving}
            className={`text-xs font-medium ${tokens.textInteractive} min-h-[32px]
                       disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)] min-h-[32px]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="option"
      aria-selected={false}
      tabIndex={tabIndex}
      onClick={isManaging ? undefined : onSelect}
      className={`flex items-center gap-2 px-3 min-h-[48px] transition-colors
                  ${
                    isManaging
                      ? ""
                      : disabled
                        ? "opacity-50 cursor-not-allowed"
                        : `cursor-pointer ${tokens.rowHover} ${tokens.rowActive}`
                  }`}
    >
      <span className="flex-1 min-w-0 text-sm font-medium text-[var(--dc-color-text-primary)] truncate">
        {instruction.label}
      </span>
      {isManaging && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onStartEdit}
            className="p-1.5 text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)]
                       min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label={`Edit ${instruction.label}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-[var(--dc-color-text-muted)] hover:text-red-600
                       min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label={`Delete ${instruction.label}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Variant tokens ──

interface TokenSet {
  textInteractive: string;
  rowHover: string;
  rowActive: string;
}

const primaryTokens: TokenSet = {
  textInteractive: "text-blue-600",
  rowHover: "hover:bg-gray-50",
  rowActive: "active:bg-gray-100",
};

const escalationTokens: TokenSet = {
  textInteractive: "text-[var(--dc-color-interactive-escalation)]",
  rowHover: "hover:bg-[var(--dc-color-interactive-escalation-subtle)]",
  rowActive: "active:bg-[var(--dc-color-interactive-escalation-subtle)]",
};
