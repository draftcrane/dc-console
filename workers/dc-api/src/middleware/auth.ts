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

  const token = authHeader?.replace("Bearer ", "") ?? cookieToken;

  if (!token) {
    authRequired("No authentication token provided");
  }

  try {
    const payload = await verifyClerkToken(token, c.env.CLERK_SECRET_KEY);

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
 * Verifies a Clerk JWT token.
 * Clerk JWTs are signed with RS256 and can be verified using the JWKS endpoint
 * or using the secret key for development.
 */
async function verifyClerkToken(token: string, secretKey: string): Promise<ClerkJWTPayload> {
  // Parse the JWT
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

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

  // Verify issuer (should be Clerk)
  if (!payload.iss?.includes("clerk")) {
    throw new Error("Invalid token issuer");
  }

  // For production, we should verify the signature using Clerk's JWKS
  // For now, we'll fetch the JWKS and verify
  const isValid = await verifyJWTSignature(token, secretKey);
  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  return payload;
}

/**
 * Verify JWT signature using Clerk's public keys.
 * In production, this fetches from Clerk's JWKS endpoint.
 */
async function verifyJWTSignature(token: string, secretKey: string): Promise<boolean> {
  // Extract the instance ID from the secret key (sk_test_xxx or sk_live_xxx)
  // The JWKS endpoint is at https://{instance}.clerk.accounts.dev/.well-known/jwks.json

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

  // Decode payload to get issuer
  const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
  const payload = JSON.parse(payloadJson) as ClerkJWTPayload;

  // Fetch JWKS from Clerk
  const jwksUrl = `${payload.iss}/.well-known/jwks.json`;
  const jwksResponse = await fetch(jwksUrl);
  if (!jwksResponse.ok) {
    throw new Error("Failed to fetch JWKS");
  }

  const jwks = (await jwksResponse.json()) as {
    keys: Array<{ kid: string; kty: string; n: string; e: string; use: string }>;
  };

  // Find the key matching the kid
  const key = jwks.keys.find((k) => k.kid === header.kid);
  if (!key) {
    throw new Error("Key not found in JWKS");
  }

  // Import the public key
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

  // Verify the signature
  const signatureBuffer = base64UrlDecode(signatureB64);
  const dataBuffer = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signatureBuffer, dataBuffer);
}

/**
 * Decode base64url to ArrayBuffer
 */
function base64UrlDecode(str: string): ArrayBuffer {
  // Add padding if needed
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

  const token = authHeader?.replace("Bearer ", "") ?? cookieToken;

  if (token) {
    try {
      const payload = await verifyClerkToken(token, c.env.CLERK_SECRET_KEY);

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
