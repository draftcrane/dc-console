import Link from "next/link";

/**
 * Landing Page for DraftCrane.
 * Per PRD Section 7 Step 1:
 * - Simple page with tagline and 2-3 sentence description
 * - "Get Started" button linking to /sign-up
 * - Language for authors, not technologists
 * - Avoid: "platform", "integrate", "workflow", "pipeline", "orchestration"
 * - Use: "write", "organize", "export", "your book", "your files"
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-12">
      <main className="flex max-w-xl flex-col items-center text-center">
        {/* Logo/Title */}
        <h1 className="mb-2 text-4xl font-semibold tracking-tight text-gray-900">
          DraftCrane
        </h1>

        {/* Tagline */}
        <p className="mb-8 text-xl text-gray-600">
          Your book. Your files. Your cloud.
          <br />
          With an AI writing partner.
        </p>

        {/* Description */}
        <p className="mb-10 max-w-md text-lg leading-relaxed text-gray-700">
          Write and organize your nonfiction book in one place. Get AI help when you need it.
          Export to PDF or EPUB when you are ready. Your chapters stay in your Google Drive,
          where they belong.
        </p>

        {/* CTA Button - 44pt minimum touch target for iPad */}
        <Link
          href="/sign-up"
          className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-lg bg-gray-900 px-8 text-lg font-medium text-white transition-colors hover:bg-gray-800 active:bg-gray-950"
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
    </div>
  );
}
