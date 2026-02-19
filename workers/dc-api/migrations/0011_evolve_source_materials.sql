-- Evolve source_materials: polymorphic source support (drive + local).
-- Partial unique indexes for correct dedup per source type.

CREATE TABLE source_materials_v2 (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  source_type TEXT NOT NULL DEFAULT 'drive' CHECK (source_type IN ('drive', 'local')),
  drive_connection_id TEXT REFERENCES drive_connections(id),
  drive_file_id TEXT,
  title TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_filename TEXT,
  content_hash TEXT,
  drive_modified_time TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT,
  cached_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Migrate existing data (all existing sources are drive type)
INSERT INTO source_materials_v2 (id, project_id, source_type, drive_file_id,
  title, mime_type, drive_modified_time, word_count, r2_key, cached_at,
  status, sort_order, created_at, updated_at)
SELECT id, project_id, 'drive', drive_file_id,
  title, mime_type, drive_modified_time, word_count, r2_key, cached_at,
  status, sort_order, created_at, updated_at
FROM source_materials;

-- Keep deprecated table for rollback
ALTER TABLE source_materials RENAME TO source_materials_deprecated;
-- Drop old indexes (SQLite keeps index names when renaming tables)
DROP INDEX IF EXISTS idx_source_materials_project;
DROP INDEX IF EXISTS idx_source_materials_drive;
ALTER TABLE source_materials_v2 RENAME TO source_materials;

CREATE INDEX idx_source_materials_project ON source_materials(project_id);
-- Drive sources dedup on (project_id, drive_file_id)
CREATE UNIQUE INDEX idx_source_materials_drive
  ON source_materials(project_id, drive_file_id) WHERE drive_file_id IS NOT NULL;
-- Local sources dedup on (project_id, content_hash)
CREATE UNIQUE INDEX idx_source_materials_local
  ON source_materials(project_id, content_hash) WHERE source_type = 'local' AND content_hash IS NOT NULL;
CREATE INDEX idx_source_materials_conn ON source_materials(drive_connection_id);
