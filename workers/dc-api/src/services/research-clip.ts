/**
 * Research clip service -- CRUD operations for saved text snippets.
 *
 * Clips are text snippets saved from AI results or source document selections.
 * They belong to a project and user, optionally tagged to a chapter.
 */

import { ulid } from "ulidx";
import { notFound } from "../middleware/error-handler.js";

/** Row shape from D1 query */
interface ClipRow {
  id: string;
  project_id: string;
  user_id: string;
  source_id: string | null;
  chapter_id: string | null;
  source_title: string;
  snippet_text: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  chapter_title?: string | null;
}

/** Public clip model */
export interface ResearchClip {
  id: string;
  projectId: string;
  sourceId: string | null;
  chapterId: string | null;
  sourceTitle: string;
  snippetText: string;
  chapterTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating a clip */
export interface CreateClipInput {
  sourceId?: string | null;
  sourceTitle: string;
  snippetText: string;
  chapterId?: string | null;
}

function rowToClip(row: ClipRow): ResearchClip {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceId: row.source_id,
    chapterId: row.chapter_id,
    sourceTitle: row.source_title,
    snippetText: row.snippet_text,
    chapterTitle: row.chapter_title ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Generate a content hash for deduplication (simple but effective) */
async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class ResearchClipService {
  constructor(private readonly db: D1Database) {}

  /**
   * Create a new clip. Returns 201 for new, 200 for existing (dedup).
   */
  async createClip(
    userId: string,
    projectId: string,
    input: CreateClipInput,
  ): Promise<{ clip: ResearchClip; isNew: boolean }> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const contentHash = await hashContent(input.snippetText);
    const now = new Date().toISOString();

    // Check for existing clip with same hash (dedup)
    const existing = await this.db
      .prepare(
        `SELECT rc.*, ch.title as chapter_title
         FROM research_clips rc
         LEFT JOIN chapters ch ON rc.chapter_id = ch.id
         WHERE rc.project_id = ? AND rc.user_id = ? AND rc.content_hash = ?`,
      )
      .bind(projectId, userId, contentHash)
      .first<ClipRow>();

    if (existing) {
      return { clip: rowToClip(existing), isNew: false };
    }

    const id = ulid();

    await this.db
      .prepare(
        `INSERT INTO research_clips (id, project_id, user_id, source_id, chapter_id, source_title, snippet_text, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        projectId,
        userId,
        input.sourceId ?? null,
        input.chapterId ?? null,
        input.sourceTitle,
        input.snippetText,
        contentHash,
        now,
        now,
      )
      .run();

    const clip: ResearchClip = {
      id,
      projectId,
      sourceId: input.sourceId ?? null,
      chapterId: input.chapterId ?? null,
      sourceTitle: input.sourceTitle,
      snippetText: input.snippetText,
      chapterTitle: null,
      createdAt: now,
      updatedAt: now,
    };

    return { clip, isNew: true };
  }

  /**
   * List clips for a project, most recent first.
   * Optionally filter by chapterId.
   */
  async listClips(
    userId: string,
    projectId: string,
    chapterId?: string,
  ): Promise<{ clips: ResearchClip[]; count: number }> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    let sql = `
      SELECT rc.*, ch.title as chapter_title
      FROM research_clips rc
      LEFT JOIN chapters ch ON rc.chapter_id = ch.id
      WHERE rc.project_id = ? AND rc.user_id = ?
    `;
    const params: string[] = [projectId, userId];

    if (chapterId) {
      sql += ` AND rc.chapter_id = ?`;
      params.push(chapterId);
    }

    sql += ` ORDER BY rc.created_at DESC`;

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all<ClipRow>();

    const clips = (result.results ?? []).map(rowToClip);

    return { clips, count: clips.length };
  }

  /**
   * Delete a clip. Verifies ownership.
   */
  async deleteClip(userId: string, clipId: string): Promise<void> {
    const clip = await this.db
      .prepare(
        `SELECT rc.id FROM research_clips rc
         JOIN projects p ON rc.project_id = p.id
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
