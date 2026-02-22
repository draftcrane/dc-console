"use client";

import { useState } from "react";
import { useAiInstructions, type AIInstruction } from "@/hooks/use-ai-instructions";

interface InstructionManagerProps {
  type: "analysis" | "rewrite";
  onSelectInstruction: (instruction: AIInstruction) => void;
}

export function InstructionManager({ type, onSelectInstruction }: InstructionManagerProps) {
  const { instructions, createInstruction, isLoading } = useAiInstructions({ type });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newInstructionText, setNewInstructionText] = useState("");

  const handleAdd = async () => {
    if (!newLabel || !newInstructionText) return;
    await createInstruction({ label: newLabel, instructionText: newInstructionText });
    setNewLabel("");
    setNewInstructionText("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase">Instructions</h4>
      {isLoading && <p className="text-xs text-gray-400">Loading instructions...</p>}

      <div className="flex flex-wrap gap-2">
        {instructions.map((inst) => (
          <button
            key={inst.id}
            onClick={() => onSelectInstruction(inst)}
            className="px-2 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200"
          >
            {inst.label}
          </button>
        ))}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-2 py-1 text-xs border border-dashed rounded-md hover:bg-gray-50"
        >
          {showAddForm ? "Cancel" : "+ New"}
        </button>
      </div>

      {showAddForm && (
        <div className="p-2 border rounded-md space-y-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g., 'Summarize')"
            className="w-full p-2 text-sm border rounded-md"
          />
          <textarea
            value={newInstructionText}
            onChange={(e) => setNewInstructionText(e.target.value)}
            placeholder="Instruction text..."
            className="w-full p-2 text-sm border rounded-md"
            rows={3}
          />
          <button
            onClick={handleAdd}
            className="w-full p-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Instruction
          </button>
        </div>
      )}
    </div>
  );
}
