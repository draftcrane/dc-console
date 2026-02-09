import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validationError } from "../middleware/error-handler.js";
import { ProjectService } from "../services/project.js";

/**
 * Projects API routes
 *
 * Per PRD Section 12:
 * - POST /projects - Creates project with default chapter
 * - GET /projects - Lists active projects with word counts
 * - GET /projects/:projectId - Project details with chapter list
 * - PATCH /projects/:projectId - Updates title, description, settings
 * - DELETE /projects/:projectId - Soft-delete (status='archived')
 *
 * All routes require authentication.
 * Authorization: All queries include WHERE user_id = ?
 */
const projects = new Hono<{ Bindings: Env }>();

// All project routes require authentication
projects.use("*", requireAuth);

/**
 * POST /projects
 * Create a new project with a default "Chapter 1"
 *
 * Per PRD US-009: Title (required, max 500 chars) and description (optional, max 1000 chars)
 */
projects.post("/", async (c) => {
  const { userId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
  };

  if (!body.title) {
    validationError("Title is required");
  }

  const service = new ProjectService(c.env.DB);
  const project = await service.createProject(userId, {
    title: body.title,
    description: body.description,
  });

  return c.json(project, 201);
});

/**
 * GET /projects
 * List user's active projects with word counts
 */
projects.get("/", async (c) => {
  const { userId } = c.get("auth");

  const service = new ProjectService(c.env.DB);
  const projectList = await service.listProjects(userId);

  return c.json({ projects: projectList });
});

/**
 * GET /projects/:projectId
 * Get project details with chapter list
 */
projects.get("/:projectId", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const service = new ProjectService(c.env.DB);
  const project = await service.getProject(userId, projectId);

  return c.json(project);
});

/**
 * PATCH /projects/:projectId
 * Update project title and/or description
 */
projects.patch("/:projectId", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
  };

  // At least one field should be provided
  if (body.title === undefined && body.description === undefined) {
    validationError("At least one of title or description must be provided");
  }

  const service = new ProjectService(c.env.DB);
  const project = await service.updateProject(userId, projectId, body);

  return c.json(project);
});

/**
 * DELETE /projects/:projectId
 * Soft delete project (status='archived')
 *
 * Per PRD US-023: Soft delete, Drive files preserved
 */
projects.delete("/:projectId", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const service = new ProjectService(c.env.DB);
  await service.deleteProject(userId, projectId);

  return c.json({ success: true });
});

export { projects };
