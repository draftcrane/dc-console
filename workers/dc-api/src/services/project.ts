import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import { type Chapter, type ChapterRow, mapChapterRow } from "./chapter.js";

/**
 * ProjectService - Business logic for projects
 *
 * Per PRD Section 11:
 * - Projects: id (ULID), user_id, title, description, drive_folder_id, status, timestamps
 *
 * Per PRD Section 12:
 * - Authorization: All D1 queries include WHERE user_id = ?
 * - Error codes: NOT_FOUND, VALIDATION_ERROR
 *
 * Chapter CRUD lives in ChapterService (#103). The createProject method
 * keeps its inline chapter INSERT because project + default chapter
 * creation is a single transactional operation.
 */

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string;
  driveFolderId: string | null;
  driveConnectionId: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithChapters extends Project {
  chapters: Chapter[];
  totalWordCount: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  wordCount: number;
  chapterCount: number;
  updatedAt: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
}

/** DB row types */
interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  drive_folder_id: string | null;
  drive_connection_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectSummaryRow {
  id: string;
  title: string;
  status: string;
  total_words: number;
  chapter_count: number;
  updated_at: string;
}

/**
 * ProjectService handles project CRUD operations
 */
export class ProjectService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket?: R2Bucket,
  ) {}

  /**
   * Create a new project with a default "Chapter 1"
   * Per PRD US-009: Creates default "Chapter 1"
   *
   * The chapter INSERT is kept inline (not delegated to ChapterService)
   * because project + default chapter creation is a single transactional
   * operation. Duplication is preferable to cross-service coupling.
   */
  async createProject(userId: string, input: CreateProjectInput): Promise<ProjectWithChapters> {
    // Validate input
    if (!input.title?.trim()) {
      validationError("Title is required");
    }

    if (input.title.length > 500) {
      validationError("Title must be at most 500 characters");
    }

    if (input.description && input.description.length > 1000) {
      validationError("Description must be at most 1000 characters");
    }

    const projectId = ulid();
    const chapterId = ulid();
    const now = new Date().toISOString();

    // Create project
    await this.db
      .prepare(
        `INSERT INTO projects (id, user_id, title, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(projectId, userId, input.title.trim(), input.description?.trim() || "", now, now)
      .run();

    // Create default Chapter 1
    await this.db
      .prepare(
        `INSERT INTO chapters (id, project_id, title, sort_order, word_count, version, status, created_at, updated_at)
         VALUES (?, ?, ?, 1, 0, 1, 'draft', ?, ?)`,
      )
      .bind(chapterId, projectId, "Chapter 1", now, now)
      .run();

    return {
      id: projectId,
      userId,
      title: input.title.trim(),
      description: input.description?.trim() || "",
      driveFolderId: null,
      driveConnectionId: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      chapters: [
        {
          id: chapterId,
          projectId,
          title: "Chapter 1",
          sortOrder: 1,
          driveFileId: null,
          r2Key: null,
          wordCount: 0,
          version: 1,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
      ],
      totalWordCount: 0,
    };
  }

  /**
   * List user's active projects with word counts
   * Per PRD Section 12: Lists active projects with word counts
   */
  async listProjects(userId: string): Promise<ProjectSummary[]> {
    const result = await this.db
      .prepare(
        `SELECT
           p.id,
           p.title,
           p.status,
           COALESCE(SUM(ch.word_count), 0) as total_words,
           COUNT(ch.id) as chapter_count,
           p.updated_at
         FROM projects p
         LEFT JOIN chapters ch ON ch.project_id = p.id
         WHERE p.user_id = ? AND p.status = 'active'
         GROUP BY p.id
         ORDER BY p.updated_at DESC`,
      )
      .bind(userId)
      .all<ProjectSummaryRow>();

    return (result.results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      wordCount: row.total_words || 0,
      chapterCount: row.chapter_count || 0,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get project details with chapter list
   * Per PRD Section 12: Project details with chapter list
   */
  async getProject(userId: string, projectId: string): Promise<ProjectWithChapters> {
    // Fetch project with user_id check for authorization
    const project = await this.db
      .prepare(
        `SELECT id, user_id, title, description, drive_folder_id, drive_connection_id, status, created_at, updated_at
         FROM projects
         WHERE id = ? AND user_id = ?`,
      )
      .bind(projectId, userId)
      .first<ProjectRow>();

    if (!project) {
      notFound("Project not found");
    }

    // Fetch chapters
    const chaptersResult = await this.db
      .prepare(
        `SELECT id, project_id, title, sort_order, drive_file_id, r2_key, word_count, version, status, created_at, updated_at
         FROM chapters
         WHERE project_id = ?
         ORDER BY sort_order ASC`,
      )
      .bind(projectId)
      .all<ChapterRow>();

    const chapters = (chaptersResult.results ?? []).map(mapChapterRow);
    const totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      id: project.id,
      userId: project.user_id,
      title: project.title,
      description: project.description,
      driveFolderId: project.drive_folder_id,
      driveConnectionId: project.drive_connection_id,
      status: project.status as "active" | "archived",
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      chapters,
      totalWordCount,
    };
  }

  /**
   * Update project title and/or description
   * Per PRD Section 12: Updates title, description, settings
   */
  async updateProject(
    userId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    // Verify ownership
    const existing = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .first();

    if (!existing) {
      notFound("Project not found");
    }

    // Validate input
    if (input.title !== undefined) {
      if (!input.title.trim()) {
        validationError("Title cannot be empty");
      }
      if (input.title.length > 500) {
        validationError("Title must be at most 500 characters");
      }
    }

    if (input.description !== undefined && input.description.length > 1000) {
      validationError("Description must be at most 1000 characters");
    }

    const now = new Date().toISOString();
    const updates: string[] = ["updated_at = ?"];
    const bindings: (string | null)[] = [now];

    if (input.title !== undefined) {
      updates.push("title = ?");
      bindings.push(input.title.trim());
    }

    if (input.description !== undefined) {
      updates.push("description = ?");
      bindings.push(input.description.trim());
    }

    bindings.push(projectId, userId);

    await this.db
      .prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`)
      .bind(...bindings)
      .run();

    // Fetch updated project
    const project = await this.db
      .prepare(
        `SELECT id, user_id, title, description, drive_folder_id, status, created_at, updated_at
         FROM projects
         WHERE id = ? AND user_id = ?`,
      )
      .bind(projectId, userId)
      .first<ProjectRow>();

    if (!project) {
      notFound("Project not found");
    }

    return this.mapProjectRow(project);
  }

  /**
   * Soft delete project (status='archived')
   * Per PRD US-023: Soft delete (status='archived' in D1)
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    const result = await this.db
      .prepare(
        `UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'`,
      )
      .bind(new Date().toISOString(), projectId, userId)
      .run();

    if (!result.meta.changes || result.meta.changes === 0) {
      notFound("Project not found");
    }
  }

  /**
   * Duplicate a project with all chapters and R2 content.
   *
   * Atomicity strategy: R2 copies first (no D1 state to clean up on failure),
   * then D1 batch insert (project + all chapters in one transaction).
   * Orphaned R2 objects from a failed D1 batch are harmless unreferenced blobs.
   *
   * Drive handling: Copy starts with no Drive files. The existing lazy-migration
   * in PUT /chapters/:chapterId/content creates Drive files on first edit.
   */
  async duplicateProject(userId: string, projectId: string): Promise<ProjectWithChapters> {
    if (!this.bucket) {
      throw new Error("R2 bucket required for project duplication");
    }

    // 1. Fetch source project (verify ownership + active)
    const source = await this.db
      .prepare(
        `SELECT id, title, description FROM projects
         WHERE id = ? AND user_id = ? AND status = 'active'`,
      )
      .bind(projectId, userId)
      .first<{ id: string; title: string; description: string }>();

    if (!source) {
      notFound("Project not found");
    }

    // 2. Fetch all source chapters
    const chaptersResult = await this.db
      .prepare(
        `SELECT id, title, sort_order, r2_key, word_count, status
         FROM chapters WHERE project_id = ? ORDER BY sort_order ASC`,
      )
      .bind(projectId)
      .all<{
        id: string;
        title: string;
        sort_order: number;
        r2_key: string | null;
        word_count: number;
        status: string;
      }>();

    const sourceChapters = chaptersResult.results ?? [];

    // 3. Guard: reject if > 200 chapters (R2 subrequest limits)
    if (sourceChapters.length > 200) {
      validationError("Cannot duplicate projects with more than 200 chapters");
    }

    const now = new Date().toISOString();
    const newProjectId = ulid();

    // Generate all new chapter IDs upfront
    const chapterMapping = sourceChapters.map((ch) => ({
      source: ch,
      newId: ulid(),
      newR2Key: ch.r2_key ? `chapters/${ulid()}/content.html` : null,
    }));

    // Re-generate R2 keys using the actual new chapter IDs
    for (const mapping of chapterMapping) {
      if (mapping.source.r2_key) {
        mapping.newR2Key = `chapters/${mapping.newId}/content.html`;
      }
    }

    // 4. Phase 1 — R2 copies (no D1 writes yet)
    for (const mapping of chapterMapping) {
      if (mapping.source.r2_key && mapping.newR2Key) {
        const object = await this.bucket.get(mapping.source.r2_key);
        if (object) {
          const content = await object.text();
          await this.bucket.put(mapping.newR2Key, content, {
            httpMetadata: {
              contentType: "text/html; charset=utf-8",
            },
            customMetadata: {
              chapterId: mapping.newId,
              version: "1",
              updatedAt: now,
            },
          });
        }
      }
    }

    // 5. Phase 2 — D1 batch (project + all chapters atomically)
    const projectInsert = this.db
      .prepare(
        `INSERT INTO projects (id, user_id, title, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(newProjectId, userId, `${source.title} (Copy)`, source.description, now, now);

    const chapterInserts = chapterMapping.map((mapping) =>
      this.db
        .prepare(
          `INSERT INTO chapters (id, project_id, title, sort_order, r2_key, word_count, version, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        )
        .bind(
          mapping.newId,
          newProjectId,
          mapping.source.title,
          mapping.source.sort_order,
          mapping.newR2Key,
          mapping.source.word_count,
          mapping.source.status,
          now,
          now,
        ),
    );

    await this.db.batch([projectInsert, ...chapterInserts]);

    // 6. Return the new project
    const chapters = chapterMapping.map((mapping) => ({
      id: mapping.newId,
      projectId: newProjectId,
      title: mapping.source.title,
      sortOrder: mapping.source.sort_order,
      driveFileId: null,
      r2Key: mapping.newR2Key,
      wordCount: mapping.source.word_count,
      version: 1,
      status: mapping.source.status as "draft" | "review" | "final",
      createdAt: now,
      updatedAt: now,
    }));

    return {
      id: newProjectId,
      userId,
      title: `${source.title} (Copy)`,
      description: source.description,
      driveFolderId: null,
      driveConnectionId: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      chapters,
      totalWordCount: chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
    };
  }

  private mapProjectRow(row: ProjectRow): Project {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      driveFolderId: row.drive_folder_id,
      driveConnectionId: row.drive_connection_id,
      status: row.status as "active" | "archived",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
