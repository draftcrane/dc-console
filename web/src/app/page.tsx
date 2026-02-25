import Link from "next/link";

/**
 * Landing Page for DraftCrane.
 * Per PRD Section 7 Step 1 and Section 9:
 * - Simple page with tagline and 2-3 sentence description
 * - "Get Started" button linking to /sign-up
 * - Language for authors, not technologists
 * - Avoid: "platform", "integrate", "workflow", "pipeline", "orchestration"
 * - Use: "write", "organize", "export", "your book", "your files"
 * - No feature matrix, no pricing table
 * - iPad-first: 44pt minimum touch targets
 * - Serif font for headings to match book-writing theme
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12">
      <main className="flex max-w-xl flex-col items-center text-center">
        {/* Logo/Title - serif font for book-writing theme */}
        <h1 className="mb-4 font-serif text-5xl font-semibold tracking-tight text-gray-900">
          DraftCrane
        </h1>

        {/* Tagline — seeds Author/Editor metaphor (#387) */}
        <p className="mb-8 font-serif text-xl leading-relaxed text-gray-600">
          Write your book.
          <br />
          Keep your files.
          <br />
          Work with an Editor who gets it.
        </p>

        {/* Description — author-friendly language, introduces Editor role */}
        <p className="mb-10 max-w-md text-lg leading-relaxed text-gray-500">
          A quiet place to write your nonfiction book, chapter by chapter. When your prose needs
          tightening, your Editor is one tap away &mdash; select text, ask for a rewrite, and decide
          what stays. Your chapters live in your Google Drive, always yours.
        </p>

        {/* CTA Button - 44pt minimum touch target for iPad */}
        <Link
          href="/sign-up"
          className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-lg bg-gray-900 px-8 text-lg font-medium text-white transition-colors hover:bg-gray-800 active:bg-gray-950"
        >
          Get Started
        </Link>

        {/* Secondary link for existing users */}
        <p className="mt-6 text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-gray-700 underline hover:text-gray-900">
            Sign in
          </Link>
        </p>
      </main>

      {/* Footer with legal links */}
      <footer className="mt-auto pb-8 pt-12 text-center text-sm text-gray-400">
        <div className="flex justify-center gap-6">
          <Link href="/privacy" className="hover:text-gray-600">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-600">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
