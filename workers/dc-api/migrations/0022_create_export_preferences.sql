-- Export preferences: remembered destination defaults per project per user.
-- Supports "This Device" (browser download) and "Google Drive" (specific folder).

CREATE TABLE export_preferences (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('device', 'drive')),
  -- Drive-specific fields (null when destination_type = 'device')
  drive_connection_id TEXT REFERENCES drive_connections(id) ON DELETE SET NULL,
  drive_folder_id TEXT,
  drive_folder_path TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX idx_export_pref_project_user
  ON export_preferences(project_id, user_id);
