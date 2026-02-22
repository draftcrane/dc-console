import type { D1Database } from "@cloudflare/workers-types";
import { ulid } from "ulidx";

export interface AIInstruction {
  id: string;
  userId: string;
  label: string;
  instructionText: string;
  type: "analysis" | "rewrite";
  createdAt: string;
  updatedAt: string;
}

export class AIInstructionService {
  constructor(private readonly db: D1Database) {}

  private mapRowToInstruction(row: any): AIInstruction {
    return {
      id: row.id,
      userId: row.user_id,
      label: row.label,
      instructionText: row.instruction_text,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listForUser(userId: string, type?: "analysis" | "rewrite"): Promise<AIInstruction[]> {
    let statement;
    if (type) {
      statement = this.db
        .prepare(
          "SELECT * FROM ai_instructions WHERE user_id = ? AND type = ? ORDER BY created_at ASC",
        )
        .bind(userId, type);
    } else {
      statement = this.db
        .prepare("SELECT * FROM ai_instructions WHERE user_id = ? ORDER BY created_at ASC")
        .bind(userId);
    }
    const { results } = await statement.all();
    return results.map(this.mapRowToInstruction);
  }

  async create(
    userId: string,
    data: { label: string; instructionText: string; type: "analysis" | "rewrite" },
  ): Promise<AIInstruction> {
    const newInstruction: AIInstruction = {
      id: `instr_${ulid()}`,
      userId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db
      .prepare(
        "INSERT INTO ai_instructions (id, user_id, label, instruction_text, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        newInstruction.id,
        newInstruction.userId,
        newInstruction.label,
        newInstruction.instructionText,
        newInstruction.type,
        newInstruction.createdAt,
        newInstruction.updatedAt,
      )
      .run();

    return newInstruction;
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.db
      .prepare("DELETE FROM ai_instructions WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();

    if (result.meta.changes === 0) {
      throw new Error("Instruction not found or user does not have permission");
    }
  }
}
