/**
 * Drive connection resolver -- deterministic connection selection for multi-account safety.
 *
 * ## Connection Selection Rules
 *
 * For mutating Drive operations (file writes, uploads, renames, deletes):
 *
 *   1. **Project-bound**: Use `project.drive_connection_id` when the operation is
 *      associated with a project (chapters, exports, folder creation).
 *
 *   2. **Request-explicit**: Use `connectionId` from the request when the caller
 *      specifies which connection to use (e.g., source import, browse).
 *
 *   3. **Fail fast**: If neither is available and the user has multiple connections,
 *      reject with 409 DRIVE_AMBIGUOUS. If the user has exactly one connection,
 *      use it (unambiguous).
 *
 * For read-only operations (browse, picker-token without connectionId):
 *   - Single-connection users: use the only connection (safe, unambiguous).
 *   - Multi-connection users: require explicit connectionId.
 *
 * ## Why This Exists
 *
 * Before this resolver, several code paths used `getValidTokens(userId)` which
 * calls `getStoredTokensByUser()` with `LIMIT 1`. When a user has multiple Drive
 * connections, this selects nondeterministically, potentially writing to the wrong
 * Google account's Drive. See issue #166.
 */

import { AppError } from "../middleware/error-handler.js";
import type { DriveTokenService, ValidTokens } from "./drive-token.js";

/** Result of resolving a Drive connection for an operation. */
export interface ResolvedConnection {
  connectionId: string;
  tokens: ValidTokens;
}

/**
 * Resolve the Drive connection for a project-scoped mutating operation.
 *
 * Resolution order:
 *   1. project.drive_connection_id (from DB)
 *   2. Explicit connectionId parameter (from request)
 *   3. Single-connection fallback (unambiguous)
 *   4. Reject with DRIVE_AMBIGUOUS if multiple connections exist
 *
 * @param tokenService - DriveTokenService for token retrieval
 * @param userId - Authenticated user ID
 * @param projectConnectionId - project.drive_connection_id from the project row (may be null)
 * @param requestConnectionId - connectionId from the request body/query (may be undefined)
 * @returns Resolved connection with valid tokens
 * @throws AppError 422 DRIVE_NOT_CONNECTED if no connections exist
 * @throws AppError 409 DRIVE_AMBIGUOUS if multiple connections and no explicit binding
 * @throws AppError 422 DRIVE_NOT_CONNECTED if resolved connection tokens are invalid
 */
export async function resolveProjectConnection(
  tokenService: DriveTokenService,
  userId: string,
  projectConnectionId: string | null,
  requestConnectionId?: string,
): Promise<ResolvedConnection> {
  // 1. Prefer project-bound connection
  if (projectConnectionId) {
    const tokens = await tokenService.getValidTokensByConnection(projectConnectionId);
    if (!tokens) {
      throw new AppError(
        422,
        "DRIVE_NOT_CONNECTED",
        "Project Drive connection is invalid or expired. Reconnect Google Drive.",
      );
    }
    return { connectionId: projectConnectionId, tokens };
  }

  // 2. Explicit request parameter
  if (requestConnectionId) {
    // Verify the connection belongs to this user
    const connections = await tokenService.getConnectionsForUser(userId);
    if (!connections.some((c) => c.id === requestConnectionId)) {
      throw new AppError(422, "DRIVE_NOT_CONNECTED", "Connection not found for this user.");
    }
    const tokens = await tokenService.getValidTokensByConnection(requestConnectionId);
    if (!tokens) {
      throw new AppError(
        422,
        "DRIVE_NOT_CONNECTED",
        "Drive connection is invalid or expired. Reconnect Google Drive.",
      );
    }
    return { connectionId: requestConnectionId, tokens };
  }

  // 3. Single-connection fallback (unambiguous)
  const connections = await tokenService.getConnectionsForUser(userId);

  if (connections.length === 0) {
    throw new AppError(422, "DRIVE_NOT_CONNECTED", "Google Drive is not connected.");
  }

  if (connections.length > 1) {
    // 4. Reject ambiguous state
    throw new AppError(
      409,
      "DRIVE_AMBIGUOUS",
      "Multiple Google Drive accounts connected. Specify which connection to use or bind the project to a Drive account.",
    );
  }

  // Exactly one connection -- unambiguous
  const tokens = await tokenService.getValidTokensByConnection(connections[0].id);
  if (!tokens) {
    throw new AppError(
      422,
      "DRIVE_NOT_CONNECTED",
      "Drive connection is invalid or expired. Reconnect Google Drive.",
    );
  }
  return { connectionId: connections[0].id, tokens };
}

/**
 * Resolve Drive connection for a read-only operation (no project context).
 *
 * Resolution order:
 *   1. Explicit connectionId parameter
 *   2. Single-connection fallback (unambiguous)
 *   3. Reject with DRIVE_AMBIGUOUS if multiple connections exist
 *
 * @param tokenService - DriveTokenService for token retrieval
 * @param userId - Authenticated user ID
 * @param connectionId - Explicit connectionId (may be undefined)
 * @returns Resolved connection with valid tokens
 */
export async function resolveReadOnlyConnection(
  tokenService: DriveTokenService,
  userId: string,
  connectionId?: string,
): Promise<ResolvedConnection> {
  return resolveProjectConnection(tokenService, userId, null, connectionId);
}
