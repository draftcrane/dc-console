/**
 * Google Drive OAuth and file management routes.
 * Implements PRD Section 8 (US-005 through US-008) and Section 12 API Surface.
 *
 * Exports two Hono sub-apps:
 * - driveCallback: Public OAuth callback (mounted before global auth in index.ts)
 * - drive: Authenticated Drive management routes (mounted after global auth)
 *
 * Public routes (driveCallback):
 * - GET /drive/callback - OAuth callback, exchanges code for tokens (upsert on user+email)
 *
 * Authenticated routes (drive):
 * - GET /drive/authorize - Returns Google OAuth authorization URL (supports loginHint)
 * - GET /drive/connection - Returns all Drive connections for the user
 * - GET /drive/picker-token/:connectionId - Returns short-lived OAuth token for Google Picker
 * - POST /drive/folders - Creates Book Folder in Drive
 * - GET /drive/folders/:folderId/children - Lists files in Book Folder
 * - GET /drive/browse - Browse Drive folders and Docs
 * - DELETE /drive/connection/:connectionId - Disconnects specific Drive account + cascade
 * - DELETE /drive/connection - Disconnects all Drive connections (legacy)
 */

import { Hono } from "hono";
import { ulid } from "ulidx";
import type { Env } from "../types/index.js";
import { validationError, AppError } from "../middleware/index.js";
import { standardRateLimit, rateLimit } from "../middleware/rate-limit.js";
import { DriveService } from "../services/drive.js";
import { SourceMaterialService } from "../services/source-material.js";
import {
  resolveProjectConnection,
  resolveReadOnlyConnection,
} from "../services/drive-connection-resolver.js";

/** Picker token rate limit: 10 req/min (only needed once per Picker open) */
const pickerTokenRateLimit = rateLimit({
  prefix: "picker-token",
  maxRequests: 10,
  windowSeconds: 60,
});

const drive = new Hono<{ Bindings: Env }>();

/**
 * Public callback sub-app for OAuth redirect.
 * Mounted in index.ts BEFORE the global auth barrier because Google redirects
 * the browser here without a Clerk JWT - it uses a CSRF state token instead.
 */
const driveCallback = new Hono<{ Bindings: Env }>();

/** Helper to throw Drive-specific errors */
function driveError(message: string): never {
  throw new AppError(502, "DRIVE_ERROR", message);
}

function driveNotConnected(message = "Google Drive not connected"): never {
  throw new AppError(422, "DRIVE_NOT_CONNECTED", message);
}

/** Validate that a frontend redirect URL is safe (matches configured FRONTEND_URL origin) */
function validateFrontendUrl(redirectUrl: URL, configuredFrontendUrl: string): void {
  const allowed = new URL(configuredFrontendUrl);
  if (redirectUrl.origin !== allowed.origin) {
    throw new AppError(500, "INTERNAL_ERROR", "Frontend redirect URL origin mismatch");
  }
}

/**
 * GET /drive/authorize
 * Returns Google OAuth authorization URL.
 * Per PRD Section 8 (US-005): OAuth with drive.file scope, redirect-based flow only.
 * Supports ?loginHint= for multi-account OAuth (pre-selects Google account).
 */
drive.get("/authorize", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const loginHint = c.req.query("loginHint");
  const projectId = c.req.query("projectId");
  const driveService = new DriveService(c.env);

  // Generate CSRF state token
  // Format: userId:timestamp:random:projectId to allow validation + auto-linking
  // projectId is optional — empty string when not provided
  const timestamp = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(random)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const state = `${userId}:${timestamp}:${randomHex}:${projectId || ""}`;

  // Store state in KV with 10 minute expiry for CSRF validation
  await c.env.CACHE.put(`oauth_state:${state}`, userId, { expirationTtl: 600 });

  const authUrl = driveService.getAuthorizationUrl(state, loginHint || undefined);

  return c.json({
    authorizationUrl: authUrl,
  });
});

/**
 * GET /drive/callback
 * OAuth callback - exchanges code for tokens, encrypts and stores them.
 * Per PRD Section 8 (US-005): Tokens stored server-side, encrypted (AES-256-GCM).
 * Upserts on (user_id, drive_email) to preserve existing connection IDs on re-auth.
 *
 * Public route: mounted on driveCallback sub-app (before global auth barrier)
 * because Google redirects the browser here without a Clerk JWT.
 */
driveCallback.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  // Handle user denying access
  if (error) {
    const redirectUrl = new URL(c.env.FRONTEND_URL);
    redirectUrl.pathname = "/drive/error";
    redirectUrl.searchParams.set("error", error);
    validateFrontendUrl(redirectUrl, c.env.FRONTEND_URL);
    return c.redirect(redirectUrl.toString());
  }

  if (!code || !state) {
    validationError("Missing code or state parameter");
  }

  // Validate CSRF state
  const storedUserId = await c.env.CACHE.get(`oauth_state:${state}`);
  if (!storedUserId) {
    validationError("Invalid or expired state parameter");
  }

  // Delete the state to prevent reuse
  await c.env.CACHE.delete(`oauth_state:${state}`);

  // Extract userId and optional projectId from state for verification
  const stateParts = state.split(":");
  const stateUserId = stateParts[0];
  // projectId is the 4th part (index 3) — may be empty string
  const stateProjectId = stateParts[3] || "";
  if (stateUserId !== storedUserId) {
    validationError("State user ID mismatch");
  }

  const driveService = new DriveService(c.env);

  try {
    // Exchange code for tokens
    const tokens = await driveService.exchangeCodeForTokens(code);

    // Get the user's Google email
    const email = await driveService.getUserEmail(tokens.access_token);

    // Store encrypted tokens (upserts on user_id + email, preserving existing connection ID)
    const connectionId = ulid();
    const actualConnectionId = await driveService.storeTokens(
      storedUserId,
      connectionId,
      tokens,
      email,
    );

    // Redirect to success page with connection ID for auto-linking flows
    const redirectUrl = new URL(c.env.FRONTEND_URL);
    redirectUrl.pathname = "/drive/success";
    redirectUrl.searchParams.set("cid", actualConnectionId);
    redirectUrl.searchParams.set("email", email);
    // Pass projectId as fallback for iPad Safari sessionStorage loss
    if (stateProjectId) {
      redirectUrl.searchParams.set("pid", stateProjectId);
    }
    validateFrontendUrl(redirectUrl, c.env.FRONTEND_URL);
    return c.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Drive OAuth callback failed:", err);

    const redirectUrl = new URL(c.env.FRONTEND_URL);
    redirectUrl.pathname = "/drive/error";
    redirectUrl.searchParams.set("error", "token_exchange_failed");
    validateFrontendUrl(redirectUrl, c.env.FRONTEND_URL);
    return c.redirect(redirectUrl.toString());
  }
});

/**
 * GET /drive/connection
 * Returns all Drive connections for the authenticated user.
 * Tokens are never exposed to the frontend per PRD Section 8 (US-005).
 * Returns { connections: [...] } array for multi-account support.
 * Also returns { connected, email, connectedAt } for backward compatibility.
 */
drive.get("/connection", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  const connections = await driveService.getConnectionsForUser(userId);

  if (connections.length === 0) {
    return c.json({
      connected: false,
      connections: [],
    });
  }

  // Backward compatibility: first connection's data at top level
  return c.json({
    connected: true,
    email: connections[0].email,
    connectedAt: connections[0].connectedAt,
    connections,
  });
});

/**
 * GET /drive/picker-token/:connectionId
 * Returns a short-lived OAuth access token for Google Picker, scoped to a specific connection.
 *
 * The Google Picker API runs client-side and needs the user's access token
 * to display their files. This is Google's documented pattern:
 * https://developers.google.com/workspace/drive/picker/guides/overview
 *
 * Security:
 * - Token is scoped to drive.file (narrow access)
 * - Token is short-lived (~1 hour)
 * - Tighter rate limit (10 req/min) since token is only needed once per Picker open
 * - Frontend must use token immediately and never persist it
 */
drive.get("/picker-token/:connectionId", pickerTokenRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const connectionId = c.req.param("connectionId");
  const driveService = new DriveService(c.env);

  const tokens = await driveService.getValidTokensByConnection(connectionId);
  if (!tokens) {
    driveNotConnected();
  }

  // Verify this connection belongs to the user
  const connections = await driveService.getConnectionsForUser(userId);
  if (!connections.some((conn) => conn.id === connectionId)) {
    driveNotConnected("Connection not found for this user");
  }

  // Calculate remaining lifetime in seconds
  const expiresIn = Math.max(0, Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000));

  console.info(
    JSON.stringify({
      level: "info",
      event: "picker_token_issued",
      user_id: userId,
      connection_id: connectionId,
      expires_in: expiresIn,
    }),
  );

  return c.json({
    accessToken: tokens.accessToken,
    expiresIn,
  });
});

/**
 * Legacy: GET /drive/picker-token (no connectionId)
 * Uses single-connection fallback for users with one Drive account.
 * Rejects with DRIVE_AMBIGUOUS if multiple connections exist (multi-account users
 * must use the connectionId-scoped endpoint).
 */
drive.get("/picker-token", pickerTokenRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  // Read-only: resolve via single-connection or reject ambiguous
  const { tokens } = await resolveReadOnlyConnection(driveService.tokenService, userId);

  const expiresIn = Math.max(0, Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000));

  return c.json({
    accessToken: tokens.accessToken,
    expiresIn,
  });
});

/**
 * POST /drive/folders
 * Creates a Book Folder in Google Drive for a project.
 * Per PRD Section 8 (US-006): Auto-creates folder named after project title.
 *
 * Idempotent: If the project already has a drive_folder_id, returns the existing folder info.
 * Stores the folder ID back on the project record.
 */
drive.post("/folders", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  // Parse request body - requires projectId, optional connectionId
  const body = await c.req.json<{ projectId: string; connectionId?: string }>();
  if (!body.projectId || typeof body.projectId !== "string") {
    validationError("projectId is required");
  }

  // Look up the project (with ownership check)
  const project = await c.env.DB.prepare(
    `SELECT id, title, drive_folder_id, drive_connection_id
     FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`,
  )
    .bind(body.projectId, userId)
    .first<{
      id: string;
      title: string;
      drive_folder_id: string | null;
      drive_connection_id: string | null;
    }>();

  if (!project) {
    throw new AppError(404, "NOT_FOUND", "Project not found");
  }

  // Idempotent: if folder already exists, return existing info
  if (project.drive_folder_id) {
    return c.json({
      id: project.drive_folder_id,
      name: project.title,
      webViewLink: `https://drive.google.com/drive/folders/${project.drive_folder_id}`,
      alreadyExisted: true,
    });
  }

  // Resolve Drive connection: project binding > request param > single-connection fallback
  const { connectionId, tokens } = await resolveProjectConnection(
    driveService.tokenService,
    userId,
    project.drive_connection_id,
    body.connectionId,
  );

  const folderName = project.title.trim();
  if (!folderName || folderName.length > 500) {
    validationError("Project title must be between 1 and 500 characters for folder creation");
  }

  try {
    const folder = await driveService.createFolder(tokens.accessToken, folderName);

    // Store the drive_folder_id and bind connection if not already bound
    await c.env.DB.prepare(
      `UPDATE projects SET drive_folder_id = ?, drive_connection_id = COALESCE(drive_connection_id, ?),
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ? AND user_id = ?`,
    )
      .bind(folder.id, connectionId, project.id, userId)
      .run();

    return c.json({
      id: folder.id,
      name: folder.name,
      webViewLink: folder.webViewLink,
      alreadyExisted: false,
    });
  } catch (err) {
    console.error("Create folder failed:", err);
    driveError("Failed to create folder in Google Drive");
  }
});

/**
 * GET /drive/folders/:folderId/children
 * Lists DraftCrane-created files in a Book Folder.
 * Per PRD Section 8 (US-007): Read-only listing of DraftCrane-created files.
 */
drive.get("/folders/:folderId/children", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const folderId = c.req.param("folderId");
  const connectionId = c.req.query("connectionId") || undefined;
  const driveService = new DriveService(c.env);

  if (!folderId) {
    validationError("Folder ID is required");
  }

  // Resolve connection: explicit param > single-connection fallback > reject ambiguous
  const { tokens } = await resolveReadOnlyConnection(
    driveService.tokenService,
    userId,
    connectionId,
  );

  try {
    const files = await driveService.listFolderChildren(tokens.accessToken, folderId);

    return c.json({
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      })),
    });
  } catch (err) {
    console.error("List folder children failed:", err);
    driveError("Failed to list folder contents");
  }
});

/**
 * GET /drive/browse
 * Browse Drive folders and Docs without the Google Picker iframe.
 * Query params:
 * - folderId (optional, default "root")
 * - connectionId (optional, for multi-account)
 * - pageToken (optional)
 */
drive.get("/browse", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  const folderId = c.req.query("folderId") || "root";
  const connectionId = c.req.query("connectionId") || undefined;
  const pageToken = c.req.query("pageToken") || undefined;

  // Read-only: resolve via explicit connectionId or single-connection fallback
  const { tokens } = await resolveReadOnlyConnection(
    driveService.tokenService,
    userId,
    connectionId,
  );

  try {
    const result = await driveService.listFolderChildrenPage(tokens.accessToken, folderId, {
      pageSize: 200,
      pageToken,
    });

    // Deduplicate by file ID and filter to Docs + Folders only
    const seen = new Set<string>();
    const files: typeof result.files = [];
    for (const file of result.files || []) {
      if (seen.has(file.id)) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "drive_browse_duplicate",
            file_id: file.id,
            folder_id: folderId,
          }),
        );
        continue;
      }
      seen.add(file.id);
      if (
        file.mimeType === "application/vnd.google-apps.document" ||
        file.mimeType === "application/vnd.google-apps.folder"
      ) {
        files.push(file);
      }
    }

    return c.json({ files, nextPageToken: result.nextPageToken });
  } catch (err) {
    console.error("Drive browse failed:", err);
    driveError("Failed to browse Drive");
  }
});

/**
 * GET /drive/connection/:connectionId/files
 * Browse a specific Drive connection's files and folders, filtered for the app.
 * Query params:
 * - folderId (optional, default "root")
 * - pageToken (optional)
 */
drive.get("/connection/:connectionId/files", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  const connectionId = c.req.param("connectionId");
  const folderId = c.req.query("folderId") || "root";
  const pageToken = c.req.query("pageToken") || undefined;

  // Resolve connection, ensuring it belongs to the user
  const { tokens } = await resolveReadOnlyConnection(
    driveService.tokenService,
    userId,
    connectionId,
  );

  try {
    const result = await driveService.browseFolder(tokens.accessToken, folderId, {
      pageSize: 100,
      pageToken,
    });

    return c.json({ files: result.files, nextPageToken: result.nextPageToken });
  } catch (err) {
    console.error("Drive file browser failed:", err);
    driveError("Failed to browse Drive files");
  }
});

/**
 * GET /drive/connection/:connectionId/files/:fileId/content
 * Gets the parsed content of a specific file.
 */
drive.get("/connection/:connectionId/files/:fileId/content", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  const connectionId = c.req.param("connectionId");
  const fileId = c.req.param("fileId");

  // Resolve connection, ensuring it belongs to the user
  const { tokens } = await resolveReadOnlyConnection(
    driveService.tokenService,
    userId,
    connectionId,
  );

  try {
    const result = await driveService.getFileContent(tokens.accessToken, fileId);
    return c.json(result);
  } catch (err) {
    console.error("Get file content failed:", err);
    driveError("Failed to get file content");
  }
});

/**
 * DELETE /drive/connection/:connectionId
 * Disconnects a specific Google Drive account.
 * Cascade: archives sources, clears project output drive.
 * Per plan: simplified 3-step cascade (D1 batch + token revoke + skip R2 cleanup).
 */
drive.delete("/connection/:connectionId", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const connectionId = c.req.param("connectionId");
  const driveService = new DriveService(c.env);

  // Verify connection belongs to user and get tokens for revocation
  const connections = await driveService.getConnectionsForUser(userId);
  const connection = connections.find((conn) => conn.id === connectionId);
  if (!connection) {
    throw new AppError(404, "NOT_FOUND", "Drive connection not found");
  }

  // Fetch tokens BEFORE deletion for revocation
  const tokens = await driveService.getStoredTokens(connectionId).catch(() => null);

  // Step 1: D1 batch -- archive sources, clear project refs, delete connection
  const sourceService = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
  await sourceService.archiveByConnection(connectionId);

  // Clear chapter drive_file_ids for projects using this connection
  await c.env.DB.prepare(
    `UPDATE chapters SET drive_file_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE project_id IN (SELECT id FROM projects WHERE drive_connection_id = ?)`,
  )
    .bind(connectionId)
    .run();

  // Clear project output drive references
  await c.env.DB.prepare(
    `UPDATE projects SET drive_connection_id = NULL, drive_folder_id = NULL,
     updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE drive_connection_id = ?`,
  )
    .bind(connectionId)
    .run();

  // Delete the connection
  await driveService.deleteConnectionById(connectionId, userId);

  // Step 2: Best-effort token revocation (non-blocking)
  if (tokens) {
    driveService.revokeToken(tokens.accessToken).catch((err) => {
      console.warn("Token revocation failed (non-blocking):", err);
    });
  }

  // Step 3: Skip R2 cleanup at Phase 0 (orphaned objects cost fractions of a cent)

  console.info(
    JSON.stringify({
      level: "info",
      event: "drive_connection_disconnected",
      user_id: userId,
      connection_id: connectionId,
      email: connection.email,
    }),
  );

  return c.json({
    success: true,
    message: "Google Drive account disconnected. Your files in Drive remain untouched.",
  });
});

/**
 * Legacy: DELETE /drive/connection (no connectionId)
 * Disconnects all Drive connections for backward compatibility.
 */
drive.delete("/connection", standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  const connections = await driveService.getConnectionsForUser(userId);

  for (const conn of connections) {
    // Fetch tokens BEFORE deletion for revocation
    const tokens = await driveService.getStoredTokens(conn.id).catch(() => null);

    // Archive sources and links per connection
    const sourceService = new SourceMaterialService(c.env.DB, c.env.EXPORTS_BUCKET);
    await sourceService.archiveByConnection(conn.id);

    // Delete the connection
    await driveService.deleteConnectionById(conn.id, userId);

    // Best-effort token revocation (non-blocking)
    if (tokens) {
      driveService.revokeToken(tokens.accessToken).catch(() => {});
    }
  }

  // Clear all project drive references
  await c.env.DB.prepare(
    `UPDATE projects SET drive_connection_id = NULL, drive_folder_id = NULL,
     updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE user_id = ?`,
  )
    .bind(userId)
    .run();

  // Clear all chapter drive_file_ids
  await c.env.DB.prepare(
    `UPDATE chapters SET drive_file_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)`,
  )
    .bind(userId)
    .run();

  return c.json({
    success: true,
    message: "Google Drive disconnected. Your files in Drive remain untouched.",
  });
});

export { drive, driveCallback };
