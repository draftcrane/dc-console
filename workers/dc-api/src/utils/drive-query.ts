import { AppError } from "../middleware/error-handler.js";

/**
 * Validate a Google Drive file/folder ID.
 * Google Drive IDs are alphanumeric with hyphens and underscores, typically 20-60 chars.
 *
 * Throws a 400 VALIDATION_ERROR (AppError) for malformed IDs so that callers
 * in routes and services automatically surface a client-friendly 4xx response
 * instead of a generic 5xx.
 */
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateDriveId(id: string): string {
  if (!id || !DRIVE_ID_PATTERN.test(id)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid Google Drive ID format");
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
