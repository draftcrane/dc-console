export interface Env {
  // Cloudflare Bindings
  DB: D1Database;
  EXPORTS_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  AI: Ai;

  // Clerk
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  CLERK_ISSUER_URL: string; // e.g. https://<instance>.clerk.accounts.dev

  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;

  // Google Picker API (restricted to Picker API + draftcrane.app referrer)
  GOOGLE_API_KEY: string;

  // AI Provider
  AI_API_KEY: string;
  AI_MODEL?: string; // Default: gpt-4o
  AI_DEFAULT_TIER?: string; // "edge" | "frontier", default: "frontier"

  // Cloudflare Browser Rendering (PDF export)
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;

  // App
  FRONTEND_URL: string;
  API_BASE_URL?: string; // Base URL for API (used in export download URLs)
  ENCRYPTION_KEY: string;
}
