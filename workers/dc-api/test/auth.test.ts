import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

/**
 * Auth middleware tests.
 *
 * These test the requireAuth middleware by sending requests to a protected
 * route (/projects) with various invalid authentication states.
 * The middleware should reject all of them with 401 AUTH_REQUIRED.
 */
describe("Auth middleware", () => {
  it("returns 401 AUTH_REQUIRED when no token is provided", async () => {
    const response = await SELF.fetch("http://localhost/projects");
    expect(response.status).toBe(401);

    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 when token is malformed (not a valid JWT)", async () => {
    const response = await SELF.fetch("http://localhost/projects", {
      headers: {
        Authorization: "Bearer not-a-valid-jwt",
      },
    });
    expect(response.status).toBe(401);

    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 when token is expired", async () => {
    // Build a JWT with an expired exp claim
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-kid" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const payload = btoa(
      JSON.stringify({
        sub: "user_test123",
        iss: "https://test.clerk.accounts.dev",
        exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const fakeSignature = "fakesignature";
    const token = `${header}.${payload}.${fakeSignature}`;

    const response = await SELF.fetch("http://localhost/projects", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(401);

    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 when token has wrong issuer", async () => {
    // Build a JWT with a valid exp but wrong issuer
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-kid" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const payload = btoa(
      JSON.stringify({
        sub: "user_test123",
        iss: "https://evil-issuer.example.com",
        exp: Math.floor(Date.now() / 1000) + 3600, // valid for 1 hour
        iat: Math.floor(Date.now() / 1000),
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const fakeSignature = "fakesignature";
    const token = `${header}.${payload}.${fakeSignature}`;

    const response = await SELF.fetch("http://localhost/projects", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(401);

    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("AUTH_REQUIRED");
  });
});
