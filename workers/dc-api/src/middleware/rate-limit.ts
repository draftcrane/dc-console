import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/index.js";
import { rateLimited } from "./error-handler.js";

interface RateLimitConfig {
  /** KV key prefix (e.g. "standard", "ai", "export") */
  prefix: string;
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * Rate limiting middleware using D1 atomic counters with time-bucketed keys.
 *
 * Each window gets its own counter row (`prefix:userId:bucket`), incremented with
 * an atomic UPSERT in SQLite. This avoids race conditions from KV read-then-write
 * under concurrent requests.
 *
 * A KV fallback is retained for rollout safety if the migration has not yet been
 * applied (no `rate_limit_counters` table).
 *
 * Phase 0 limits:
 * - Standard endpoints: 120 req/min
 * - AI endpoints: 10 req/min
 * - Export endpoints: 5 req/min
 *
 * Must be applied after requireAuth so userId is available.
 * Sets X-RateLimit-Remaining header on successful responses.
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!auth?.userId) {
      // If no auth context, skip rate limiting (auth middleware will reject)
      await next();
      return;
    }

    const nowMs = Date.now();
    const windowBucket = Math.floor(nowMs / (config.windowSeconds * 1000));
    const key = `ratelimit:${config.prefix}:${auth.userId}:${windowBucket}`;
    const count = await incrementRateLimitCounter(c, key, nowMs, config.windowSeconds);

    if (count > config.maxRequests) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "rate_limit_hit",
          user_id: auth.userId,
          prefix: config.prefix,
          limit: config.maxRequests,
          method: c.req.method,
          path: c.req.path,
        }),
      );
      rateLimited(`Rate limit exceeded. Please wait before making more requests.`);
    }

    const remaining = Math.max(0, config.maxRequests - count);
    await next();

    c.header("X-RateLimit-Remaining", String(remaining));
  };
}

async function incrementRateLimitCounter(
  c: Parameters<MiddlewareHandler<{ Bindings: Env }>>[0],
  key: string,
  nowMs: number,
  windowSeconds: number,
): Promise<number> {
  const expiresAtMs = nowMs + windowSeconds * 2 * 1000;

  try {
    const row = await c.env.DB.prepare(
      `INSERT INTO rate_limit_counters (counter_key, request_count, expires_at_ms)
       VALUES (?, 1, ?)
       ON CONFLICT(counter_key) DO UPDATE SET request_count = request_count + 1
       RETURNING request_count`,
    )
      .bind(key, expiresAtMs)
      .first<{ request_count: number }>();

    const count = row?.request_count ?? 1;

    // Opportunistic cleanup to keep the table bounded.
    if (count === 1) {
      c.env.DB.prepare(`DELETE FROM rate_limit_counters WHERE expires_at_ms < ?`)
        .bind(nowMs)
        .run()
        .catch(() => {
          // Cleanup is best-effort and must not block request handling.
        });
    }

    return count;
  } catch (err) {
    if (!isMissingRateLimitTableError(err)) {
      throw err;
    }

    // Rollout safety: fallback to KV until migration is applied.
    const raw = await c.env.CACHE.get(key);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    const previousCount = Number.isNaN(parsed) ? 0 : parsed;
    const nextCount = previousCount + 1;
    await c.env.CACHE.put(key, String(nextCount), {
      expirationTtl: windowSeconds * 2,
    });
    return nextCount;
  }
}

function isMissingRateLimitTableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("no such table: rate_limit_counters");
}

/** Standard rate limit: 120 req/min (bumped from 60 for Phase 0 auto-save cadence) */
export const standardRateLimit = rateLimit({
  prefix: "standard",
  maxRequests: 120,
  windowSeconds: 60,
});

/** AI rate limit: 10 req/min */
export const aiRateLimit = rateLimit({
  prefix: "ai-rewrite",
  maxRequests: 10,
  windowSeconds: 60,
});

/** Export rate limit: 5 req/min */
export const exportRateLimit = rateLimit({
  prefix: "export",
  maxRequests: 5,
  windowSeconds: 60,
});
