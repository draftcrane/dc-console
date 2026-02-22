/**
 * AI Instructions Service — CRUD for saved AI analysis/rewrite instructions.
 *
 * Table: ai_instructions (migration 0020)
 * Columns: id, user_id, label, instruction_text, type, created_at, updated_at
 *
 * Instructions are user-scoped and typed ('analysis' | 'rewrite').
 * Used by:
 * - Assist tab: type='analysis' instructions for source analysis
 * - AI Rewrite sheet: type='rewrite' instructions for text rewriting
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";

export interface AIInstruction {
  id: string;
  userId: string;
  label: string;
  instructionText: string;
  type: "analysis" | "rewrite";
  createdAt: string;
  updatedAt: string;
}

interface AIInstructionRow {
  id: string;
  user_id: string;
  label: string;
  instruction_text: string;
  type: string;
  created_at: string;
  updated_at: string;
}

function rowToInstruction(row: AIInstructionRow): AIInstruction {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    instructionText: row.instruction_text,
    type: row.type as "analysis" | "rewrite",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateInstructionInput {
  label: string;
  instructionText: string;
  type: "analysis" | "rewrite";
}

export interface UpdateInstructionInput {
  label?: string;
  instructionText?: string;
}

const MAX_LABEL_LENGTH = 100;
const MAX_INSTRUCTION_LENGTH = 2000;
const VALID_TYPES = ["analysis", "rewrite"];

export class AIInstructionsService {
  constructor(private readonly db: D1Database) {}

  /**
   * List instructions for a user, optionally filtered by type.
   */
  async list(userId: string, type?: string): Promise<AIInstruction[]> {
    let query: string;
    let params: string[];

    if (type && VALID_TYPES.includes(type)) {
      query = `SELECT * FROM ai_instructions WHERE user_id = ? AND type = ? ORDER BY created_at ASC`;
      params = [userId, type];
    } else {
      query = `SELECT * FROM ai_instructions WHERE user_id = ? ORDER BY created_at ASC`;
      params = [userId];
    }

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<AIInstructionRow>();

    return (result.results ?? []).map(rowToInstruction);
  }

  /**
   * Create a new instruction.
   */
  async create(userId: string, input: CreateInstructionInput): Promise<AIInstruction> {
    if (!input.label?.trim()) {
      validationError("Label is required");
    }

    if (input.label.length > MAX_LABEL_LENGTH) {
      validationError(`Label must be at most ${MAX_LABEL_LENGTH} characters`);
    }

    if (!input.instructionText?.trim()) {
      validationError("Instruction text is required");
    }

    if (input.instructionText.length > MAX_INSTRUCTION_LENGTH) {
      validationError(`Instruction text must be at most ${MAX_INSTRUCTION_LENGTH} characters`);
    }

    if (!VALID_TYPES.includes(input.type)) {
      validationError("Type must be 'analysis' or 'rewrite'");
    }

    const id = ulid();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO ai_instructions (id, user_id, label, instruction_text, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, input.label.trim(), input.instructionText.trim(), input.type, now, now)
      .run();

    return {
      id,
      userId,
      label: input.label.trim(),
      instructionText: input.instructionText.trim(),
      type: input.type,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update an existing instruction. Verifies ownership.
   */
  async update(userId: string, id: string, input: UpdateInstructionInput): Promise<AIInstruction> {
    const existing = await this.db
      .prepare(`SELECT * FROM ai_instructions WHERE id = ? AND user_id = ?`)
      .bind(id, userId)
      .first<AIInstructionRow>();

    if (!existing) {
      notFound("Instruction not found");
    }

    if (input.label !== undefined) {
      if (!input.label.trim()) {
        validationError("Label cannot be empty");
      }
      if (input.label.length > MAX_LABEL_LENGTH) {
        validationError(`Label must be at most ${MAX_LABEL_LENGTH} characters`);
      }
    }

    if (input.instructionText !== undefined) {
      if (!input.instructionText.trim()) {
        validationError("Instruction text cannot be empty");
      }
      if (input.instructionText.length > MAX_INSTRUCTION_LENGTH) {
        validationError(`Instruction text must be at most ${MAX_INSTRUCTION_LENGTH} characters`);
      }
    }

    const now = new Date().toISOString();
    const label = input.label !== undefined ? input.label.trim() : existing.label;
    const instructionText =
      input.instructionText !== undefined
        ? input.instructionText.trim()
        : existing.instruction_text;

    await this.db
      .prepare(
        `UPDATE ai_instructions SET label = ?, instruction_text = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      )
      .bind(label, instructionText, now, id, userId)
      .run();

    return {
      id: existing.id,
      userId: existing.user_id,
      label,
      instructionText,
      type: existing.type as "analysis" | "rewrite",
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  /**
   * Delete an instruction. Verifies ownership.
   */
  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.db
      .prepare(`SELECT id FROM ai_instructions WHERE id = ? AND user_id = ?`)
      .bind(id, userId)
      .first<{ id: string }>();

    if (!existing) {
      notFound("Instruction not found");
    }

    await this.db
      .prepare(`DELETE FROM ai_instructions WHERE id = ? AND user_id = ?`)
      .bind(id, userId)
      .run();
  }
}
