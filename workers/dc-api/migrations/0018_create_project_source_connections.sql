-- Project Source Connections: explicit junction table linking Drive connections
-- to projects for research input. This is the single source of truth for
-- "which sources does this project have access to?"
--
-- drive_connections are user-scoped; this table makes them project-scoped.

CREATE TABLE project_source_connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drive_connection_id TEXT NOT NULL REFERENCES drive_connections(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_psc_project_conn
  ON project_source_connections(project_id, drive_connection_id);
CREATE INDEX idx_psc_project
  ON project_source_connections(project_id);

-- Backfill: project's backup Drive connection → research source
INSERT INTO project_source_connections (id, project_id, drive_connection_id, created_at)
SELECT lower(hex(randomblob(16))), p.id, p.drive_connection_id, datetime('now')
FROM projects p
WHERE p.drive_connection_id IS NOT NULL AND p.status = 'active';

-- Backfill: connections used by existing source_materials
INSERT OR IGNORE INTO project_source_connections (id, project_id, drive_connection_id, created_at)
SELECT lower(hex(randomblob(16))), sm.project_id, sm.drive_connection_id, datetime('now')
FROM source_materials sm
WHERE sm.drive_connection_id IS NOT NULL AND sm.status = 'active'
GROUP BY sm.project_id, sm.drive_connection_id;
