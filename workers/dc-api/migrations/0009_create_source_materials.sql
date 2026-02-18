-- Source materials: Google Docs connected as reference for a book project.
-- Users select files via Google Picker; content is cached in R2 as sanitized HTML.
CREATE TABLE IF NOT EXISTS source_materials (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  drive_file_id TEXT NOT NULL,
  title TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  drive_modified_time TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT,
  cached_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_source_materials_project ON source_materials(project_id);
CREATE UNIQUE INDEX idx_source_materials_drive ON source_materials(project_id, drive_file_id);
