import { ulid } from "ulidx";
import { validationError } from "../middleware/error-handler.js";

/**
 * FeedbackService - Business logic for in-app feedback/issue reporting (#341)
 *
 * Users submit bug reports or feature suggestions with auto-captured context.
 * All queries are user-scoped (users can only see their own feedback).
 */

export interface Feedback {
  id: string;
  type: "bug" | "suggestion";
  status: string;
  description: string;
  createdAt: string;
}

export interface CreateFeedbackInput {
  type: string;
  description: string;
  context: Record<string, unknown>;
}

/** DB row type */
interface FeedbackRow {
  id: string;
  user_id: string;
  type: string;
  description: string;
  context_json: string;
  status: string;
  github_issue_number: number | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapFeedbackRow(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    type: row.type as "bug" | "suggestion",
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
  };
}

/** Maximum size for context_json in bytes */
const MAX_CONTEXT_SIZE = 4096;

export class FeedbackService {
  constructor(private readonly db: D1Database) {}

  /**
   * Create a new feedback entry.
   * Validates type and description, truncates context_json to 4KB.
   */
  async createFeedback(userId: string, input: CreateFeedbackInput): Promise<Feedback> {
    // Validate type
    if (!input.type || !["bug", "suggestion"].includes(input.type)) {
      validationError("type must be 'bug' or 'suggestion'");
    }

    // Validate description
    const description = input.description?.trim();
    if (!description) {
      validationError("description is required");
    }
    if (description.length < 10) {
      validationError("description must be at least 10 characters");
    }
    if (description.length > 2000) {
      validationError("description must be at most 2000 characters");
    }

    // Serialize and cap context_json at 4KB
    let contextJson = "{}";
    if (input.context && typeof input.context === "object") {
      const serialized = JSON.stringify(input.context);
      contextJson =
        serialized.length > MAX_CONTEXT_SIZE ? serialized.slice(0, MAX_CONTEXT_SIZE) : serialized;
    }

    const id = ulid();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO feedback (id, user_id, type, description, context_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'new', ?, ?)`,
      )
      .bind(id, userId, input.type, description, contextJson, now, now)
      .run();

    return {
      id,
      type: input.type as "bug" | "suggestion",
      status: "new",
      description,
      createdAt: now,
    };
  }

  /**
   * List feedback for a user with cursor pagination.
   */
  async listFeedback(
    userId: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<{ data: Feedback[]; cursor: string | null; hasMore: boolean }> {
    const limit = Math.min(options?.limit ?? 20, 50);

    let query: string;
    const bindings: (string | number)[] = [userId];

    if (options?.cursor) {
      query = `SELECT id, user_id, type, description, context_json, status, github_issue_number, admin_notes, created_at, updated_at
               FROM feedback
               WHERE user_id = ? AND created_at < ?
               ORDER BY created_at DESC
               LIMIT ?`;
      bindings.push(options.cursor, limit + 1);
    } else {
      query = `SELECT id, user_id, type, description, context_json, status, github_issue_number, admin_notes, created_at, updated_at
               FROM feedback
               WHERE user_id = ?
               ORDER BY created_at DESC
               LIMIT ?`;
      bindings.push(limit + 1);
    }

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all<FeedbackRow>();

    const rows = result.results ?? [];
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(mapFeedbackRow);
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].createdAt : null;

    return { data, cursor: nextCursor, hasMore };
  }
}
