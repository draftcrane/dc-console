/**
 * Drive file operations -- folder CRUD, file listing, upload, update, rename, trash, download, export.
 *
 * Split from drive.ts per Single Responsibility Principle.
 * All Google Drive API calls for file/folder manipulation live here.
 * Token management lives in drive-token.ts.
 *
 * Key responsibilities:
 * - Folder creation and subfolder find-or-create
 * - File listing (flat and recursive)
 * - File upload (multipart), update, rename, trash
 * - File metadata retrieval, export, download
 */

import { validateDriveId, escapeDriveQuery } from "../utils/drive-query.js";

/** Google Drive file metadata */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

/** Google Drive folder create response */
interface DriveFolderResponse {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

interface DriveListResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";
const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/**
 * DriveFileService handles all Google Drive file and folder operations.
 * Requires a valid access token for every call (obtained via DriveTokenService).
 */
export class DriveFileService {
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
    const result = await this.listFolderChildrenPage(accessToken, folderId);
    return result.files;
  }

  /**
   * Lists files in a folder with pagination support.
   */
  async listFolderChildrenPage(
    accessToken: string,
    folderId: string,
    options: { pageSize?: number; pageToken?: string } = {},
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const params = new URLSearchParams({
      q: `'${validateDriveId(folderId)}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,webViewLink,createdTime,modifiedTime)",
      orderBy: "modifiedTime desc",
    });
    if (options.pageSize) {
      params.set("pageSize", String(options.pageSize));
    }
    if (options.pageToken) {
      params.set("pageToken", options.pageToken);
    }

    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `List folder failed: Status ${response.status} ${response.statusText || ""}, Body: ${errorBody}`,
      );
      if (response.status === 403 && errorBody.includes("insufficientPermissions")) {
        throw new Error("Google Drive permission update required. Reconnect Drive.");
      }
      throw new Error(
        `Failed to list folder contents: ${response.status} ${response.statusText || ""}`,
      );
    }

    const data = (await response.json()) as { files: DriveFile[]; nextPageToken?: string };
    return { files: data.files || [], nextPageToken: data.nextPageToken };
  }

  /**
   * Lists files and folders for the file browser, filtering for supported types.
   */
  async browseFolder(
    accessToken: string,
    folderId: string,
    options: { pageSize?: number; pageToken?: string } = {},
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const supportedMimeTypes = [
      "application/vnd.google-apps.folder",
      "application/vnd.google-apps.document",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
      "text/plain",
      "text/markdown",
    ];

    const mimeTypeQuery = supportedMimeTypes.map((type) => `mimeType = '${type}'`).join(" or ");

    const query = `'${validateDriveId(folderId)}' in parents and trashed = false and (${mimeTypeQuery})`;

    const params = new URLSearchParams({
      q: query,
      fields: "files(id,name,mimeType,iconLink,webViewLink,createdTime,modifiedTime,size)",
      orderBy: "folder,name",
    });
    if (options.pageSize) {
      params.set("pageSize", String(options.pageSize));
    }
    if (options.pageToken) {
      params.set("pageToken", options.pageToken);
    }

    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Browse folder failed: Status ${response.status} ${response.statusText || ""}, Body: ${errorBody}`,
      );
      if (response.status === 403 && errorBody.includes("insufficientPermissions")) {
        throw new Error("Google Drive permission update required. Reconnect Drive.");
      }
      throw new Error(
        `Failed to browse folder contents: ${response.status} ${response.statusText || ""}`,
      );
    }

    const data = (await response.json()) as { files: DriveFile[]; nextPageToken?: string };
    return { files: data.files || [], nextPageToken: data.nextPageToken };
  }

  /**
   * Recursively lists Google Docs contained in one or more Drive folders.
   * Includes docs in nested subfolders. Stops at maxDocs to avoid expensive traversals.
   */
  async listDocsInFoldersRecursive(
    accessToken: string,
    folderIds: string[],
    maxDocs: number,
  ): Promise<DriveFile[]> {
    const pending = [...new Set(folderIds.map((id) => validateDriveId(id)))];
    const visitedFolders = new Set<string>();
    const seenDocs = new Set<string>();
    const docs: DriveFile[] = [];

    while (pending.length > 0) {
      const folderId = pending.shift();
      if (!folderId || visitedFolders.has(folderId)) {
        continue;
      }
      visitedFolders.add(folderId);

      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${folderId}' in parents and trashed = false and (mimeType = '${GOOGLE_DOC_MIME_TYPE}' or mimeType = '${GOOGLE_FOLDER_MIME_TYPE}')`,
          fields: "nextPageToken,files(id,name,mimeType)",
          pageSize: "1000",
        });
        if (pageToken) {
          params.set("pageToken", pageToken);
        }

        const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(
            `Recursive folder list failed: Status ${response.status} ${response.statusText || ""}, Body: ${errorBody}`,
          );
          throw new Error("Failed to list selected folder contents from Drive");
        }

        const data = (await response.json()) as DriveListResponse;
        const files = data.files || [];
        for (const file of files) {
          if (!file.id || !file.mimeType) continue;

          if (file.mimeType === GOOGLE_FOLDER_MIME_TYPE) {
            if (!visitedFolders.has(file.id)) {
              pending.push(file.id);
            }
            continue;
          }

          if (file.mimeType !== GOOGLE_DOC_MIME_TYPE || seenDocs.has(file.id)) {
            continue;
          }

          docs.push(file);
          seenDocs.add(file.id);

          if (docs.length > maxDocs) {
            throw new Error("MAX_DOCS_EXCEEDED");
          }
        }

        pageToken = data.nextPageToken;
      } while (pageToken);
    }

    return docs;
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
        body: body,
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
    validateDriveId(fileId);
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
    validateDriveId(fileId);
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
    validateDriveId(fileId);
    const body = typeof data === "string" ? new TextEncoder().encode(data) : data;

    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType,
        },
        body,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Drive file update failed:", error);
      throw new Error("Failed to update file in Google Drive");
    }
  }

  /**
   * Gets metadata for a file in Google Drive.
   *
   * @param accessToken - Valid access token
   * @param fileId - The Drive file ID
   * @returns File metadata (id, name, mimeType, size, modifiedTime)
   */
  async getFileMetadata(accessToken: string, fileId: string): Promise<DriveFile> {
    validateDriveId(fileId);
    const fields = "id,name,mimeType,size,modifiedTime";
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?fields=${fields}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Get file metadata failed:", error);
      throw new Error("Failed to get file metadata from Drive");
    }

    return response.json() as Promise<DriveFile>;
  }

  /**
   * Exports a Google Workspace file (Docs, Sheets, etc.) to a specified MIME type.
   * Used for importing Google Docs as HTML.
   *
   * @param accessToken - Valid access token
   * @param fileId - The Drive file ID (must be a Google Workspace file)
   * @param mimeType - Target export MIME type (e.g. "text/html")
   * @returns The exported content as a string
   * @throws Error if the exported file exceeds 5MB
   */
  async exportFile(accessToken: string, fileId: string, mimeType: string): Promise<string> {
    validateDriveId(fileId);
    const params = new URLSearchParams({ mimeType });
    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files/${fileId}/export?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("File export failed:", error);
      throw new Error("Failed to export file from Drive");
    }

    // Reject files larger than 5MB to prevent memory issues
    const contentLength = response.headers.get("Content-Length");
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      throw new Error("FILE_TOO_LARGE");
    }

    const text = await response.text();

    // Double-check after reading (Content-Length may not always be present)
    if (text.length > 5 * 1024 * 1024) {
      throw new Error("FILE_TOO_LARGE");
    }

    return text;
  }

  /**
   * Downloads a binary file from Google Drive.
   * Used for non-Workspace files (images, PDFs, etc.).
   *
   * @param accessToken - Valid access token
   * @param fileId - The Drive file ID
   * @returns The file content as an ArrayBuffer
   */
  async downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
    validateDriveId(fileId);
    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("File download failed:", error);
      throw new Error("Failed to download file from Drive");
    }

    return response.arrayBuffer();
  }

  /**
   * Gets the content of a file, parsing it based on MIME type.
   * Handles Google Docs, DOCX, PDF, and plain text.
   */
  async getFileContent(
    accessToken: string,
    fileId: string,
  ): Promise<{ content: string; format: "html" | "text" }> {
    validateDriveId(fileId);
    const meta = await this.getFileMetadata(accessToken, fileId);

    switch (meta.mimeType) {
      case GOOGLE_DOC_MIME_TYPE: {
        const content = await this.exportFile(accessToken, fileId, "text/html");
        return { content, format: "html" };
      }

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        const buffer = await this.downloadFile(accessToken, fileId);
        const mammoth = await import("mammoth");
        const result = await mammoth.default.convertToHtml({ arrayBuffer: buffer });
        return { content: result.value, format: "html" };
      }

      case "application/pdf": {
        const buffer = await this.downloadFile(accessToken, fileId);
        const { extractText, getDocumentProxy } = await import("unpdf");
        const doc = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(doc, { mergePages: true });
        return { content: text, format: "text" };
      }

      case "text/plain":
      case "text/markdown": {
        const buffer = await this.downloadFile(accessToken, fileId);
        const content = new TextDecoder().decode(buffer);
        return { content, format: "text" };
      }

      default:
        throw new Error(`Unsupported file type: ${meta.mimeType}`);
    }
  }
}
