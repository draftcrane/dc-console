/**
 * Google Drive service for OAuth and file management.
 * Implements US-005 through US-008 from PRD Section 8.
 *
 * Key responsibilities:
 * - Token encryption/decryption (AES-256-GCM)
 * - Token refresh (5 min before expiry per PRD Section 13)
 * - Google Drive API calls (folders, files)
 */

import { encrypt, decrypt } from "./crypto.js";
import type { Env } from "../types/index.js";
import { validateDriveId, escapeDriveQuery } from "../utils/drive-query.js";

/** Google OAuth token response */
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** Google Drive file metadata */
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

/** Google Drive folder create response */
interface DriveFolderResponse {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

/** Stored token data from D1 */
interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Result of getting valid tokens (may have been refreshed) */
interface ValidTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  wasRefreshed: boolean;
}

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Refresh tokens 5 minutes before expiry per PRD Section 13
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * DriveService handles all Google Drive interactions.
 */
export class DriveService {
  constructor(private readonly env: Env) {}

  /**
   * Generates the Google OAuth authorization URL.
   * Uses drive.file scope only per PRD Section 8.
   *
   * @param state - CSRF protection state parameter
   * @returns The authorization URL to redirect the user to
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID,
      redirect_uri: this.env.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file",
      access_type: "offline",
      prompt: "consent", // Always get refresh token
      state,
    });

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
   *
   * @param userId - The user ID
   * @param connectionId - The connection ID (ULID)
   * @param tokens - Token response from Google
   * @param email - The Google account email
   */
  async storeTokens(
    userId: string,
    connectionId: string,
    tokens: GoogleTokenResponse,
    email: string,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const encryptedAccess = await encrypt(tokens.access_token, this.env.ENCRYPTION_KEY);
    const encryptedRefresh = await encrypt(tokens.refresh_token || "", this.env.ENCRYPTION_KEY);

    await this.env.DB.prepare(
      `INSERT INTO drive_connections (id, user_id, access_token, refresh_token, token_expires_at, drive_email, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = CASE WHEN excluded.refresh_token != '' THEN excluded.refresh_token ELSE drive_connections.refresh_token END,
         token_expires_at = excluded.token_expires_at,
         drive_email = excluded.drive_email,
         updated_at = excluded.updated_at`,
    )
      .bind(connectionId, userId, encryptedAccess, encryptedRefresh, expiresAt.toISOString(), email)
      .run();
  }

  /**
   * Gets stored tokens for a user, decrypting them.
   *
   * @param userId - The user ID
   * @returns Decrypted tokens or null if not connected
   */
  async getStoredTokens(userId: string): Promise<StoredTokens | null> {
    const row = await this.env.DB.prepare(
      `SELECT access_token, refresh_token, token_expires_at FROM drive_connections WHERE user_id = ?`,
    )
      .bind(userId)
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
   * Gets valid tokens, refreshing if needed (5 min before expiry).
   * Per PRD Section 13: Automatic token refresh, 5 min before expiry.
   *
   * @param userId - The user ID
   * @returns Valid tokens, or null if not connected
   */
  async getValidTokens(userId: string): Promise<ValidTokens | null> {
    const stored = await this.getStoredTokens(userId);
    if (!stored) {
      return null;
    }

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
           WHERE user_id = ?`,
        )
          .bind(encryptedAccess, newExpiresAt.toISOString(), userId)
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
   * Creates a folder in Google Drive.
   * Per PRD Section 8 (US-006): Auto-creates folder named after project title.
   *
   * @param accessToken - Valid access token
   * @param folderName - Name for the folder
   * @returns The created folder metadata
   */
  async createFolder(accessToken: string, folderName: string): Promise<DriveFolderResponse> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Folder creation failed:", error);
      throw new Error("Failed to create Drive folder");
    }

    const folder = (await response.json()) as DriveFile;

    // Get the webViewLink by fetching with fields
    const detailResponse = await fetch(
      `${GOOGLE_DRIVE_API}/files/${folder.id}?fields=id,name,mimeType,webViewLink`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!detailResponse.ok) {
      // Return basic info if detail fetch fails
      return {
        id: folder.id,
        name: folder.name,
        mimeType: folder.mimeType,
        webViewLink: `https://drive.google.com/drive/folders/${folder.id}`,
      };
    }

    return detailResponse.json() as Promise<DriveFolderResponse>;
  }

  /**
   * Lists files in a folder.
   * Per PRD Section 8 (US-007): Read-only listing of DraftCrane-created files.
   *
   * @param accessToken - Valid access token
   * @param folderId - The folder ID to list
   * @returns Array of file metadata
   */
  async listFolderChildren(accessToken: string, folderId: string): Promise<DriveFile[]> {
    const params = new URLSearchParams({
      q: `'${validateDriveId(folderId)}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,webViewLink,createdTime,modifiedTime)",
      orderBy: "modifiedTime desc",
    });

    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("List folder failed:", error);
      throw new Error("Failed to list folder contents");
    }

    const data = (await response.json()) as { files: DriveFile[] };
    return data.files || [];
  }

  /**
   * Finds an existing subfolder by name within a parent folder, or creates it.
   * Per PRD Section 11: _exports/ subfolder in the Book Folder.
   *
   * @param accessToken - Valid access token
   * @param parentFolderId - The parent folder ID
   * @param folderName - Name for the subfolder (e.g. "_exports")
   * @returns The subfolder ID
   */
  async findOrCreateSubfolder(
    accessToken: string,
    parentFolderId: string,
    folderName: string,
  ): Promise<string> {
    // Search for existing subfolder
    const searchParams = new URLSearchParams({
      q: `'${validateDriveId(parentFolderId)}' in parents and name = '${escapeDriveQuery(folderName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name)",
    });

    const searchResponse = await fetch(`${GOOGLE_DRIVE_API}/files?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (searchResponse.ok) {
      const data = (await searchResponse.json()) as { files: DriveFile[] };
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create the subfolder
    const createResponse = await fetch(`${GOOGLE_DRIVE_API}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error("Subfolder creation failed:", error);
      throw new Error(`Failed to create ${folderName} subfolder in Drive`);
    }

    const folder = (await createResponse.json()) as DriveFile;
    return folder.id;
  }

  /**
   * Uploads a file to Google Drive using multipart upload.
   * Per PRD Section 8 (US-021): Upload export artifacts to _exports/ subfolder.
   *
   * @param accessToken - Valid access token
   * @param parentFolderId - The folder to upload into
   * @param fileName - Name for the file in Drive
   * @param mimeType - MIME type of the file content
   * @param data - The file content as ArrayBuffer
   * @returns The uploaded file metadata including webViewLink
   */
  async uploadFile(
    accessToken: string,
    parentFolderId: string,
    fileName: string,
    mimeType: string,
    data: ArrayBuffer,
  ): Promise<DriveFile> {
    // Use multipart upload for files with metadata
    const boundary = "---DraftCraneUploadBoundary";
    const metadata = JSON.stringify({
      name: fileName,
      parents: [parentFolderId],
    });

    // Build multipart body
    const encoder = new TextEncoder();
    const metadataPart = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    );
    const filePart = encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
    const fileData = new Uint8Array(data);
    const closingBoundary = encoder.encode(`\r\n--${boundary}--`);

    // Concatenate all parts
    const bodyLength =
      metadataPart.length + filePart.length + fileData.length + closingBoundary.length;
    const body = new Uint8Array(bodyLength);
    let offset = 0;
    body.set(metadataPart, offset);
    offset += metadataPart.length;
    body.set(filePart, offset);
    offset += filePart.length;
    body.set(fileData, offset);
    offset += fileData.length;
    body.set(closingBoundary, offset);

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body.buffer,
      },
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error("Drive file upload failed:", error);
      throw new Error("Failed to upload file to Google Drive");
    }

    return uploadResponse.json() as Promise<DriveFile>;
  }

  /**
   * Moves a file to Google Drive trash.
   * Per PRD US-014: When deleting a chapter, trash the Drive file (30-day retention by Google).
   *
   * @param accessToken - Valid access token
   * @param fileId - The Drive file ID to trash
   */
  async trashFile(accessToken: string, fileId: string): Promise<void> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Drive file trash failed:", error);
      throw new Error("Failed to trash Drive file");
    }
  }

  /**
   * Renames a file in Google Drive.
   * Per PRD US-013: When a chapter is renamed, the Drive file name should match.
   *
   * @param accessToken - Valid access token
   * @param fileId - The Drive file ID to rename
   * @param newName - The new file name
   */
  async renameFile(accessToken: string, fileId: string, newName: string): Promise<void> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Drive file rename failed:", error);
      throw new Error("Failed to rename Drive file");
    }
  }

  /**
   * Updates an existing file's content in Google Drive.
   * Used for Drive write-through: syncing chapter content from R2 to Drive.
   *
   * @param accessToken - Valid access token
   * @param fileId - The Drive file ID to update
   * @param mimeType - MIME type of the content
   * @param data - The file content as string or ArrayBuffer
   */
  async updateFile(
    accessToken: string,
    fileId: string,
    mimeType: string,
    data: string | ArrayBuffer,
  ): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType,
        },
        body: data,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Drive file update failed:", error);
      throw new Error("Failed to update file in Google Drive");
    }
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
   * Deletes the drive connection from D1.
   *
   * @param userId - The user ID
   */
  async deleteConnection(userId: string): Promise<void> {
    await this.env.DB.prepare(`DELETE FROM drive_connections WHERE user_id = ?`).bind(userId).run();
  }
}
