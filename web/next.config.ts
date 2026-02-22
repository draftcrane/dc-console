import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

/**
 * Security headers applied to all routes.
 */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://apis.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.clerk.com https://img.clerk.com https://lh3.googleusercontent.com;
  font-src 'self';
  connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.draftcrane.app https://*.googleapis.com;
  frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://docs.google.com https://accounts.google.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\s{2,}/g, " ").trim();

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
    value: ContentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
