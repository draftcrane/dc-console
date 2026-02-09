/** Standard error response shape per PRD Section 12 */
export interface ApiError {
  error: string;
  code: ErrorCode;
}

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "DRIVE_ERROR"
  | "DRIVE_NOT_CONNECTED"
  | "VALIDATION_ERROR"
  | "LAST_CHAPTER"
  | "INTERNAL_ERROR";

/** Pagination query parameters */
export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

/** User profile response */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

/** Drive connection status */
export interface DriveStatus {
  connected: boolean;
  email?: string;
  expiresAt?: string;
}

/** Project summary in user profile */
export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  wordCount: number;
  chapterCount: number;
}

/** GET /users/me response */
export interface GetCurrentUserResponse {
  user: UserProfile;
  drive: DriveStatus;
  projects: ProjectSummary[];
  totalWordCount: number;
}
