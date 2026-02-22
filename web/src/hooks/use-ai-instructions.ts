import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface AIInstruction {
  id: string;
  label: string;
  instructionText: string;
  type: "analysis" | "rewrite";
}

interface UseAiInstructionsParams {
  type: "analysis" | "rewrite";
}

export function useAiInstructions({ type }: UseAiInstructionsParams) {
  const { getToken } = useAuth();
  const [instructions, setInstructions] = useState<AIInstruction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstructions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/ai/instructions?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch instructions");
      const data = await response.json();
      setInstructions(data.instructions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, type]);

  useEffect(() => {
    fetchInstructions();
  }, [fetchInstructions]);

  const createInstruction = async (data: { label: string; instructionText: string }) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/ai/instructions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, type }),
      });
      if (!response.ok) throw new Error("Failed to create instruction");
      const newInstruction = await response.json();
      setInstructions((prev) => [...prev, newInstruction]);
      return newInstruction;
    } catch (err) {
      // Handle error in UI
      console.error(err);
      return null;
    }
  };

  const deleteInstruction = async (id: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/ai/instructions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to delete instruction");
      setInstructions((prev) => prev.filter((inst) => inst.id !== id));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return {
    instructions,
    isLoading,
    error,
    createInstruction,
    deleteInstruction,
    refetch: fetchInstructions,
  };
}
