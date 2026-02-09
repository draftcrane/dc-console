import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../middleware/index.js";

const users = new Hono<{ Bindings: Env }>();

// All user routes require authentication
users.use("*", requireAuth);

/**
 * GET /users/me
 * Returns current user profile with Drive status, active projects, and total word count.
 * Per PRD Section 12: Current user profile, Drive status, active projects, total word count
 */
users.get("/me", async (c) => {
  const { userId } = c.get("auth");

  // Fetch user
  const user = await c.env.DB.prepare(
    `SELECT id, email, display_name, created_at, updated_at FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<UserRow>();

  if (!user) {
    notFound("User not found");
  }

  // Check Drive connection
  const driveConnection = await c.env.DB.prepare(
    `SELECT id, drive_email, token_expires_at FROM drive_connections WHERE user_id = ?`,
  )
    .bind(userId)
    .first<DriveConnectionRow>();

  // Get active projects with word counts
  const projectsResult = await c.env.DB.prepare(
    `SELECT
       p.id,
       p.title,
       p.status,
       COALESCE(SUM(ch.word_count), 0) as total_words,
       COUNT(ch.id) as chapter_count
     FROM projects p
     LEFT JOIN chapters ch ON ch.project_id = p.id
     WHERE p.user_id = ? AND p.status = 'active'
     GROUP BY p.id
     ORDER BY p.updated_at DESC`,
  )
    .bind(userId)
    .all<ProjectSummaryRow>();

  const projects = projectsResult.results ?? [];

  // Calculate total word count across all projects
  const totalWordCount = projects.reduce((sum, p) => sum + (p.total_words || 0), 0);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    drive: driveConnection
      ? {
          connected: true,
          email: driveConnection.drive_email,
          expiresAt: driveConnection.token_expires_at,
        }
      : {
          connected: false,
        },
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      wordCount: p.total_words || 0,
      chapterCount: p.chapter_count || 0,
    })),
    totalWordCount,
  });
});

/** DB row types */
interface UserRow {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

interface DriveConnectionRow {
  id: string;
  drive_email: string;
  token_expires_at: string;
}

interface ProjectSummaryRow {
  id: string;
  title: string;
  status: string;
  total_words: number;
  chapter_count: number;
}

export { users };
