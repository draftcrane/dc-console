"use client";

import { ClerkProvider } from "@clerk/nextjs";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Application providers wrapper.
 * Per PRD Section 7: Clean Clerk-hosted authentication.
 * Per PRD Section 8 US-002: Session via Clerk JWT (httpOnly, Secure, SameSite=Lax cookie).
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
