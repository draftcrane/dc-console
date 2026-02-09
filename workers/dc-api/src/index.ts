import { Hono } from "hono";
import type { Env } from "./types/index.js";
import { errorHandler, corsMiddleware } from "./middleware/index.js";
import { health } from "./routes/health.js";
import { auth } from "./routes/auth.js";
import { users } from "./routes/users.js";
import { drive } from "./routes/drive.js";
import { projects } from "./routes/projects.js";
import { chapters } from "./routes/chapters.js";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", errorHandler);
app.use("*", corsMiddleware());

// Route mounting
app.route("/health", health);
app.route("/auth", auth);
app.route("/users", users);
app.route("/drive", drive);
app.route("/projects", projects);
app.route("/", chapters);

// 404 fallback
app.notFound((c) => {
  return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
});

export default app;
