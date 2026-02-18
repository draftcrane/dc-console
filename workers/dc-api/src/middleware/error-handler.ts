import type { ErrorCode } from "../types/index.js";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Helper to throw typed API errors */
export function notFound(message = "Resource not found"): never {
  throw new AppError(404, "NOT_FOUND", message);
}

export function forbidden(message = "Access denied"): never {
  throw new AppError(403, "FORBIDDEN", message);
}

export function conflict(message = "Version conflict"): never {
  throw new AppError(409, "CONFLICT", message);
}

export function validationError(message: string): never {
  throw new AppError(400, "VALIDATION_ERROR", message);
}

export function rateLimited(message = "Rate limit exceeded"): never {
  throw new AppError(429, "RATE_LIMITED", message);
}

export function authRequired(message = "Authentication required"): never {
  throw new AppError(401, "AUTH_REQUIRED", message);
}
