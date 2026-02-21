import { env } from "cloudflare:test";
import { ulid } from "ulidx";

/**
 * Test seed helpers — insert minimal valid rows for service tests.
 *
 * Each helper returns the inserted record so tests can reference IDs.
 * Call `cleanAll()` in `beforeEach` to reset state between tests.
 */

const now = () => new Date().toISOString();

export async function seedUser(overrides?: { id?: string; email?: string }) {
  const id = overrides?.id ?? `user-${ulid()}`;
  const email = overrides?.email ?? `${id}@test.local`;
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, email, "Test User", ts, ts)
    .run();
  return { id, email };
}

export async function seedProject(
  userId: string,
  overrides?: { id?: string; title?: string; status?: string },
) {
  const id = overrides?.id ?? ulid();
  const title = overrides?.title ?? "Test Project";
  const status = overrides?.status ?? "active";
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO projects (id, user_id, title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?, ?)`,
  )
    .bind(id, userId, title, status, ts, ts)
    .run();
  return { id, title, userId };
}

export async function seedChapter(
  projectId: string,
  overrides?: {
    id?: string;
    title?: string;
    sortOrder?: number;
    wordCount?: number;
    version?: number;
    r2Key?: string;
  },
) {
  const id = overrides?.id ?? ulid();
  const title = overrides?.title ?? "Chapter 1";
  const sortOrder = overrides?.sortOrder ?? 1;
  const wordCount = overrides?.wordCount ?? 0;
  const version = overrides?.version ?? 1;
  const r2Key = overrides?.r2Key ?? null;
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO chapters (id, project_id, title, sort_order, r2_key, word_count, version, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
  )
    .bind(id, projectId, title, sortOrder, r2Key, wordCount, version, ts, ts)
    .run();
  return { id, projectId, title, sortOrder };
}

export async function seedSource(
  projectId: string,
  overrides?: {
    id?: string;
    driveFileId?: string;
    title?: string;
    mimeType?: string;
    sortOrder?: number;
    status?: string;
    cachedAt?: string;
    wordCount?: number;
    r2Key?: string;
  },
) {
  const id = overrides?.id ?? ulid();
  const driveFileId = overrides?.driveFileId ?? `drive-${ulid()}`;
  const title = overrides?.title ?? "Source Doc";
  const mimeType = overrides?.mimeType ?? "application/vnd.google-apps.document";
  const sortOrder = overrides?.sortOrder ?? 1;
  const status = overrides?.status ?? "active";
  const cachedAt = overrides?.cachedAt ?? null;
  const wordCount = overrides?.wordCount ?? 0;
  const r2Key = overrides?.r2Key ?? null;
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO source_materials (id, project_id, drive_file_id, title, mime_type, sort_order, status, cached_at, word_count, r2_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      driveFileId,
      title,
      mimeType,
      sortOrder,
      status,
      cachedAt,
      wordCount,
      r2Key,
      ts,
      ts,
    )
    .run();
  return { id, projectId, driveFileId, title };
}

export async function seedClip(
  projectId: string,
  overrides?: {
    id?: string;
    sourceId?: string | null;
    sourceTitle?: string;
    content?: string;
    sourceLocation?: string | null;
    chapterId?: string | null;
    createdAt?: string;
  },
) {
  const id = overrides?.id ?? crypto.randomUUID();
  const sourceTitle = overrides?.sourceTitle ?? "Test Source";
  const content = overrides?.content ?? "Test clip content";
  const sourceId = overrides?.sourceId !== undefined ? overrides.sourceId : null;
  const sourceLocation = overrides?.sourceLocation ?? null;
  const chapterId = overrides?.chapterId ?? null;
  const createdAt = overrides?.createdAt ?? now();
  await env.DB.prepare(
    `INSERT INTO research_clips (id, project_id, source_id, source_title, content, source_location, chapter_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, sourceId, sourceTitle, content, sourceLocation, chapterId, createdAt)
    .run();
  return { id, projectId, sourceId, sourceTitle, content };
}

export async function seedDriveConnection(
  userId: string,
  overrides?: {
    id?: string;
    email?: string;
    accessToken?: string;
    refreshToken?: string;
  },
) {
  const id = overrides?.id ?? `conn-${ulid()}`;
  const email = overrides?.email ?? `drive-${id}@gmail.com`;
  const accessToken = overrides?.accessToken ?? "fake-access-token";
  const refreshToken = overrides?.refreshToken ?? "fake-refresh-token";
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO drive_connections (id, user_id, drive_email, access_token, refresh_token, token_expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, email, accessToken, refreshToken, ts, ts, ts)
    .run();
  return { id, userId, email };
}

export async function seedLinkedFolder(
  projectId: string,
  driveConnectionId: string,
  overrides?: {
    id?: string;
    driveFolderId?: string;
    folderName?: string;
    documentCount?: number;
    lastSyncedAt?: string | null;
  },
) {
  const id = overrides?.id ?? ulid();
  const driveFolderId = overrides?.driveFolderId ?? `folder-${ulid()}`;
  const folderName = overrides?.folderName ?? "Test Folder";
  const documentCount = overrides?.documentCount ?? 0;
  const lastSyncedAt = overrides?.lastSyncedAt !== undefined ? overrides.lastSyncedAt : null;
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO project_linked_folders (id, project_id, drive_connection_id, drive_folder_id, folder_name, document_count, last_synced_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      driveConnectionId,
      driveFolderId,
      folderName,
      documentCount,
      lastSyncedAt,
      ts,
      ts,
    )
    .run();
  return { id, projectId, driveConnectionId, driveFolderId, folderName };
}

/**
 * Seed FTS content for a source.
 * Inserts a row into source_content_fts so search tests can find it.
 */
export async function seedSourceFts(sourceId: string, title: string, content: string) {
  await env.DB.prepare(
    `INSERT INTO source_content_fts (source_id, title, content)
     VALUES (?, ?, ?)`,
  )
    .bind(sourceId, title, content)
    .run();
}

/**
 * Seed a source with cached content in R2.
 * Unlike seedSource, this puts actual content in the R2 bucket.
 */
export async function seedSourceWithContent(
  projectId: string,
  content: string,
  overrides?: {
    id?: string;
    title?: string;
    mimeType?: string;
    sortOrder?: number;
  },
) {
  const id = overrides?.id ?? ulid();
  const title = overrides?.title ?? "Source Doc";
  const mimeType = overrides?.mimeType ?? "text/plain";
  const sortOrder = overrides?.sortOrder ?? 1;
  const ts = now();
  const r2Key = `sources/${id}/content.html`;

  // Write content to R2
  await env.EXPORTS_BUCKET.put(r2Key, content, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });

  // Insert source row with cached_at set
  await env.DB.prepare(
    `INSERT INTO source_materials (id, project_id, source_type, title, mime_type, sort_order, status, cached_at, word_count, r2_key, created_at, updated_at)
     VALUES (?, ?, 'local', ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      title,
      mimeType,
      sortOrder,
      ts,
      content.split(/\s+/).filter((w) => w.length > 0).length,
      r2Key,
      ts,
      ts,
    )
    .run();

  return { id, projectId, title, r2Key };
}

/**
 * Remove all rows from test tables in reverse FK order.
 */
export async function cleanAll() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM source_content_fts"),
    env.DB.prepare("DELETE FROM research_queries"),
    env.DB.prepare("DELETE FROM ai_interactions"),
    env.DB.prepare("DELETE FROM export_jobs"),
    env.DB.prepare("DELETE FROM research_clips"),
    env.DB.prepare("DELETE FROM project_linked_folders"),
    env.DB.prepare("DELETE FROM project_source_connections"),
    env.DB.prepare("DELETE FROM source_materials"),
    env.DB.prepare("DELETE FROM chapters"),
    env.DB.prepare("DELETE FROM projects"),
    env.DB.prepare("DELETE FROM drive_connections"),
    env.DB.prepare("DELETE FROM users"),
  ]);
}
