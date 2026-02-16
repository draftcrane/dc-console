/**
 * Google Drive OAuth and file management routes.
 * Implements PRD Section 8 (US-005 through US-008) and Section 12 API Surface.
 *
 * Routes:
 * - GET /drive/authorize - Returns Google OAuth authorization URL
 * - GET /drive/callback - OAuth callback, exchanges code for tokens
 * - POST /drive/folders - Creates Book Folder in Drive
 * - GET /drive/folders/:folderId/children - Lists files in Book Folder
 * - DELETE /drive/connection - Disconnects Drive, revokes token
 */

import { Hono } from "hono";
import { ulid } from "ulid";
import type { Env } from "../types/index.js";
import { requireAuth, validationError, AppError } from "../middleware/index.js";
import { standardRateLimit } from "../middleware/rate-limit.js";
import { DriveService } from "../services/drive.js";

const drive = new Hono<{ Bindings: Env }>();

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
 */
drive.get("/authorize", requireAuth, standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  // Generate CSRF state token
  // Format: userId:timestamp:random to allow validation
  const timestamp = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(random)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const state = `${userId}:${timestamp}:${randomHex}`;

  // Store state in KV with 10 minute expiry for CSRF validation
  await c.env.CACHE.put(`oauth_state:${state}`, userId, { expirationTtl: 600 });

  const authUrl = driveService.getAuthorizationUrl(state);

  return c.json({
    authorizationUrl: authUrl,
  });
});

/**
 * GET /drive/callback
 * OAuth callback - exchanges code for tokens, encrypts and stores them.
 * Per PRD Section 8 (US-005): Tokens stored server-side, encrypted (AES-256-GCM).
 */
drive.get("/callback", async (c) => {
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

  // Extract userId from state for verification
  const [stateUserId] = state.split(":");
  if (stateUserId !== storedUserId) {
    validationError("State user ID mismatch");
  }

  const driveService = new DriveService(c.env);

  try {
    // Exchange code for tokens
    const tokens = await driveService.exchangeCodeForTokens(code);

    // Get the user's Google email
    const email = await driveService.getUserEmail(tokens.access_token);

    // Store encrypted tokens
    const connectionId = ulid();
    await driveService.storeTokens(storedUserId, connectionId, tokens, email);

    // Redirect to success page
    const redirectUrl = new URL(c.env.FRONTEND_URL);
    redirectUrl.pathname = "/drive/success";
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
 * POST /drive/folders
 * Creates a Book Folder in Google Drive.
 * Per PRD Section 8 (US-006): Auto-creates folder named after project title.
 */
drive.post("/folders", requireAuth, standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  // Get valid tokens (refreshing if needed)
  const tokens = await driveService.getValidTokens(userId);
  if (!tokens) {
    driveNotConnected();
  }

  // Parse request body
  const body = await c.req.json<{ title: string }>();
  if (!body.title || typeof body.title !== "string") {
    validationError("Folder title is required");
  }

  const folderName = body.title.trim();
  if (!folderName || folderName.length > 500) {
    validationError("Folder title must be between 1 and 500 characters");
  }

  try {
    const folder = await driveService.createFolder(tokens.accessToken, folderName);

    return c.json({
      id: folder.id,
      name: folder.name,
      webViewLink: folder.webViewLink,
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
drive.get("/folders/:folderId/children", requireAuth, standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const folderId = c.req.param("folderId");
  const driveService = new DriveService(c.env);

  if (!folderId) {
    validationError("Folder ID is required");
  }

  // Get valid tokens (refreshing if needed)
  const tokens = await driveService.getValidTokens(userId);
  if (!tokens) {
    driveNotConnected();
  }

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
 * DELETE /drive/connection
 * Disconnects Google Drive - revokes token and deletes from D1.
 * Per PRD Section 8 (US-008): Revokes OAuth token, deletes from D1. Drive files remain untouched.
 */
drive.delete("/connection", requireAuth, standardRateLimit, async (c) => {
  const { userId } = c.get("auth");
  const driveService = new DriveService(c.env);

  // Get stored tokens to revoke
  const tokens = await driveService.getStoredTokens(userId);

  if (tokens) {
    // Revoke the token with Google (best effort)
    try {
      await driveService.revokeToken(tokens.accessToken);
    } catch (err) {
      console.warn("Token revocation failed:", err);
      // Continue with deletion regardless
    }
  }

  // Delete from D1
  await driveService.deleteConnection(userId);

  return c.json({
    success: true,
    message: "Google Drive disconnected. Your files in Drive remain untouched.",
  });
});

export { drive };
