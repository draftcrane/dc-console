import { Hono } from "hono";
import type { Env } from "./types/index.js";
import { AppError, corsMiddleware } from "./middleware/index.js";
import { requestLogger } from "./middleware/request-logger.js";
import { health } from "./routes/health.js";
import { auth } from "./routes/auth.js";
import { users } from "./routes/users.js";
import { drive } from "./routes/drive.js";
import { projects } from "./routes/projects.js";
import { chapters } from "./routes/chapters.js";
import { ai } from "./routes/ai.js";
import { exportRoutes } from "./routes/export.js";
import type { ErrorCode } from "./types/index.js";

const app = new Hono<{ Bindings: Env }>();

// Global error handler (Hono's onError is invoked by the internal compose
// function and reliably catches errors thrown in sub-route middleware,
// unlike a middleware-based try/catch which can be bypassed by compose).
app.onError((err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  const auth = c.get("auth");

  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code, requestId }, err.statusCode as 400);
  }

  console.error(
    JSON.stringify({
      level: "error",
      request_id: requestId,
      user_id: auth?.userId ?? null,
      method: c.req.method,
      path: c.req.path,
      error: err.message,
      stack: err.stack,
    }),
  );

  // Write unhandled errors to KV for post-session review (7-day TTL)
  c.env.CACHE.put(
    `error:${Date.now()}:${requestId}`,
    JSON.stringify({
      request_id: requestId,
      user_id: auth?.userId ?? null,
      method: c.req.method,
      path: c.req.path,
      status: 500,
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    }),
    { expirationTtl: 604800 },
  ).catch(() => {
    // KV write failure is non-blocking
  });

  return c.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" as ErrorCode, requestId },
    500,
  );
});

// Global middleware
app.use("*", corsMiddleware());
app.use("*", requestLogger);

// Route mounting
app.route("/health", health);
app.route("/auth", auth);
app.route("/users", users);
app.route("/drive", drive);
app.route("/projects", projects);
app.route("/ai", ai);
app.route("/", exportRoutes);
app.route("/", chapters);

// 404 fallback
app.notFound((c) => {
  return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
});

export default app;
