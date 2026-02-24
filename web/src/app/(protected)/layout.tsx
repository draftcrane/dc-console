import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

/**
 * Protected layout that requires authentication.
 * Per PRD Section 8:
 * - US-002: Returning user signs in and is taken directly to Writing Environment
 * - US-004: 30-day session lifetime (configured in Clerk Dashboard)
 *
 * Session expiry handling (US-004):
 * - When a session expires (after 30 days of inactivity), auth() returns no userId.
 * - This layout redirects to /sign-in cleanly with no error page or stale state.
 * - Returning users within the 30-day window are served directly without re-auth
 *   because the Clerk middleware refreshes the session token automatically.
 *
 * This layout wraps all authenticated routes and redirects to sign-in if not authenticated.
 * Includes a simple header with DraftCrane logo/title and user button for sign out.
 *
 * Design constraints:
 * - iPad Safari is primary target - use 100dvh not 100vh
 * - Touch targets minimum 44x44pt
 * - Account for safe-area-inset for Safari toolbar
 */
export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header with safe area padding for iPad Safari */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 px-4 pt-[env(safe-area-inset-top)]">
        {/* Logo/Title - links to dashboard */}
        <Link
          href="/dashboard"
          className="flex h-11 items-center font-serif text-xl font-semibold text-gray-900"
        >
          DraftCrane
        </Link>

        {/* Right-side actions: help + user */}
        <div className="flex items-center gap-2">
          <Link
            href="/help"
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Help"
          >
            <svg
              className="h-5 w-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </Link>
          <div className="flex h-11 w-11 items-center justify-center">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                  userButtonTrigger: "h-11 w-11 flex items-center justify-center",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 pb-[env(safe-area-inset-bottom)]">{children}</main>
    </div>
  );
}
