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
 * - US-004: 30-day session lifetime
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
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Header with safe area padding for iPad Safari */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 px-4 pt-[env(safe-area-inset-top)]">
        {/* Logo/Title - links to dashboard */}
        <Link
          href="/dashboard"
          className="flex h-11 items-center text-lg font-semibold text-gray-900"
        >
          DraftCrane
        </Link>

        {/* User button with sign out - minimum 44x44pt touch target */}
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
      </header>

      {/* Main content area */}
      <main className="flex-1 pb-[env(safe-area-inset-bottom)]">
        {children}
      </main>
    </div>
  );
}
