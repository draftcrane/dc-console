import type { NextConfig } from "next";

/**
 * Security headers applied to all routes.
 *
 * CSP allows Clerk (auth UI, API), the DC API worker, and Next.js runtime.
 * Fonts are self-hosted via next/font so no external font-src is needed.
 */

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.clerk.com https://img.clerk.com;
  font-src 'self';
  connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.draftcrane.app;
  frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`;

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
