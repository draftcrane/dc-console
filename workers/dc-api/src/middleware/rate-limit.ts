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
 * Rate limiting middleware using Cloudflare KV with time-bucketed keys.
 *
 * Each window gets its own KV key based on the current time bucket. Old windows
 * expire naturally regardless of write frequency, eliminating the false-positive
 * 429s caused by the previous sliding-window approach (where PUT resets TTL).
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

    const windowBucket = Math.floor(Date.now() / (config.windowSeconds * 1000));
    const key = `ratelimit:${config.prefix}:${auth.userId}:${windowBucket}`;
    const current = await c.env.CACHE.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.maxRequests) {
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

    await c.env.CACHE.put(key, String(count + 1), {
      expirationTtl: config.windowSeconds * 2, // 2x for safety margin
    });

    const remaining = config.maxRequests - count - 1;
    await next();

    c.header("X-RateLimit-Remaining", String(remaining));
  };
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
