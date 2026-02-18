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

/**
 * Remove all rows from test tables in reverse FK order.
 */
export async function cleanAll() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ai_interactions"),
    env.DB.prepare("DELETE FROM export_jobs"),
    env.DB.prepare("DELETE FROM source_materials"),
    env.DB.prepare("DELETE FROM chapters"),
    env.DB.prepare("DELETE FROM projects"),
    env.DB.prepare("DELETE FROM drive_connections"),
    env.DB.prepare("DELETE FROM users"),
  ]);
}
