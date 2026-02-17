import { notFound } from "../middleware/error-handler.js";

/**
 * AIInteractionService - Business logic for AI interaction logging
 *
 * Per PRD Section 8 (US-018):
 * - Logs acceptance/rejection of AI rewrite results
 * - Stores metadata only (no content): accepted, attempt_number
 * - Each acceptance/rejection: POST /ai/interactions/:id/accept or /reject
 */

export interface AIInteraction {
  id: string;
  userId: string;
  chapterId: string;
  action: string;
  instruction: string;
  inputChars: number;
  outputChars: number;
  model: string;
  latencyMs: number;
  accepted: boolean | null;
  attemptNumber: number;
  parentInteractionId: string | null;
  tier: "edge" | "frontier";
  createdAt: string;
}

interface AIInteractionRow {
  id: string;
  user_id: string;
  chapter_id: string;
  action: string;
  instruction: string;
  input_chars: number;
  output_chars: number;
  model: string;
  latency_ms: number;
  accepted: number | null;
  attempt_number: number;
  parent_interaction_id: string | null;
  tier: string;
  created_at: string;
}

export class AIInteractionService {
  constructor(private readonly db: D1Database) {}

  /**
   * Record acceptance of an AI rewrite result.
   * Sets accepted = 1 on the interaction row.
   */
  async acceptInteraction(userId: string, interactionId: string): Promise<AIInteraction> {
    // Verify ownership
    const interaction = await this.db
      .prepare(
        `SELECT id, user_id, chapter_id, action, instruction, input_chars, output_chars,
                model, latency_ms, accepted, attempt_number, parent_interaction_id, tier, created_at
         FROM ai_interactions
         WHERE id = ? AND user_id = ?`,
      )
      .bind(interactionId, userId)
      .first<AIInteractionRow>();

    if (!interaction) {
      notFound("AI interaction not found");
    }

    // Update accepted status
    await this.db
      .prepare(`UPDATE ai_interactions SET accepted = 1 WHERE id = ? AND user_id = ?`)
      .bind(interactionId, userId)
      .run();

    return this.mapRow({ ...interaction, accepted: 1 });
  }

  /**
   * Record rejection of an AI rewrite result.
   * Sets accepted = 0 on the interaction row.
   */
  async rejectInteraction(userId: string, interactionId: string): Promise<AIInteraction> {
    // Verify ownership
    const interaction = await this.db
      .prepare(
        `SELECT id, user_id, chapter_id, action, instruction, input_chars, output_chars,
                model, latency_ms, accepted, attempt_number, parent_interaction_id, tier, created_at
         FROM ai_interactions
         WHERE id = ? AND user_id = ?`,
      )
      .bind(interactionId, userId)
      .first<AIInteractionRow>();

    if (!interaction) {
      notFound("AI interaction not found");
    }

    // Update accepted status
    await this.db
      .prepare(`UPDATE ai_interactions SET accepted = 0 WHERE id = ? AND user_id = ?`)
      .bind(interactionId, userId)
      .run();

    return this.mapRow({ ...interaction, accepted: 0 });
  }

  private mapRow(row: AIInteractionRow): AIInteraction {
    return {
      id: row.id,
      userId: row.user_id,
      chapterId: row.chapter_id,
      action: row.action,
      instruction: row.instruction,
      inputChars: row.input_chars,
      outputChars: row.output_chars,
      model: row.model,
      latencyMs: row.latency_ms,
      accepted: row.accepted === null ? null : row.accepted === 1,
      attemptNumber: row.attempt_number,
      parentInteractionId: row.parent_interaction_id,
      tier: (row.tier as "edge" | "frontier") || "frontier",
      createdAt: row.created_at,
    };
  }
}
