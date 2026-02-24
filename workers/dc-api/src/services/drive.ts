/**
 * Google Drive service facade -- composes DriveTokenService and DriveFileService.
 * Implements US-005 through US-008 from PRD Section 8.
 *
 * This module preserves the original DriveService public API so that route files
 * and other consumers do not need import changes. Internally, responsibilities
 * are delegated to focused sub-services:
 *
 *   - drive-token.ts -- OAuth flow, token storage/retrieval/refresh, connections
 *   - drive-files.ts -- Google Drive API calls for files and folders
 *
 * Re-exports all public types from sub-modules for backward compatibility.
 */

import type { Env } from "../types/index.js";
import { DriveTokenService } from "./drive-token.js";
import type { GoogleTokenResponse } from "./drive-token.js";
import { DriveFileService } from "./drive-files.js";

// Re-export public types so existing imports from "./drive.js" still work
export type { DriveFile } from "./drive-files.js";
export type { ValidTokens, DriveConnection, GoogleTokenResponse } from "./drive-token.js";
export { DriveTokenService } from "./drive-token.js";

/**
 * DriveService composes token management and file operations into a single
 * unified API. All route files instantiate `new DriveService(env)` and call
 * methods directly -- this facade delegates to the appropriate sub-service.
 */
export class DriveService {
  private readonly tokens: DriveTokenService;
  private readonly files: DriveFileService;

  constructor(private readonly env: Env) {
    this.tokens = new DriveTokenService(env);
    this.files = new DriveFileService();
  }

  /** Access the underlying token service for connection resolution. */
  get tokenService(): DriveTokenService {
    return this.tokens;
  }

  // ── OAuth & Token management (delegated to DriveTokenService) ──

  getAuthorizationUrl(state: string, loginHint?: string) {
    return this.tokens.getAuthorizationUrl(state, loginHint);
  }

  exchangeCodeForTokens(code: string) {
    return this.tokens.exchangeCodeForTokens(code);
  }

  getUserEmail(accessToken: string) {
    return this.tokens.getUserEmail(accessToken);
  }

  storeTokens(userId: string, connectionId: string, tokens: GoogleTokenResponse, email: string) {
    return this.tokens.storeTokens(userId, connectionId, tokens, email);
  }

  getStoredTokens(connectionId: string) {
    return this.tokens.getStoredTokens(connectionId);
  }

  getStoredTokensByUser(userId: string) {
    return this.tokens.getStoredTokensByUser(userId);
  }

  refreshAccessToken(refreshToken: string) {
    return this.tokens.refreshAccessToken(refreshToken);
  }

  getValidTokensByConnection(connectionId: string) {
    return this.tokens.getValidTokensByConnection(connectionId);
  }

  /**
   * @deprecated Use resolveProjectConnection() or resolveReadOnlyConnection() instead.
   * This method selects nondeterministically when users have multiple Drive connections.
   * Retained for backward compatibility but no production code should call it. See #166.
   */
  getValidTokens(userId: string) {
    return this.tokens.getValidTokens(userId);
  }

  getConnectionsForUser(userId: string) {
    return this.tokens.getConnectionsForUser(userId);
  }

  revokeToken(accessToken: string) {
    return this.tokens.revokeToken(accessToken);
  }

  deleteConnectionById(connectionId: string, userId: string) {
    return this.tokens.deleteConnectionById(connectionId, userId);
  }

  // ── File & folder operations (delegated to DriveFileService) ──

  createFolder(accessToken: string, folderName: string) {
    return this.files.createFolder(accessToken, folderName);
  }

  listFolderChildren(accessToken: string, folderId: string) {
    return this.files.listFolderChildren(accessToken, folderId);
  }

  listFolderChildrenPage(
    accessToken: string,
    folderId: string,
    options?: { pageSize?: number; pageToken?: string },
  ) {
    return this.files.listFolderChildrenPage(accessToken, folderId, options);
  }

  browseFolder(
    accessToken: string,
    folderId: string,
    options?: { pageSize?: number; pageToken?: string; foldersOnly?: boolean },
  ) {
    return this.files.browseFolder(accessToken, folderId, options);
  }

  listSupportedFilesInFoldersRecursive(
    accessToken: string,
    folderIds: string[],
    maxDocs: number,
    excludedFolderIds?: Set<string>,
  ) {
    return this.files.listSupportedFilesInFoldersRecursive(
      accessToken,
      folderIds,
      maxDocs,
      excludedFolderIds,
    );
  }

  findOrCreateRootFolder(accessToken: string, folderName: string) {
    return this.files.findOrCreateRootFolder(accessToken, folderName);
  }

  findOrCreateSubfolder(accessToken: string, parentFolderId: string, folderName: string) {
    return this.files.findOrCreateSubfolder(accessToken, parentFolderId, folderName);
  }

  uploadFile(
    accessToken: string,
    parentFolderId: string,
    fileName: string,
    mimeType: string,
    data: ArrayBuffer,
  ) {
    return this.files.uploadFile(accessToken, parentFolderId, fileName, mimeType, data);
  }

  trashFile(accessToken: string, fileId: string) {
    return this.files.trashFile(accessToken, fileId);
  }

  renameFile(accessToken: string, fileId: string, newName: string) {
    return this.files.renameFile(accessToken, fileId, newName);
  }

  updateFile(accessToken: string, fileId: string, mimeType: string, data: string | ArrayBuffer) {
    return this.files.updateFile(accessToken, fileId, mimeType, data);
  }

  getFileMetadata(accessToken: string, fileId: string) {
    return this.files.getFileMetadata(accessToken, fileId);
  }

  exportFile(accessToken: string, fileId: string, mimeType: string) {
    return this.files.exportFile(accessToken, fileId, mimeType);
  }

  downloadFile(accessToken: string, fileId: string) {
    return this.files.downloadFile(accessToken, fileId);
  }

  getFileContent(accessToken: string, fileId: string) {
    return this.files.getFileContent(accessToken, fileId);
  }
}
