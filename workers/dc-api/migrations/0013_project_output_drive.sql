-- Link projects to their output Drive connection.
-- Backfill: existing projects with drive_folder_id get their user's connection.

ALTER TABLE projects ADD COLUMN drive_connection_id TEXT REFERENCES drive_connections(id);

-- Backfill: pre-migration each user has exactly one connection, so this is unambiguous.
-- Without this, existing chapter-to-Drive write-through breaks silently.
UPDATE projects SET drive_connection_id = (
  SELECT dc.id FROM drive_connections dc
  WHERE dc.user_id = projects.user_id
  LIMIT 1
) WHERE drive_folder_id IS NOT NULL AND drive_connection_id IS NULL;
