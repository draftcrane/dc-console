import { Hono } from "hono";
import type { Env } from "../types/index.js";
import { requireAuth } from "../middleware/auth.js";
import { standardRateLimit, exportRateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../middleware/error-handler.js";
import { ProjectService } from "../services/project.js";
import { BackupService } from "../services/backup.js";
import { DriveService } from "../services/drive.js"; // NEW IMPORT
import { safeContentDisposition } from "../utils/file-names.js";

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
projects.use("*", standardRateLimit);

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
 * POST /projects/import
 * Import a project from a ZIP backup file.
 * Registered before /:projectId routes to avoid parameter matching.
 */
projects.post("/import", exportRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    validationError("A .zip file is required");
  }

  if (file.size > 50 * 1024 * 1024) {
    validationError("Backup file must be under 50MB");
  }

  if (!file.name.endsWith(".zip")) {
    validationError("File must be a .zip file");
  }

  const service = new BackupService(c.env.DB, c.env.EXPORTS_BUCKET);
  const result = await service.importBackup(userId, await file.arrayBuffer());

  return c.json(result, 201);
});

/**
 * POST /projects/:projectId/duplicate
 * Duplicate a project with all chapters and content.
 * Registered before /:projectId routes to avoid parameter matching.
 */
projects.post("/:projectId/duplicate", exportRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const service = new ProjectService(c.env.DB, c.env.EXPORTS_BUCKET);
  const result = await service.duplicateProject(userId, projectId);

  return c.json(result, 201);
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

/**
 * POST /projects/:projectId/connect-drive
 * Connect a project to Google Drive by creating a dedicated folder.
 * Accepts optional { connectionId } to specify which Drive account to use.
 * Falls back to user's first connection if not specified (backward compat).
 */
projects.post("/:projectId/connect-drive", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");
  const body = (await c.req.json().catch(() => ({}))) as { connectionId?: string };

  const projectService = new ProjectService(c.env.DB);
  const project = await projectService.getProject(userId, projectId); // Includes ownership check

  if (project.driveFolderId) {
    // Already connected, return existing ID
    return c.json({ driveFolderId: project.driveFolderId });
  }

  const driveService = new DriveService(c.env);

  // Get tokens: prefer specified connectionId, fall back to first connection
  let accessToken: string;
  let connectionId: string;

  if (body.connectionId) {
    // Verify connection belongs to user
    const connections = await driveService.getConnectionsForUser(userId);
    if (!connections.some((conn) => conn.id === body.connectionId)) {
      validationError("Drive connection not found for this user.");
    }
    const tokens = await driveService.getValidTokensByConnection(body.connectionId);
    if (!tokens) {
      validationError("Drive connection tokens are invalid.");
    }
    accessToken = tokens.accessToken;
    connectionId = body.connectionId;
  } else {
    const tokens = await driveService.getValidTokens(userId);
    if (!tokens) {
      validationError("Google Drive is not connected for this user.");
    }
    accessToken = tokens.accessToken;
    connectionId = tokens.connectionId;
  }

  // Create a folder named after the project title
  const driveFolder = await driveService.createFolder(accessToken, project.title);

  // Store drive_folder_id and drive_connection_id on the project
  await c.env.DB.prepare(
    `UPDATE projects SET drive_folder_id = ?, drive_connection_id = ? WHERE id = ?`,
  )
    .bind(driveFolder.id, connectionId, project.id)
    .run();

  console.info(
    JSON.stringify({
      level: "info",
      event: "project_drive_connected",
      user_id: userId,
      project_id: project.id,
      drive_folder_id: driveFolder.id,
      connection_id: connectionId,
    }),
  );

  return c.json({ driveFolderId: driveFolder.id });
});

/**
 * POST /projects/:projectId/disconnect-drive
 * Disconnect a project from its Drive folder by clearing drive_folder_id and drive_connection_id.
 * This does not disconnect the user's Google account.
 */
projects.post("/:projectId/disconnect-drive", async (c) => {
  const { userId } = c.get("auth");
  const projectId = c.req.param("projectId");

  const projectService = new ProjectService(c.env.DB);
  const project = await projectService.getProject(userId, projectId); // Includes ownership check

  await c.env.DB.prepare(
    `UPDATE projects SET drive_folder_id = NULL, drive_connection_id = NULL WHERE id = ?`,
  )
    .bind(project.id)
    .run();

  console.info(
    JSON.stringify({
      level: "info",
      event: "project_drive_disconnected",
      user_id: userId,
      project_id: project.id,
    }),
  );

  return c.json({ success: true });
});

/**
 * GET /projects/:projectId/backup
 * Download a ZIP backup of the project (manifest + chapter HTML)
 */
projects.get("/:projectId/backup", exportRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const service = new BackupService(c.env.DB, c.env.EXPORTS_BUCKET);
  const { data, fileName } = await service.generateBackup(userId, c.req.param("projectId"));

  return new Response(data, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": safeContentDisposition(fileName),
      "Cache-Control": "no-store",
    },
  });
});

export { projects };
