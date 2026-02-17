/**
 * Validate a Google Drive file/folder ID.
 * Google Drive IDs are alphanumeric with hyphens and underscores, typically 20-60 chars.
 */
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateDriveId(id: string): string {
  if (!DRIVE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid Google Drive ID: ${id}`);
  }
  return id;
}

/**
 * Escape a value for use in Google Drive API query strings.
 * Single quotes are the delimiter in Drive queries, so they must be escaped.
 */
export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
