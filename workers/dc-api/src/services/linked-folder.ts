/**
 * Linked folder service -- persistent folder-level bindings for automatic source sync.
 *
 * When a user links a Drive folder to a project, all Google Docs inside it are
 * added as source materials. Re-syncing discovers new docs added since the last sync.
 *
 * Sync is append-only: new docs from Drive are added, but docs removed from Drive
 * are NOT archived. Users can manually remove individual documents.
 */

import { ulid } from "ulidx";
import { notFound, validationError } from "../middleware/error-handler.js";
import type { DriveService } from "./drive.js";
import { resolveReadOnlyConnection } from "./drive-connection-resolver.js";

const MAX_DOCS_PER_FOLDER = 200;

// ── Types ──

export interface LinkedFolder {
  id: string;
  projectId: string;
  driveConnectionId: string;
  driveFolderId: string;
  folderName: string;
  email: string;
  documentCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface LinkedFolderRow {
  id: string;
  project_id: string;
  drive_connection_id: string;
  drive_folder_id: string;
  folder_name: string;
  document_count: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LinkedFolderWithEmail extends LinkedFolderRow {
  drive_email: string;
}

export interface SyncResult {
  newDocs: number;
  totalDocs: number;
}

export interface LinkFolderInput {
  driveConnectionId: string;
  driveFolderId: string;
  folderName: string;
  exclusions?: ExclusionInput[];
}

export interface ExclusionInput {
  driveItemId: string;
  itemType: "folder" | "document";
  itemName: string;
}

export interface Exclusion {
  id: string;
  linkedFolderId: string;
  driveItemId: string;
  itemType: "folder" | "document";
  itemName: string;
  createdAt: string;
}

interface ExclusionRow {
  id: string;
  linked_folder_id: string;
  drive_item_id: string;
  item_type: "folder" | "document";
  item_name: string;
  created_at: string;
}

// ── Service ──

export class LinkedFolderService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
  ) {}

  /**
   * Link a Drive folder to a project.
   * Verifies project ownership and connection ownership.
   * Auto-ensures project_source_connections row exists.
   * Performs immediate sync on link.
   */
  async linkFolder(
    userId: string,
    projectId: string,
    input: LinkFolderInput,
    driveService: DriveService,
  ): Promise<{ folder: LinkedFolder; sync: SyncResult }> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Verify connection belongs to user
    const connection = await this.db
      .prepare(`SELECT id, drive_email FROM drive_connections WHERE id = ? AND user_id = ?`)
      .bind(input.driveConnectionId, userId)
      .first<{ id: string; drive_email: string }>();

    if (!connection) {
      notFound("Drive connection not found");
    }

    const id = ulid();
    const now = new Date().toISOString();

    // INSERT OR IGNORE prevents double-linking
    const insertResult = await this.db
      .prepare(
        `INSERT OR IGNORE INTO project_linked_folders
         (id, project_id, drive_connection_id, drive_folder_id, folder_name, document_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .bind(id, projectId, input.driveConnectionId, input.driveFolderId, input.folderName, now, now)
      .run();

    // If OR IGNORE hit (duplicate), fetch the existing row
    const row = await this.db
      .prepare(
        `SELECT plf.*, dc.drive_email
         FROM project_linked_folders plf
         JOIN drive_connections dc ON dc.id = plf.drive_connection_id
         WHERE plf.project_id = ? AND plf.drive_folder_id = ?`,
      )
      .bind(projectId, input.driveFolderId)
      .first<LinkedFolderWithEmail>();

    if (!row) {
      throw new Error("Failed to create or retrieve linked folder");
    }

    // Insert exclusion rows if provided
    if (input.exclusions && input.exclusions.length > 0) {
      for (const excl of input.exclusions) {
        await this.db
          .prepare(
            `INSERT OR IGNORE INTO linked_folder_exclusions
             (id, linked_folder_id, drive_item_id, item_type, item_name, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(ulid(), row.id, excl.driveItemId, excl.itemType, excl.itemName, now)
          .run();
      }
    }

    // Auto-ensure project_source_connections row exists (same pattern as SourceDriveService)
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO project_source_connections (id, project_id, drive_connection_id, created_at)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?)`,
      )
      .bind(projectId, input.driveConnectionId, now)
      .run();

    // Perform immediate sync
    const sync = await this._syncFolder(userId, row.id, row, driveService);

    const folder = this._rowToFolder(row);
    // Update with sync results
    folder.documentCount = sync.totalDocs;
    folder.lastSyncedAt = new Date().toISOString();

    return { folder, sync };
  }

  /**
   * Unlink a folder from a project.
   * Documents remain — unlinking only removes the auto-sync binding.
   */
  async unlinkFolder(userId: string, projectId: string, linkedFolderId: string): Promise<void> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Verify the linked folder belongs to this project
    const folder = await this.db
      .prepare(`SELECT id FROM project_linked_folders WHERE id = ? AND project_id = ?`)
      .bind(linkedFolderId, projectId)
      .first<{ id: string }>();

    if (!folder) {
      notFound("Linked folder not found");
    }

    await this.db
      .prepare(`DELETE FROM project_linked_folders WHERE id = ?`)
      .bind(linkedFolderId)
      .run();
  }

  /**
   * List linked folders for a project with email from drive_connections.
   */
  async listLinkedFolders(userId: string, projectId: string): Promise<LinkedFolder[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const result = await this.db
      .prepare(
        `SELECT plf.*, dc.drive_email
         FROM project_linked_folders plf
         JOIN drive_connections dc ON dc.id = plf.drive_connection_id
         WHERE plf.project_id = ? AND dc.user_id = ?
         ORDER BY plf.created_at ASC`,
      )
      .bind(projectId, userId)
      .all<LinkedFolderWithEmail>();

    return (result.results ?? []).map((row) => this._rowToFolder(row));
  }

  /**
   * Sync a single linked folder — discover new docs in Drive, add as source materials.
   */
  async syncFolder(
    userId: string,
    projectId: string,
    linkedFolderId: string,
    driveService: DriveService,
  ): Promise<SyncResult> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const row = await this.db
      .prepare(
        `SELECT plf.*, dc.drive_email
         FROM project_linked_folders plf
         JOIN drive_connections dc ON dc.id = plf.drive_connection_id
         WHERE plf.id = ? AND plf.project_id = ?`,
      )
      .bind(linkedFolderId, projectId)
      .first<LinkedFolderWithEmail>();

    if (!row) {
      notFound("Linked folder not found");
    }

    return this._syncFolder(userId, linkedFolderId, row, driveService);
  }

  /**
   * Sync all stale folders for a project.
   * A folder is "stale" if last_synced_at is null or older than staleMinutes.
   */
  async syncAllStale(
    userId: string,
    projectId: string,
    driveService: DriveService,
    staleMinutes = 5,
  ): Promise<{ syncedFolders: number; newDocs: number }> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

    const staleFolders = await this.db
      .prepare(
        `SELECT plf.*, dc.drive_email
         FROM project_linked_folders plf
         JOIN drive_connections dc ON dc.id = plf.drive_connection_id
         WHERE plf.project_id = ? AND dc.user_id = ?
           AND (plf.last_synced_at IS NULL OR plf.last_synced_at < ?)`,
      )
      .bind(projectId, userId, cutoff)
      .all<LinkedFolderWithEmail>();

    let syncedFolders = 0;
    let totalNewDocs = 0;

    for (const row of staleFolders.results ?? []) {
      try {
        const result = await this._syncFolder(userId, row.id, row, driveService);
        syncedFolders++;
        totalNewDocs += result.newDocs;
      } catch (err) {
        // Log but continue syncing other folders
        console.error(
          JSON.stringify({
            level: "error",
            event: "linked_folder_sync_error",
            folder_id: row.id,
            drive_folder_id: row.drive_folder_id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }

    return { syncedFolders, newDocs: totalNewDocs };
  }

  // ── Exclusion management ──

  /**
   * List exclusions for a linked folder. Enforces project ownership.
   */
  async listExclusions(
    userId: string,
    projectId: string,
    linkedFolderId: string,
  ): Promise<Exclusion[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Verify linked folder belongs to project
    const folder = await this.db
      .prepare(`SELECT id FROM project_linked_folders WHERE id = ? AND project_id = ?`)
      .bind(linkedFolderId, projectId)
      .first<{ id: string }>();

    if (!folder) {
      notFound("Linked folder not found");
    }

    const result = await this.db
      .prepare(
        `SELECT * FROM linked_folder_exclusions WHERE linked_folder_id = ? ORDER BY created_at ASC`,
      )
      .bind(linkedFolderId)
      .all<ExclusionRow>();

    return (result.results ?? []).map((row) => this._rowToExclusion(row));
  }

  /**
   * Replace all exclusions for a linked folder (PUT semantics).
   * Deletes existing exclusions, then inserts the new set.
   */
  async setExclusions(
    userId: string,
    projectId: string,
    linkedFolderId: string,
    exclusions: ExclusionInput[],
  ): Promise<Exclusion[]> {
    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Verify linked folder belongs to project
    const folder = await this.db
      .prepare(`SELECT id FROM project_linked_folders WHERE id = ? AND project_id = ?`)
      .bind(linkedFolderId, projectId)
      .first<{ id: string }>();

    if (!folder) {
      notFound("Linked folder not found");
    }

    const now = new Date().toISOString();

    // Delete all existing exclusions
    await this.db
      .prepare(`DELETE FROM linked_folder_exclusions WHERE linked_folder_id = ?`)
      .bind(linkedFolderId)
      .run();

    // Insert new exclusions
    const rows: Exclusion[] = [];
    for (const excl of exclusions) {
      const id = ulid();
      await this.db
        .prepare(
          `INSERT INTO linked_folder_exclusions
           (id, linked_folder_id, drive_item_id, item_type, item_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, linkedFolderId, excl.driveItemId, excl.itemType, excl.itemName, now)
        .run();
      rows.push({
        id,
        linkedFolderId,
        driveItemId: excl.driveItemId,
        itemType: excl.itemType,
        itemName: excl.itemName,
        createdAt: now,
      });
    }

    return rows;
  }

  // ── Private helpers ──

  /**
   * Internal sync logic. Lists docs in the folder via Drive API, deduplicates
   * against existing source_materials, inserts new ones.
   */
  private async _syncFolder(
    userId: string,
    linkedFolderId: string,
    row: LinkedFolderWithEmail | LinkedFolderRow,
    driveService: DriveService,
  ): Promise<SyncResult> {
    // Resolve connection tokens
    const { tokens } = await resolveReadOnlyConnection(
      driveService.tokenService,
      userId,
      row.drive_connection_id,
    );

    // Load exclusions for this linked folder
    const exclusionRows = await this.db
      .prepare(`SELECT * FROM linked_folder_exclusions WHERE linked_folder_id = ?`)
      .bind(linkedFolderId)
      .all<ExclusionRow>();

    const excludedFolderIds = new Set<string>();
    const excludedDocIds = new Set<string>();
    for (const excl of exclusionRows.results ?? []) {
      if (excl.item_type === "folder") {
        excludedFolderIds.add(excl.drive_item_id);
      } else {
        excludedDocIds.add(excl.drive_item_id);
      }
    }

    // List all supported files in the folder (recursive), skipping excluded folders
    let docs: Array<{ id: string; name: string; mimeType: string }>;
    try {
      docs = await driveService.listSupportedFilesInFoldersRecursive(
        tokens.accessToken,
        [row.drive_folder_id],
        MAX_DOCS_PER_FOLDER,
        excludedFolderIds.size > 0 ? excludedFolderIds : undefined,
      );
    } catch (err) {
      if (err instanceof Error && err.message === "MAX_DOCS_EXCEEDED") {
        // Truncate to max — don't fail the whole sync
        docs = [];
      } else {
        throw err;
      }
    }

    // Filter out individually excluded documents
    if (excludedDocIds.size > 0) {
      docs = docs.filter((doc) => !excludedDocIds.has(doc.id));
    }

    // Get existing source drive_file_ids for this project to deduplicate
    const existingSources = await this.db
      .prepare(
        `SELECT drive_file_id FROM source_materials
         WHERE project_id = ? AND drive_file_id IS NOT NULL AND status != 'archived'`,
      )
      .bind(row.project_id)
      .all<{ drive_file_id: string }>();

    const existingIds = new Set((existingSources.results ?? []).map((r) => r.drive_file_id));

    // Get current max sort_order
    const maxSort = await this.db
      .prepare(
        `SELECT MAX(sort_order) as max_sort FROM source_materials
         WHERE project_id = ? AND status = 'active'`,
      )
      .bind(row.project_id)
      .first<{ max_sort: number | null }>();

    let sortOrder = (maxSort?.max_sort || 0) + 1;
    const now = new Date().toISOString();
    let newDocs = 0;

    for (const doc of docs) {
      if (existingIds.has(doc.id)) continue;

      const sourceId = ulid();
      await this.db
        .prepare(
          `INSERT INTO source_materials
           (id, project_id, source_type, drive_connection_id, drive_file_id, title, mime_type, sort_order, created_at, updated_at)
           VALUES (?, ?, 'drive', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          sourceId,
          row.project_id,
          row.drive_connection_id,
          doc.id,
          doc.name || "Untitled",
          doc.mimeType,
          sortOrder,
          now,
          now,
        )
        .run();

      existingIds.add(doc.id); // Prevent dupes within this batch
      sortOrder++;
      newDocs++;
    }

    // Count total active docs from this folder's connection for this project
    const totalResult = await this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM source_materials
         WHERE project_id = ? AND drive_connection_id = ? AND status != 'archived'`,
      )
      .bind(row.project_id, row.drive_connection_id)
      .first<{ cnt: number }>();

    const totalDocs = totalResult?.cnt ?? 0;

    // Update folder metadata
    await this.db
      .prepare(
        `UPDATE project_linked_folders
         SET document_count = ?, last_synced_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(totalDocs, now, now, linkedFolderId)
      .run();

    return { newDocs, totalDocs };
  }

  private _rowToExclusion(row: ExclusionRow): Exclusion {
    return {
      id: row.id,
      linkedFolderId: row.linked_folder_id,
      driveItemId: row.drive_item_id,
      itemType: row.item_type,
      itemName: row.item_name,
      createdAt: row.created_at,
    };
  }

  private _rowToFolder(row: LinkedFolderWithEmail): LinkedFolder {
    return {
      id: row.id,
      projectId: row.project_id,
      driveConnectionId: row.drive_connection_id,
      driveFolderId: row.drive_folder_id,
      folderName: row.folder_name,
      email: row.drive_email,
      documentCount: row.document_count,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
    };
  }
}
