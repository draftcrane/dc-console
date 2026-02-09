import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

/**
 * Sign In page using Clerk's hosted authentication.
 * Per PRD Section 7 Step 2 and Section 8:
 * - Clean Clerk-hosted authentication
 * - "Continue with Google" is primary and prominent
 * - Email/password is secondary
 * - Redirect-based OAuth only (Safari popup blocker mitigation)
 * - iPad Safari is primary target - use 100dvh not 100vh
 * - Touch targets minimum 44x44pt
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-6 py-12">
      {/* Header with back to home */}
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
        >
          Back to DraftCrane
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
        <p className="mt-2 text-gray-600">Sign in to continue writing your book</p>
      </div>

      {/* Clerk SignIn component with enhanced styling */}
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto w-full max-w-md",
            card: "shadow-lg rounded-xl border border-gray-100 bg-white",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            socialButtonsBlockButton:
              "h-12 text-base font-medium border-gray-200 hover:bg-gray-50",
            socialButtonsBlockButtonText: "text-gray-700",
            dividerLine: "bg-gray-200",
            dividerText: "text-gray-500 text-sm",
            formFieldLabel: "text-gray-700 font-medium",
            formFieldInput:
              "h-12 rounded-lg border-gray-200 focus:border-gray-400 focus:ring-gray-400",
            formButtonPrimary:
              "h-12 bg-gray-900 hover:bg-gray-800 text-base font-medium rounded-lg",
            footerActionLink: "text-gray-700 font-medium hover:text-gray-900",
            identityPreviewEditButton: "text-gray-600 hover:text-gray-800",
          },
          layout: {
            socialButtonsPlacement: "top",
            socialButtonsVariant: "blockButton",
          },
        }}
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}
