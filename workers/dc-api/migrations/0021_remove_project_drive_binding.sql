-- Stop using project-level Drive binding.
-- D1 doesn't support DROP COLUMN, so NULL out the values.
UPDATE projects SET drive_folder_id = NULL, drive_connection_id = NULL;
UPDATE chapters SET drive_file_id = NULL;
