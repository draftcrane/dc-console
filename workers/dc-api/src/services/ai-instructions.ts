/**
 * AI Instructions Service — CRUD for saved AI instructions.
 *
 * Table: ai_instructions (migration 0020, updated 0027)
 * Columns: id, user_id, label, instruction_text, type, last_used_at, created_at, updated_at
 *
 * Instructions are user-scoped and typed ('desk' | 'book' | 'chapter').
 * Used by:
 * - Desk tab: type='desk' instructions for source analysis
 * - Chapter editor panel: type='chapter' instructions for text rewriting
 * - Book editor (future): type='book' instructions for cross-chapter analysis
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";

export interface AIInstruction {
  id: string;
  userId: string;
  label: string;
  instructionText: string;
  type: "desk" | "book" | "chapter";
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AIInstructionRow {
  id: string;
  user_id: string;
  label: string;
  instruction_text: string;
  type: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToInstruction(row: AIInstructionRow): AIInstruction {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    instructionText: row.instruction_text,
    type: row.type as "desk" | "book" | "chapter",
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateInstructionInput {
  label: string;
  instructionText: string;
  type: "desk" | "book" | "chapter";
}

export interface UpdateInstructionInput {
  label?: string;
  instructionText?: string;
}

const MAX_LABEL_LENGTH = 100;
const MAX_INSTRUCTION_LENGTH = 2000;
const VALID_TYPES = ["desk", "book", "chapter"];

/**
 * Default instructions seeded for new users.
 * 5 chapter + 4 desk + 4 book = 13 total.
 */
const DEFAULT_INSTRUCTIONS: Array<{ label: string; instructionText: string; type: "desk" | "book" | "chapter" }> = [
  // Chapter (5)
  {
    label: "Simpler language",
    instructionText:
      "Rewrite using simpler, more accessible vocabulary. Prefer common words over jargon. Aim for an 8th-grade reading level while preserving the core meaning and technical accuracy.",
    type: "chapter",
  },
  {
    label: "More concise",
    instructionText:
      "Make this more concise. Remove filler words, redundant phrases, and unnecessary qualifiers. Keep the essential meaning in fewer words.",
    type: "chapter",
  },
  {
    label: "More conversational",
    instructionText:
      "Rewrite in a more conversational, friendly tone. Use contractions, shorter sentences, and direct address where appropriate. It should sound like one person talking to another.",
    type: "chapter",
  },
  {
    label: "More direct",
    instructionText:
      "Make this more direct and assertive. Lead with the main point. Remove hedging language like 'perhaps', 'maybe', 'it seems', 'in my opinion'. State claims confidently.",
    type: "chapter",
  },
  {
    label: "Expand",
    instructionText:
      "Expand this passage with more detail. Add examples, explanations, or supporting points. Develop the ideas more fully while maintaining the original voice and structure.",
    type: "chapter",
  },
  // Desk (4)
  {
    label: "Summarize",
    instructionText:
      "Provide a concise summary of this document. Capture the main argument, key findings, and conclusions in 2-3 paragraphs. Focus on what's most relevant for a nonfiction book author.",
    type: "desk",
  },
  {
    label: "Find key points",
    instructionText:
      "Extract the key points, main arguments, and notable claims from this document as a bulleted list. Include page numbers or section references where possible.",
    type: "desk",
  },
  {
    label: "Extract quotes",
    instructionText:
      "Find quotable passages in this document — memorable phrases, strong claims, vivid examples, or statistics that could be cited in a book. List each quote with its context.",
    type: "desk",
  },
  {
    label: "Suggest connections",
    instructionText:
      "Analyze how this source connects to the other selected documents. Identify shared themes, complementary perspectives, or contrasting viewpoints. Suggest how these sources could be synthesized.",
    type: "desk",
  },
  // Book (4)
  {
    label: "Find redundancies",
    instructionText:
      "Analyze these chapters for redundant content. Identify passages that repeat the same ideas, examples, or explanations. List specific locations and suggest which to keep or consolidate.",
    type: "book",
  },
  {
    label: "Find contradictions",
    instructionText:
      "Scan these chapters for contradictions or inconsistencies. Flag any places where claims, data, or recommendations conflict with each other. Quote the specific passages that contradict.",
    type: "book",
  },
  {
    label: "Find recurring topics",
    instructionText:
      "Identify recurring themes, topics, or concepts across these chapters. List each recurring element with the chapters where it appears. Note if any topic deserves its own dedicated chapter.",
    type: "book",
  },
  {
    label: "Suggest connections",
    instructionText:
      "Analyze the relationships between these chapters. Suggest transitions, cross-references, or connections that could strengthen the narrative flow. Identify ideas in one chapter that could be referenced or built upon in another.",
    type: "book",
  },
];

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
      validationError("Type must be 'desk', 'book', or 'chapter'");
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
      lastUsedAt: null,
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
      type: existing.type as "desk" | "book" | "chapter",
      lastUsedAt: existing.last_used_at,
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

  /**
   * Touch last_used_at timestamp for an instruction. Verifies ownership.
   */
  async touchLastUsed(userId: string, id: string): Promise<void> {
    const now = new Date().toISOString();

    const result = await this.db
      .prepare(
        `UPDATE ai_instructions SET last_used_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      )
      .bind(now, now, id, userId)
      .run();

    if (!result.meta.changes || result.meta.changes === 0) {
      notFound("Instruction not found");
    }
  }

  /**
   * Seed default instructions for a new user.
   * Idempotent: skips if user already has any instructions.
   */
  async seedDefaultInstructions(userId: string): Promise<void> {
    const existing = await this.db
      .prepare(`SELECT COUNT(*) as count FROM ai_instructions WHERE user_id = ?`)
      .bind(userId)
      .first<{ count: number }>();

    if (existing && existing.count > 0) return;

    const now = new Date().toISOString();
    const statements = DEFAULT_INSTRUCTIONS.map((inst) =>
      this.db
        .prepare(
          `INSERT INTO ai_instructions (id, user_id, label, instruction_text, type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(ulid(), userId, inst.label, inst.instructionText, inst.type, now, now),
    );

    await this.db.batch(statements);
  }
}
