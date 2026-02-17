import type { MiddlewareHandler } from "hono";
import { ulid } from "ulidx";
import type { Env } from "../types/index.js";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Request logging middleware.
 *
 * Generates a ULID request ID per request and logs structured JSON on completion:
 * {request_id, user_id, method, path, status, duration_ms}
 *
 * The request ID is also set on the response as X-Request-ID for correlation.
 * Stored in Hono context as `requestId` for use by error handler and other middleware.
 */
export const requestLogger: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const requestId = ulid();
  const start = Date.now();

  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  await next();

  const duration = Date.now() - start;
  const auth = c.get("auth");
  const status = c.res.status;

  console.log(
    JSON.stringify({
      request_id: requestId,
      user_id: auth?.userId ?? null,
      method: c.req.method,
      path: c.req.path,
      status,
      duration_ms: duration,
    }),
  );

  // Log non-2xx responses to KV for post-session review (7-day TTL)
  if (status >= 400) {
    const errorKey = `error:${Date.now()}:${requestId}`;
    c.env.CACHE.put(
      errorKey,
      JSON.stringify({
        request_id: requestId,
        user_id: auth?.userId ?? null,
        method: c.req.method,
        path: c.req.path,
        status,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      { expirationTtl: 604800 }, // 7 days
    ).catch(() => {
      // KV write failure is non-blocking
    });
  }
};
