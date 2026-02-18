import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/index.js";
import { authRequired } from "./error-handler.js";

/** Clerk JWT payload structure */
export interface ClerkJWTPayload {
  sub: string; // User ID
  email?: string;
  name?: string;
  iat: number;
  exp: number;
  nbf?: number;
  iss: string;
  azp?: string;
}

/** Auth context added to Hono context */
export interface AuthContext {
  userId: string;
  email?: string;
  name?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/** JWKS cache TTL in seconds */
const JWKS_CACHE_TTL_SECONDS = 600; // 10 minutes
const JWKS_CACHE_KEY = "jwks:clerk";

interface JWK {
  kid: string;
  kty: string;
  n: string;
  e: string;
  use: string;
}

interface JWKS {
  keys: JWK[];
}

/**
 * Middleware that validates Clerk JWT tokens.
 * Extracts user info from the Authorization header and adds it to context.
 *
 * Per PRD Section 8: Session via Clerk JWT (httpOnly, Secure, SameSite=Lax cookie)
 * Also supports Bearer token in Authorization header for API clients.
 */
export const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const cookieToken = c.req.header("Cookie")?.match(/__session=([^;]+)/)?.[1];

  const token = (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined) ?? cookieToken;

  if (!token) {
    authRequired("No authentication token provided");
  }

  try {
    const payload = await verifyClerkToken(token, c.env);

    c.set("auth", {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
    });

    await next();
  } catch (err) {
    console.error("Auth verification failed:", err);
    authRequired("Invalid or expired token");
  }
};

/**
 * Verifies a Clerk JWT token against the trusted CLERK_ISSUER_URL.
 *
 * Security:
 * - Issuer is exact-matched against env.CLERK_ISSUER_URL (not from the token)
 * - JWKS URL is derived from the trusted env var, not from the untrusted token payload
 * - JWKS is cached in KV with a 10-minute TTL to avoid per-request fetches
 */
async function verifyClerkToken(token: string, env: Env): Promise<ClerkJWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64] = parts;

  // Decode payload
  const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
  const payload = JSON.parse(payloadJson) as ClerkJWTPayload;

  // Verify expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }

  // Verify not before
  if (payload.nbf && payload.nbf > now) {
    throw new Error("Token not yet valid");
  }

  // Exact-match issuer against trusted env var
  if (!env.CLERK_ISSUER_URL) {
    throw new Error("CLERK_ISSUER_URL not configured");
  }
  if (payload.iss !== env.CLERK_ISSUER_URL) {
    throw new Error("Invalid token issuer");
  }

  // Verify signature using JWKS from the trusted issuer URL
  const isValid = await verifyJWTSignature(token, env);
  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  return payload;
}

/**
 * Verify JWT signature using Clerk's public keys.
 * JWKS URL is derived from the trusted CLERK_ISSUER_URL env var.
 * Keys are cached in KV with a 10-minute TTL.
 */
async function verifyJWTSignature(token: string, env: Env): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to get the key ID
  const headerJson = atob(headerB64.replace(/-/g, "+").replace(/_/g, "/"));
  const header = JSON.parse(headerJson) as { alg: string; kid?: string; typ: string };

  if (header.alg !== "RS256") {
    throw new Error("Unsupported algorithm: " + header.alg);
  }

  // Fetch JWKS from trusted issuer URL (with KV cache)
  const jwks = await getJWKS(env);

  // Find the key matching the kid
  const key = jwks.keys.find((k) => k.kid === header.kid);
  if (!key) {
    // Key not found - could be a rotation. Fetch fresh JWKS bypassing cache.
    const freshJwks = await fetchAndCacheJWKS(env);
    const freshKey = freshJwks.keys.find((k) => k.kid === header.kid);
    if (!freshKey) {
      throw new Error("Key not found in JWKS");
    }
    return verifyWithKey(freshKey, headerB64, payloadB64, signatureB64);
  }

  return verifyWithKey(key, headerB64, payloadB64, signatureB64);
}

/**
 * Get JWKS, preferring KV cache. Falls back to fresh fetch.
 */
async function getJWKS(env: Env): Promise<JWKS> {
  // Try KV cache first
  const cached = await env.CACHE.get(JWKS_CACHE_KEY, "json");
  if (cached) {
    return cached as JWKS;
  }

  return fetchAndCacheJWKS(env);
}

/**
 * Fetch JWKS from Clerk and cache in KV.
 */
async function fetchAndCacheJWKS(env: Env): Promise<JWKS> {
  const jwksUrl = `${env.CLERK_ISSUER_URL}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch JWKS");
  }

  const jwks = (await response.json()) as JWKS;

  // Cache in KV with TTL
  await env.CACHE.put(JWKS_CACHE_KEY, JSON.stringify(jwks), {
    expirationTtl: JWKS_CACHE_TTL_SECONDS,
  });

  return jwks;
}

/**
 * Verify a JWT signature against a specific JWK.
 */
async function verifyWithKey(
  key: JWK,
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: key.kty,
      n: key.n,
      e: key.e,
      alg: "RS256",
      use: "sig",
    },
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  const signatureBuffer = base64UrlDecode(signatureB64);
  const dataBuffer = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signatureBuffer, dataBuffer);
}

/**
 * Decode base64url to ArrayBuffer
 */
function base64UrlDecode(str: string): ArrayBuffer {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Optional auth middleware - sets auth context if token is present but doesn't require it.
 */
export const optionalAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const cookieToken = c.req.header("Cookie")?.match(/__session=([^;]+)/)?.[1];

  const token = (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined) ?? cookieToken;

  if (token) {
    try {
      const payload = await verifyClerkToken(token, c.env);

      c.set("auth", {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
      });
    } catch {
      // Token invalid, continue without auth
    }
  }

  await next();
};
