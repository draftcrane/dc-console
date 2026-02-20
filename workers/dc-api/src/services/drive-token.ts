/**
 * Drive token management -- OAuth flow, token storage/retrieval/refresh, connections.
 *
 * Split from drive.ts per Single Responsibility Principle.
 * All token encryption/decryption, Google OAuth, and D1 connection management lives here.
 *
 * Key responsibilities:
 * - OAuth authorization URL generation
 * - Code-for-tokens exchange
 * - Token encryption/decryption via AES-256-GCM (crypto service)
 * - Token refresh (5 min before expiry per PRD Section 13)
 * - Multi-account connection management
 */

import { encrypt, decrypt } from "./crypto.js";
import type { Env } from "../types/index.js";

/** Google OAuth token response */
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** Stored token data from D1 */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Result of getting valid tokens (may have been refreshed) */
export interface ValidTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  wasRefreshed: boolean;
}

/** Drive connection metadata (no tokens) */
export interface DriveConnection {
  id: string;
  email: string;
  connectedAt: string;
}

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Refresh tokens 5 minutes before expiry per PRD Section 13
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * DriveTokenService handles OAuth flow, token management, and connection CRUD.
 */
export class DriveTokenService {
  constructor(private readonly env: Env) {}

  /**
   * Generates the Google OAuth authorization URL.
   * Uses drive.file scope only per PRD Section 8.
   *
   * @param state - CSRF protection state parameter
   * @param loginHint - Optional email to pre-select Google account (for multi-account)
   * @returns The authorization URL to redirect the user to
   */
  getAuthorizationUrl(state: string, loginHint?: string): string {
    const params = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID,
      redirect_uri: this.env.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope:
        "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly email",
      access_type: "offline",
      prompt: "consent", // Always get refresh token
      state,
    });

    if (loginHint) {
      params.set("login_hint", loginHint);
    }

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for tokens.
   *
   * @param code - The authorization code from Google OAuth callback
   * @returns Token response from Google
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.env.GOOGLE_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token exchange failed:", error);
      throw new Error("Failed to exchange code for tokens");
    }

    return response.json() as Promise<GoogleTokenResponse>;
  }

  /**
   * Gets the Google user's email address.
   *
   * @param accessToken - Valid access token
   * @returns The user's email address
   */
  async getUserEmail(accessToken: string): Promise<string> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get user info");
    }

    const data = (await response.json()) as { email: string };
    return data.email;
  }

  /**
   * Stores encrypted tokens in D1.
   * Upserts on (user_id, drive_email) to preserve existing connection ID on re-auth.
   * This is critical: other tables (source_materials, projects) reference the connection ID as FK.
   *
   * @param userId - The user ID
   * @param connectionId - The connection ID (ULID) - used only for new connections
   * @param tokens - Token response from Google
   * @param email - The Google account email
   * @returns The connection ID (existing or new)
   */
  async storeTokens(
    userId: string,
    connectionId: string,
    tokens: GoogleTokenResponse,
    email: string,
  ): Promise<string> {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const encryptedAccess = await encrypt(tokens.access_token, this.env.ENCRYPTION_KEY);
    // Only encrypt refresh_token when Google provides one. Passing literal ''
    // allows the SQL CASE to correctly preserve the existing stored refresh token
    // on re-auth flows where Google omits the refresh_token.
    const encryptedRefresh = tokens.refresh_token
      ? await encrypt(tokens.refresh_token, this.env.ENCRYPTION_KEY)
      : "";

    await this.env.DB.prepare(
      `INSERT INTO drive_connections (id, user_id, access_token, refresh_token, token_expires_at, drive_email, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT (user_id, drive_email) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = CASE WHEN excluded.refresh_token != '' THEN excluded.refresh_token ELSE drive_connections.refresh_token END,
         token_expires_at = excluded.token_expires_at,
         updated_at = excluded.updated_at`,
    )
      .bind(connectionId, userId, encryptedAccess, encryptedRefresh, expiresAt.toISOString(), email)
      .run();

    // Return the actual connection ID (may differ from input if re-auth of same account)
    const row = await this.env.DB.prepare(
      `SELECT id FROM drive_connections WHERE user_id = ? AND drive_email = ?`,
    )
      .bind(userId, email)
      .first<{ id: string }>();

    return row?.id ?? connectionId;
  }

  /**
   * Gets stored tokens for a specific connection, decrypting them.
   *
   * @param connectionId - The drive connection ID
   * @returns Decrypted tokens or null if not found
   */
  async getStoredTokens(connectionId: string): Promise<StoredTokens | null> {
    const row = await this.env.DB.prepare(
      `SELECT access_token, refresh_token, token_expires_at FROM drive_connections WHERE id = ?`,
    )
      .bind(connectionId)
      .first<{ access_token: string; refresh_token: string; token_expires_at: string }>();

    if (!row) {
      return null;
    }

    const accessToken = await decrypt(row.access_token, this.env.ENCRYPTION_KEY);
    const refreshToken = await decrypt(row.refresh_token, this.env.ENCRYPTION_KEY);
    const expiresAt = new Date(row.token_expires_at);

    return { accessToken, refreshToken, expiresAt };
  }

  /**
   * @deprecated Use resolveProjectConnection() or resolveReadOnlyConnection() instead.
   * Gets stored tokens for a user's first connection via LIMIT 1 (nondeterministic
   * when multiple connections exist). See #166.
   *
   * @param userId - The user ID
   * @returns Decrypted tokens or null if not connected
   */
  async getStoredTokensByUser(
    userId: string,
  ): Promise<(StoredTokens & { connectionId: string }) | null> {
    const row = await this.env.DB.prepare(
      `SELECT id, access_token, refresh_token, token_expires_at FROM drive_connections WHERE user_id = ? LIMIT 1`,
    )
      .bind(userId)
      .first<{
        id: string;
        access_token: string;
        refresh_token: string;
        token_expires_at: string;
      }>();

    if (!row) {
      return null;
    }

    const accessToken = await decrypt(row.access_token, this.env.ENCRYPTION_KEY);
    const refreshToken = await decrypt(row.refresh_token, this.env.ENCRYPTION_KEY);
    const expiresAt = new Date(row.token_expires_at);

    return { connectionId: row.id, accessToken, refreshToken, expiresAt };
  }

  /**
   * Refreshes the access token using the refresh token.
   *
   * @param refreshToken - The refresh token
   * @returns New token response
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Token refresh failed:", error);
      throw new Error("Failed to refresh access token");
    }

    return response.json() as Promise<GoogleTokenResponse>;
  }

  /**
   * Gets valid tokens for a specific connection, refreshing if needed.
   * Per PRD Section 13: Automatic token refresh, 5 min before expiry.
   *
   * @param connectionId - The drive connection ID
   * @returns Valid tokens, or null if connection not found
   */
  async getValidTokensByConnection(connectionId: string): Promise<ValidTokens | null> {
    const stored = await this.getStoredTokens(connectionId);
    if (!stored) {
      return null;
    }

    return this.ensureTokensFresh(connectionId, stored);
  }

  /**
   * @deprecated Use resolveProjectConnection() or resolveReadOnlyConnection() instead.
   * This method selects nondeterministically when users have multiple Drive connections.
   * Retained for backward compatibility but no production code should call it. See #166.
   *
   * @param userId - The user ID
   * @returns Valid tokens with connectionId, or null if not connected
   */
  async getValidTokens(userId: string): Promise<(ValidTokens & { connectionId: string }) | null> {
    const stored = await this.getStoredTokensByUser(userId);
    if (!stored) {
      return null;
    }

    const result = await this.ensureTokensFresh(stored.connectionId, stored);
    if (!result) return null;

    return { ...result, connectionId: stored.connectionId };
  }

  /**
   * Internal: refresh tokens if within 5min of expiry.
   */
  private async ensureTokensFresh(
    connectionId: string,
    stored: StoredTokens,
  ): Promise<ValidTokens | null> {
    const now = Date.now();
    const expiresAt = stored.expiresAt.getTime();

    // Check if token needs refresh (expires within 5 minutes)
    if (expiresAt - now < REFRESH_BUFFER_MS) {
      try {
        const newTokens = await this.refreshAccessToken(stored.refreshToken);
        const newExpiresAt = new Date(now + newTokens.expires_in * 1000);

        // Update stored tokens
        const encryptedAccess = await encrypt(newTokens.access_token, this.env.ENCRYPTION_KEY);
        await this.env.DB.prepare(
          `UPDATE drive_connections
           SET access_token = ?, token_expires_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
           WHERE id = ?`,
        )
          .bind(encryptedAccess, newExpiresAt.toISOString(), connectionId)
          .run();

        return {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || stored.refreshToken,
          expiresAt: newExpiresAt,
          wasRefreshed: true,
        };
      } catch (err) {
        console.error("Token refresh failed, using existing token:", err);
        // Fall through to use existing token
      }
    }

    return {
      ...stored,
      wasRefreshed: false,
    };
  }

  /**
   * Returns all Drive connections for a user (metadata only, no tokens).
   *
   * @param userId - The user ID
   * @returns Array of connection metadata
   */
  async getConnectionsForUser(userId: string): Promise<DriveConnection[]> {
    const result = await this.env.DB.prepare(
      `SELECT id, drive_email, created_at FROM drive_connections WHERE user_id = ? ORDER BY created_at ASC`,
    )
      .bind(userId)
      .all<{ id: string; drive_email: string; created_at: string }>();

    return (result.results ?? []).map((row) => ({
      id: row.id,
      email: row.drive_email,
      connectedAt: row.created_at,
    }));
  }

  /**
   * Revokes the OAuth token with Google.
   * Per PRD Section 8 (US-008): Disconnects Drive, revokes token.
   *
   * @param accessToken - The access token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${accessToken}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      // Log but don't throw - token might already be invalid
      console.warn("Token revocation returned non-200:", response.status);
    }
  }

  /**
   * Deletes a specific drive connection from D1.
   *
   * @param connectionId - The connection ID
   * @param userId - The user ID (for ownership verification)
   */
  async deleteConnectionById(connectionId: string, userId: string): Promise<void> {
    await this.env.DB.prepare(`DELETE FROM drive_connections WHERE id = ? AND user_id = ?`)
      .bind(connectionId, userId)
      .run();
  }
}
