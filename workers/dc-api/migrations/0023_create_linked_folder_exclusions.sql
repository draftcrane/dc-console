-- Exclusions for linked folders: items explicitly deselected within a linked folder.
-- Uses an exclusion model: everything inside a selected folder is included by default;
-- exclusions are the exceptions.
CREATE TABLE linked_folder_exclusions (
  id TEXT PRIMARY KEY,
  linked_folder_id TEXT NOT NULL REFERENCES project_linked_folders(id) ON DELETE CASCADE,
  drive_item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('folder', 'document')),
  item_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX idx_lfe_folder_item ON linked_folder_exclusions(linked_folder_id, drive_item_id);
CREATE INDEX idx_lfe_linked_folder ON linked_folder_exclusions(linked_folder_id);
