import { ulid } from "ulidx";
import { notFound, validationError, AppError } from "../middleware/error-handler.js";

/**
 * ChapterService - Business logic for chapter CRUD operations
 *
 * Extracted from ProjectService (#103) to enforce single-responsibility.
 *
 * Per PRD Section 11:
 * - Chapters: id (ULID), project_id, title, sort_order, r2_key, word_count, version, status, timestamps
 *
 * Per PRD Section 12:
 * - Authorization: All D1 queries verify project ownership via WHERE user_id = ?
 * - Error codes: NOT_FOUND, LAST_CHAPTER, VALIDATION_ERROR
 */

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  r2Key: string | null;
  wordCount: number;
  version: number;
  status: "draft" | "review" | "final";
  createdAt: string;
  updatedAt: string;
}

export interface CreateChapterInput {
  title?: string;
}

export interface UpdateChapterInput {
  title?: string;
  status?: "draft" | "review" | "final";
}

export interface ReorderChaptersInput {
  /** Array of chapter IDs in the new order */
  chapterIds: string[];
}

/** DB row type */
export interface ChapterRow {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
  r2_key: string | null;
  word_count: number;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Map a D1 chapter row to the API-facing Chapter type.
 *
 * Exported as a standalone function so both ChapterService and
 * ProjectService.getProject can use it without cross-service coupling.
 */
export function mapChapterRow(row: ChapterRow): Chapter {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    sortOrder: row.sort_order,
    r2Key: row.r2_key,
    wordCount: row.word_count,
    version: row.version,
    status: row.status as "draft" | "review" | "final",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * ChapterService handles all chapter CRUD operations
 */
export class ChapterService {
  constructor(private readonly db: D1Database) {}

  /**
   * Create a new chapter at the end of the list
   * Per PRD US-010: "+" button creates chapter at end of list
   */
  async createChapter(
    userId: string,
    projectId: string,
    input?: CreateChapterInput,
  ): Promise<Chapter> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first();

    if (!project) {
      notFound("Project not found");
    }

    // Validate title if provided
    const title = input?.title?.trim() || "Untitled Chapter";
    if (title.length > 200) {
      validationError("Chapter title must be at most 200 characters");
    }

    // Get the highest sort_order
    const maxSort = await this.db
      .prepare(`SELECT MAX(sort_order) as max_sort FROM chapters WHERE project_id = ?`)
      .bind(projectId)
      .first<{ max_sort: number | null }>();

    const sortOrder = (maxSort?.max_sort || 0) + 1;
    const chapterId = ulid();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO chapters (id, project_id, title, sort_order, word_count, version, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 1, 'draft', ?, ?)`,
      )
      .bind(chapterId, projectId, title, sortOrder, now, now)
      .run();

    // Update project updated_at
    await this.db
      .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
      .bind(now, projectId)
      .run();

    return {
      id: chapterId,
      projectId,
      title,
      sortOrder,
      r2Key: null,
      wordCount: 0,
      version: 1,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * List chapters for a project (metadata only)
   * Per PRD Section 12: Lists chapters (metadata only)
   */
  async listChapters(userId: string, projectId: string): Promise<Chapter[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .first();

    if (!project) {
      notFound("Project not found");
    }

    const result = await this.db
      .prepare(
        `SELECT id, project_id, title, sort_order, r2_key, word_count, version, status, created_at, updated_at
         FROM chapters
         WHERE project_id = ?
         ORDER BY sort_order ASC`,
      )
      .bind(projectId)
      .all<ChapterRow>();

    return (result.results ?? []).map(mapChapterRow);
  }

  /**
   * Update chapter title and/or status
   * Per PRD US-013: Rename a chapter
   */
  async updateChapter(
    userId: string,
    chapterId: string,
    input: UpdateChapterInput,
  ): Promise<Chapter> {
    // Verify ownership via project
    const chapter = await this.db
      .prepare(
        `SELECT ch.id, ch.project_id
         FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<{ id: string; project_id: string }>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    // Validate title
    if (input.title !== undefined) {
      const title = input.title.trim() || "Untitled Chapter";
      if (title.length > 200) {
        validationError("Chapter title must be at most 200 characters");
      }
    }

    const now = new Date().toISOString();
    const updates: string[] = ["updated_at = ?"];
    const bindings: (string | number)[] = [now];

    if (input.title !== undefined) {
      const title = input.title.trim() || "Untitled Chapter";
      updates.push("title = ?");
      bindings.push(title);
    }

    if (input.status !== undefined) {
      if (!["draft", "review", "final"].includes(input.status)) {
        validationError("Invalid chapter status");
      }
      updates.push("status = ?");
      bindings.push(input.status);
    }

    bindings.push(chapterId);

    await this.db
      .prepare(`UPDATE chapters SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    // Update project updated_at
    await this.db
      .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
      .bind(now, chapter.project_id)
      .run();

    // Fetch updated chapter
    const updated = await this.db
      .prepare(
        `SELECT id, project_id, title, sort_order, r2_key, word_count, version, status, created_at, updated_at
         FROM chapters
         WHERE id = ?`,
      )
      .bind(chapterId)
      .first<ChapterRow>();

    if (!updated) {
      notFound("Chapter not found");
    }

    return mapChapterRow(updated);
  }

  /**
   * Delete a chapter (with minimum 1 per project enforcement)
   * Per PRD US-014: Minimum one chapter per project
   */
  async deleteChapter(userId: string, chapterId: string): Promise<void> {
    // Verify ownership and get project_id
    const chapter = await this.db
      .prepare(
        `SELECT ch.id, ch.project_id
         FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<{ id: string; project_id: string }>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    // Check if this is the last chapter
    const chapterCount = await this.db
      .prepare(`SELECT COUNT(*) as count FROM chapters WHERE project_id = ?`)
      .bind(chapter.project_id)
      .first<{ count: number }>();

    if (!chapterCount || chapterCount.count <= 1) {
      throw new AppError(400, "LAST_CHAPTER", "Cannot delete the last chapter of a project");
    }

    // Delete the chapter
    await this.db.prepare(`DELETE FROM chapters WHERE id = ?`).bind(chapterId).run();

    // Update project updated_at
    await this.db
      .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), chapter.project_id)
      .run();
  }

  /**
   * Reorder chapters by updating sort_order
   * Per PRD US-012A: Batch update of sort_order
   */
  async reorderChapters(
    userId: string,
    projectId: string,
    input: ReorderChaptersInput,
  ): Promise<Chapter[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first();

    if (!project) {
      notFound("Project not found");
    }

    if (!input.chapterIds || input.chapterIds.length === 0) {
      validationError("chapterIds array is required");
    }

    // Verify all chapters belong to this project
    const existingChapters = await this.db
      .prepare(`SELECT id FROM chapters WHERE project_id = ?`)
      .bind(projectId)
      .all<{ id: string }>();

    const existingIds = new Set((existingChapters.results ?? []).map((c) => c.id));
    for (const id of input.chapterIds) {
      if (!existingIds.has(id)) {
        validationError(`Chapter ${id} does not belong to this project`);
      }
    }

    // Verify all existing chapters are included
    if (input.chapterIds.length !== existingIds.size) {
      validationError("All chapters must be included in the reorder");
    }

    const now = new Date().toISOString();

    // Two-pass reorder to avoid UNIQUE constraint violations on
    // (project_id, sort_order) when sort orders swap between chapters.
    // Pass 1: clear to negative temporaries. Pass 2: set final values.
    const clearStatements = input.chapterIds.map((id, index) =>
      this.db.prepare(`UPDATE chapters SET sort_order = ? WHERE id = ?`).bind(-(index + 1), id),
    );
    const setStatements = input.chapterIds.map((id, index) =>
      this.db
        .prepare(`UPDATE chapters SET sort_order = ?, updated_at = ? WHERE id = ?`)
        .bind(index + 1, now, id),
    );

    // Execute all updates in a single batch (D1 runs these in a transaction)
    await this.db.batch([...clearStatements, ...setStatements]);

    // Update project updated_at
    await this.db
      .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
      .bind(now, projectId)
      .run();

    // Return updated chapters
    return this.listChapters(userId, projectId);
  }

  /**
   * Get a single chapter by ID
   */
  async getChapter(userId: string, chapterId: string): Promise<Chapter> {
    const chapter = await this.db
      .prepare(
        `SELECT ch.id, ch.project_id, ch.title, ch.sort_order, ch.r2_key,
                ch.word_count, ch.version, ch.status, ch.created_at, ch.updated_at
         FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<ChapterRow>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    return mapChapterRow(chapter);
  }
}
