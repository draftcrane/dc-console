"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface AIInstruction {
  id: string;
  userId: string;
  label: string;
  instructionText: string;
  type: "analysis" | "rewrite";
  createdAt: string;
  updatedAt: string;
}

interface CreateInstructionInput {
  label: string;
  instructionText: string;
  type: "analysis" | "rewrite";
}

interface UpdateInstructionInput {
  label?: string;
  instructionText?: string;
}

interface UseAIInstructionsReturn {
  instructions: AIInstruction[];
  isLoading: boolean;
  create: (input: CreateInstructionInput) => Promise<AIInstruction>;
  update: (id: string, input: UpdateInstructionInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook to manage AI instructions (analysis + rewrite).
 * Accepts optional type filter to scope fetched instructions.
 */
export function useAIInstructions(type?: "analysis" | "rewrite"): UseAIInstructionsReturn {
  const { getToken } = useAuth();
  const [instructions, setInstructions] = useState<AIInstruction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInstructions = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      const params = type ? `?type=${type}` : "";
      const response = await fetch(`${API_URL}/ai/instructions${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch instructions");
      const data = await response.json();
      setInstructions(data.instructions || []);
    } catch (err) {
      console.error("Failed to fetch AI instructions:", err);
      setInstructions([]);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, type]);

  useEffect(() => {
    fetchInstructions();
  }, [fetchInstructions]);

  const create = useCallback(
    async (input: CreateInstructionInput): Promise<AIInstruction> => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/ai/instructions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          (data as { error?: string } | null)?.error || "Failed to create instruction",
        );
      }
      const data = await response.json();
      const created = data.instruction as AIInstruction;
      // Optimistic: append to local state from response
      setInstructions((prev) => [...prev, created]);
      return created;
    },
    [getToken],
  );

  const update = useCallback(
    async (id: string, input: UpdateInstructionInput): Promise<void> => {
      // Optimistic: update local state immediately
      setInstructions((prev) =>
        prev.map((inst) => (inst.id === id ? { ...inst, ...input } : inst)),
      );

      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/ai/instructions/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          // Rollback: refetch on failure
          await fetchInstructions();
          const data = await response.json().catch(() => null);
          throw new Error(
            (data as { error?: string } | null)?.error || "Failed to update instruction",
          );
        }
      } catch (err) {
        await fetchInstructions();
        throw err;
      }
    },
    [getToken, fetchInstructions],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      // Optimistic: remove from local state immediately
      const previous = instructions;
      setInstructions((prev) => prev.filter((inst) => inst.id !== id));

      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/ai/instructions/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          setInstructions(previous);
          throw new Error("Failed to delete instruction");
        }
      } catch (err) {
        setInstructions(previous);
        throw err;
      }
    },
    [getToken, instructions],
  );

  return {
    instructions,
    isLoading,
    create,
    update,
    remove,
    refetch: fetchInstructions,
  };
}
