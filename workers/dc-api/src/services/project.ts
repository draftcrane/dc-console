import { ulid } from "ulid";
import { notFound, validationError, AppError } from "../middleware/error-handler.js";

/**
 * ProjectService - Business logic for projects and chapters
 *
 * Per PRD Section 11:
 * - Projects: id (ULID), user_id, title, description, drive_folder_id, status, timestamps
 * - Chapters: id (ULID), project_id, title, sort_order, drive_file_id, r2_key, word_count, version, status, timestamps
 *
 * Per PRD Section 12:
 * - Authorization: All D1 queries include WHERE user_id = ?
 * - Error codes: NOT_FOUND, FORBIDDEN, LAST_CHAPTER, VALIDATION_ERROR
 */

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string;
  driveFolderId: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  sortOrder: number;
  driveFileId: string | null;
  r2Key: string | null;
  wordCount: number;
  version: number;
  status: "draft" | "review" | "final";
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

/** DB row types */
interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  drive_folder_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ChapterRow {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
  drive_file_id: string | null;
  r2_key: string | null;
  word_count: number;
  version: number;
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
 * ProjectService handles all project and chapter CRUD operations
 */
export class ProjectService {
  constructor(private readonly db: D1Database) {}

  /**
   * Create a new project with a default "Chapter 1"
   * Per PRD US-009: Creates default "Chapter 1"
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
        `SELECT id, user_id, title, description, drive_folder_id, status, created_at, updated_at
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

    const chapters = (chaptersResult.results ?? []).map(this.mapChapterRow);
    const totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

    return {
      id: project.id,
      userId: project.user_id,
      title: project.title,
      description: project.description,
      driveFolderId: project.drive_folder_id,
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
      driveFileId: null,
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
        `SELECT id, project_id, title, sort_order, drive_file_id, r2_key, word_count, version, status, created_at, updated_at
         FROM chapters
         WHERE project_id = ?
         ORDER BY sort_order ASC`,
      )
      .bind(projectId)
      .all<ChapterRow>();

    return (result.results ?? []).map(this.mapChapterRow);
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
        `SELECT id, project_id, title, sort_order, drive_file_id, r2_key, word_count, version, status, created_at, updated_at
         FROM chapters
         WHERE id = ?`,
      )
      .bind(chapterId)
      .first<ChapterRow>();

    if (!updated) {
      notFound("Chapter not found");
    }

    return this.mapChapterRow(updated);
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

    // Update sort_order for each chapter
    const statements = input.chapterIds.map((id, index) =>
      this.db
        .prepare(`UPDATE chapters SET sort_order = ?, updated_at = ? WHERE id = ?`)
        .bind(index + 1, now, id),
    );

    // Execute all updates
    await this.db.batch(statements);

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
        `SELECT ch.id, ch.project_id, ch.title, ch.sort_order, ch.drive_file_id, ch.r2_key,
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

    return this.mapChapterRow(chapter);
  }

  private mapProjectRow(row: ProjectRow): Project {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      driveFolderId: row.drive_folder_id,
      status: row.status as "active" | "archived",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapChapterRow(row: ChapterRow): Chapter {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      sortOrder: row.sort_order,
      driveFileId: row.drive_file_id,
      r2Key: row.r2_key,
      wordCount: row.word_count,
      version: row.version,
      status: row.status as "draft" | "review" | "final",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
