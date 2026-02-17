import { Hono } from "hono";
import type { Env } from "./types/index.js";
import { AppError, corsMiddleware } from "./middleware/index.js";
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
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode as 400);
  }

  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error", code: "INTERNAL_ERROR" as ErrorCode }, 500);
});

// Global middleware
app.use("*", corsMiddleware());

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
