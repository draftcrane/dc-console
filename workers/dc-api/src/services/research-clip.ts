/**
 * Research clip service -- CRUD operations for saved research snippets.
 *
 * Research clips are user-saved snippets from source materials, linked to
 * a project and optionally to a chapter. Deduplication prevents duplicate
 * clips with the same content + source within a project.
 */

import { notFound, validationError } from "../middleware/error-handler.js";

/** Maximum clip content size: 10KB */
const MAX_CONTENT_BYTES = 10 * 1024;

/** Row shape from D1 for a research clip. */
export interface ResearchClipRow {
  id: string;
  project_id: string;
  source_id: string | null;
  source_title: string;
  content: string;
  source_location: string | null;
  chapter_id: string | null;
  created_at: string;
}

/** Row shape when joined with chapters for chapterTitle. */
export interface ResearchClipWithChapterRow extends ResearchClipRow {
  chapter_title: string | null;
}

/** Public API model returned from the service. */
export interface ResearchClip {
  id: string;
  projectId: string;
  sourceId: string | null;
  sourceTitle: string;
  content: string;
  sourceLocation: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  createdAt: string;
}

/** Input for creating a clip. */
export interface CreateClipInput {
  content: string;
  sourceTitle: string;
  sourceId?: string | null;
  sourceLocation?: string | null;
  chapterId?: string | null;
}

function rowToClip(row: ResearchClipWithChapterRow): ResearchClip {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    content: row.content,
    sourceLocation: row.source_location,
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title ?? null,
    createdAt: row.created_at,
  };
}

export class ResearchClipService {
  constructor(private readonly db: D1Database) {}

  /**
   * Create a research clip.
   *
   * Deduplication: if a clip with the same content + sourceId already exists
   * in the project, returns the existing clip with `existed: true`.
   *
   * @returns `{ clip, existed }` — existed=true means dedup match found.
   */
  async createClip(
    userId: string,
    projectId: string,
    input: CreateClipInput,
  ): Promise<{ clip: ResearchClip; existed: boolean }> {
    // Validate content
    if (!input.content || input.content.trim().length === 0) {
      validationError("content is required");
    }

    if (!input.sourceTitle || input.sourceTitle.trim().length === 0) {
      validationError("sourceTitle is required");
    }

    // Enforce 10KB limit
    const contentBytes = new TextEncoder().encode(input.content).byteLength;
    if (contentBytes > MAX_CONTENT_BYTES) {
      validationError(`Content exceeds maximum size of ${MAX_CONTENT_BYTES} bytes`);
    }

    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Dedup check: same content + sourceId in this project (only when sourceId is provided)
    if (input.sourceId) {
      const existing = await this.db
        .prepare(
          `SELECT rc.*, c.title AS chapter_title
           FROM research_clips rc
           LEFT JOIN chapters c ON c.id = rc.chapter_id
           WHERE rc.project_id = ? AND rc.source_id = ? AND rc.content = ?`,
        )
        .bind(projectId, input.sourceId, input.content)
        .first<ResearchClipWithChapterRow>();

      if (existing) {
        return { clip: rowToClip(existing), existed: true };
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO research_clips (id, project_id, source_id, source_title, content, source_location, chapter_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        projectId,
        input.sourceId ?? null,
        input.sourceTitle,
        input.content,
        input.sourceLocation ?? null,
        input.chapterId ?? null,
        now,
      )
      .run();

    // Fetch the created clip with chapter title join
    const created = await this.db
      .prepare(
        `SELECT rc.*, c.title AS chapter_title
         FROM research_clips rc
         LEFT JOIN chapters c ON c.id = rc.chapter_id
         WHERE rc.id = ?`,
      )
      .bind(id)
      .first<ResearchClipWithChapterRow>();

    if (!created) {
      throw new Error("Failed to read back created clip");
    }

    return { clip: rowToClip(created), existed: false };
  }

  /**
   * List research clips for a project, ordered by created_at DESC.
   *
   * Optionally filters by chapterId. Includes chapterTitle from joined chapters.
   */
  async listClips(userId: string, projectId: string, chapterId?: string): Promise<ResearchClip[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    let query: string;
    let params: (string | null)[];

    if (chapterId) {
      query = `SELECT rc.*, c.title AS chapter_title
               FROM research_clips rc
               LEFT JOIN chapters c ON c.id = rc.chapter_id
               WHERE rc.project_id = ? AND rc.chapter_id = ?
               ORDER BY rc.created_at DESC`;
      params = [projectId, chapterId];
    } else {
      query = `SELECT rc.*, c.title AS chapter_title
               FROM research_clips rc
               LEFT JOIN chapters c ON c.id = rc.chapter_id
               WHERE rc.project_id = ?
               ORDER BY rc.created_at DESC`;
      params = [projectId];
    }

    const stmt = this.db.prepare(query);
    const bound = params.length === 2 ? stmt.bind(params[0], params[1]) : stmt.bind(params[0]);
    const result = await bound.all<ResearchClipWithChapterRow>();

    return (result.results ?? []).map(rowToClip);
  }

  /**
   * Delete a research clip.
   *
   * Authorization: verifies the clip belongs to a project owned by the user.
   */
  async deleteClip(userId: string, clipId: string): Promise<void> {
    // Verify ownership via project join
    const clip = await this.db
      .prepare(
        `SELECT rc.id FROM research_clips rc
         JOIN projects p ON p.id = rc.project_id
         WHERE rc.id = ? AND p.user_id = ?`,
      )
      .bind(clipId, userId)
      .first<{ id: string }>();

    if (!clip) {
      notFound("Clip not found");
    }

    await this.db.prepare(`DELETE FROM research_clips WHERE id = ?`).bind(clipId).run();
  }
}
