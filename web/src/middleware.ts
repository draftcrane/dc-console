import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Routes that are publicly accessible without authentication.
 * Per PRD Section 7: Landing page is pre-auth.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy",
  "/terms",
]);

/**
 * Clerk middleware for route protection.
 * Per PRD Section 8:
 * - US-002: Returning user signs in and is taken directly to Writing Environment
 * - US-004: 30-day session lifetime, returning users go directly to Writing Environment
 *
 * Session persistence (US-004):
 * - 30-day session lifetime is configured in the Clerk Dashboard
 *   (Settings > Sessions > Session lifetime = 30 days).
 * - Sliding window renewal: Clerk automatically refreshes the session token
 *   on each request via the middleware, extending the session on user activity.
 * - Expired sessions: auth.protect() redirects to the sign-in page cleanly
 *   with no error page or flash. The unauthenticatedUrl ensures the redirect
 *   target is explicit.
 *
 * Ops setup required in Clerk Dashboard:
 * 1. Go to Settings > Sessions
 * 2. Set "Session lifetime" to 30 days (2,592,000 seconds)
 * 3. Set "Inactivity timeout" to 30 days (or disable if not needed)
 * 4. These settings enable the sliding window behavior described in US-004.
 */
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
