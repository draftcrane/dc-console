import { cors } from "hono/cors";
import type { Env } from "../types/index.js";

/**
 * CORS middleware configured per PRD: production frontend origin only, no wildcards.
 * Reads FRONTEND_URL from environment.
 *
 * Security: If FRONTEND_URL is not configured, all cross-origin requests are rejected
 * (empty origin returned). Never falls back to accepting any origin.
 */
export function corsMiddleware() {
  return cors({
    origin: (origin, c) => {
      const frontendUrl = (c.env as Env).FRONTEND_URL;
      if (!frontendUrl) {
        console.error("CORS: FRONTEND_URL not configured - rejecting cross-origin request");
        return "";
      }
      return origin === frontendUrl ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Chapter-Version"],
    exposeHeaders: ["X-Chapter-Version"],
    maxAge: 86400,
    credentials: true,
  });
}
