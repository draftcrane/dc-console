-- Multi-account Drive connections: multiple Google accounts per user.
-- Preserves old table as _deprecated for 7-day rollback window.

CREATE TABLE drive_connections_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TEXT NOT NULL,
  drive_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Migrate existing data with explicit column names (encrypted token safety)
INSERT INTO drive_connections_v2 (id, user_id, access_token, refresh_token,
  token_expires_at, drive_email, created_at, updated_at)
SELECT id, user_id, access_token, refresh_token, token_expires_at,
  COALESCE(drive_email, 'unknown@migrated'), created_at, updated_at
FROM drive_connections;

-- Keep deprecated table for rollback (manual cleanup after 7 days)
ALTER TABLE drive_connections RENAME TO drive_connections_deprecated;
-- Drop old indexes (SQLite keeps index names when renaming tables)
DROP INDEX IF EXISTS idx_drive_connections_user_id;
ALTER TABLE drive_connections_v2 RENAME TO drive_connections;

-- Unique per user+email (re-auth same account updates, not duplicates)
CREATE UNIQUE INDEX idx_drive_conn_user_email ON drive_connections(user_id, drive_email);
CREATE INDEX idx_drive_conn_user ON drive_connections(user_id);
