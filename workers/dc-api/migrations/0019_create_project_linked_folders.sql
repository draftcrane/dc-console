-- Linked folders: persistent folder-level bindings for automatic source sync.
-- When a folder is linked, all Google Docs inside it are added as source materials.
-- New docs are synced automatically when the folder is re-synced.

CREATE TABLE project_linked_folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drive_connection_id TEXT NOT NULL REFERENCES drive_connections(id) ON DELETE CASCADE,
  drive_folder_id TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  document_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Prevent double-linking the same folder to the same project
CREATE UNIQUE INDEX idx_plf_project_folder
  ON project_linked_folders(project_id, drive_folder_id);

CREATE INDEX idx_plf_project
  ON project_linked_folders(project_id);

CREATE INDEX idx_plf_connection
  ON project_linked_folders(drive_connection_id);
