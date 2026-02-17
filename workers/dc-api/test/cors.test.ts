import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

/**
 * CORS middleware tests.
 *
 * The CORS middleware reads FRONTEND_URL from wrangler.toml [vars] and only
 * allows that specific origin. All other origins are rejected (empty
 * Access-Control-Allow-Origin). Uses /health endpoint since it requires no auth.
 */
describe("CORS middleware", () => {
  // FRONTEND_URL is set to "https://draftcrane.app" in wrangler.toml [vars]
  const ALLOWED_ORIGIN = "https://draftcrane.app";

  it("returns proper CORS headers for allowed origin", async () => {
    const response = await SELF.fetch("http://localhost/health", {
      headers: {
        Origin: ALLOWED_ORIGIN,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not return Access-Control-Allow-Origin for blocked origin", async () => {
    const response = await SELF.fetch("http://localhost/health", {
      headers: {
        Origin: "https://evil-site.example.com",
      },
    });

    expect(response.status).toBe(200);
    // Blocked origins should not get an allow-origin header
    const allowOrigin = response.headers.get("Access-Control-Allow-Origin");
    expect(!allowOrigin || allowOrigin === "").toBe(true);
  });

  it("responds correctly to preflight OPTIONS request", async () => {
    const response = await SELF.fetch("http://localhost/health", {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });

    // Preflight should return 204 (no content)
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});
