"use client";

import { ClerkProvider } from "@clerk/nextjs";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Application providers wrapper.
 * Per PRD Section 7: Clean Clerk-hosted authentication.
 * Per PRD Section 8 US-002: Session via Clerk JWT (httpOnly, Secure, SameSite=Lax cookie).
 *
 * Session persistence (US-004):
 * - 30-day session lifetime is configured in the Clerk Dashboard
 *   (Settings > Sessions > Session lifetime = 30 days, Inactivity timeout = 30 days).
 * - Sliding window renewal is handled automatically by Clerk's token refresh.
 * - afterSignInUrl/afterSignUpUrl direct authenticated users to the writing environment.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      {children}
    </ClerkProvider>
  );
}
