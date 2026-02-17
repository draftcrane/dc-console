import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - DraftCrane",
  description: "Terms of service for using DraftCrane, the nonfiction book writing environment.",
};

/**
 * Terms of Service page.
 * Public route (no auth required).
 * Required for Google OAuth verification and user trust.
 */
export default function TermsOfServicePage() {
  return (
    <div className="min-h-dvh bg-white px-6 py-12">
      <article className="mx-auto max-w-2xl">
        {/* Back link */}
        <Link href="/" className="mb-8 inline-block text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to DraftCrane
        </Link>

        <h1 className="mb-2 font-serif text-4xl font-semibold tracking-tight text-gray-900">
          Terms of Service
        </h1>
        <p className="mb-10 text-sm text-gray-500">Effective date: February 16, 2026</p>

        <div className="space-y-8 text-base leading-relaxed text-gray-700">
          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              What DraftCrane Is
            </h2>
            <p>
              DraftCrane is a writing environment for nonfiction authors. It helps you write,
              organize, and export your book. DraftCrane includes AI-assisted rewriting tools that
              suggest changes to your prose, which you can accept or reject.
            </p>
            <p className="mt-3">
              DraftCrane is a <strong>tool for writers</strong>. It is not a ghostwriting service, a
              publishing platform, or a content generation service. You write your book. DraftCrane
              helps you do it more effectively.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">Your Account</h2>
            <p>
              To use DraftCrane, you create an account using your email address or Google account.
              You are responsible for keeping your account credentials secure. If you believe your
              account has been compromised, contact us immediately.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              Your Content and Intellectual Property
            </h2>
            <p>
              <strong>You own everything you write.</strong> DraftCrane does not claim any
              ownership, license, or rights to your manuscripts, notes, chapters, or any other
              content you create using the service.
            </p>
            <p className="mt-3">
              When you use the AI rewrite feature, the resulting text belongs to you. AI-generated
              suggestions are tools to help you write. You are the author. You decide what to keep,
              what to change, and what to discard.
            </p>
            <p className="mt-3">
              We do not use your content to train AI models, build datasets, or create derivative
              works. Your unpublished manuscripts are treated as confidential.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              Google Drive Access
            </h2>
            <p>
              DraftCrane stores your manuscripts in your Google Drive account using the{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">drive.file</code> scope.
              This means DraftCrane can only access files and folders that it creates. It cannot
              access any other files in your Drive.
            </p>
            <p className="mt-3">
              Your files always remain in your Google Drive, under your control. If you stop using
              DraftCrane or revoke access, your files stay in your Drive. You can open, edit, or
              delete them independently of DraftCrane at any time.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              AI-Assisted Writing
            </h2>
            <p>DraftCrane offers AI rewrite tools powered by OpenAI. When you use these tools:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                You select the text to rewrite and choose the type of rewrite. DraftCrane never
                rewrites your text without your explicit action.
              </li>
              <li>
                The AI generates a suggestion. You review it and choose to accept, reject, or retry.
                Nothing changes in your manuscript without your approval.
              </li>
              <li>
                AI suggestions are starting points, not final copy. You are responsible for the
                accuracy, originality, and quality of your published work.
              </li>
              <li>
                If you are publishing work that includes AI-assisted passages, you should follow the
                disclosure guidelines of your publisher or institution.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              Data Portability
            </h2>
            <p>
              Your content lives in your Google Drive. This is a deliberate choice. You are never
              locked in to DraftCrane. You can:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Access your manuscript files directly in Google Drive at any time.</li>
              <li>Open and edit your files with any application that reads Google Docs.</li>
              <li>Download your files from Google Drive in multiple formats.</li>
              <li>Stop using DraftCrane entirely without losing access to any of your writing.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">Acceptable Use</h2>
            <p>You agree not to use DraftCrane to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Violate any laws or regulations, including copyright and intellectual property laws.
              </li>
              <li>
                Generate content that is harmful, abusive, or designed to harass or deceive others.
              </li>
              <li>Attempt to access other users&apos; accounts or data.</li>
              <li>
                Interfere with or disrupt the service, including reverse engineering or overloading
                infrastructure.
              </li>
              <li>Resell or redistribute DraftCrane as your own product.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              Service Availability
            </h2>
            <p>
              We strive to keep DraftCrane available and reliable. However, we cannot guarantee
              uninterrupted access. The service may be temporarily unavailable for maintenance,
              updates, or due to circumstances beyond our control.
            </p>
            <p className="mt-3">
              Because your manuscripts are stored in your Google Drive, your content is accessible
              even if DraftCrane is temporarily unavailable.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              Account Termination
            </h2>
            <p>
              You can stop using DraftCrane and request account deletion at any time. When your
              account is deleted:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                All account data, project metadata, and AI interaction records are permanently
                removed from our systems.
              </li>
              <li>Any cached export files are deleted from our cloud storage.</li>
              <li>Your Google OAuth connection is revoked.</li>
              <li>
                Your files in Google Drive are <strong>not</strong> deleted. They are yours and
                remain in your Drive.
              </li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate accounts that violate these terms. If we do, we will
              notify you by email and give you an opportunity to download any export files before
              they are removed.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              Limitation of Liability
            </h2>
            <p>
              DraftCrane is provided &ldquo;as is&rdquo; without warranties of any kind. To the
              fullest extent permitted by law, DraftCrane and its operators are not liable for any
              indirect, incidental, special, consequential, or punitive damages, including loss of
              data, revenue, or manuscripts.
            </p>
            <p className="mt-3">
              Because your manuscripts are stored in your Google Drive, data loss due to DraftCrane
              service issues does not affect your canonical manuscript files.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">
              Changes to These Terms
            </h2>
            <p>
              We may update these terms from time to time. If we make significant changes, we will
              notify you by email or through a notice in the app before the changes take effect.
              Continued use of DraftCrane after changes take effect constitutes acceptance of the
              updated terms.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-gray-900">Contact</h2>
            <p>
              If you have questions about these terms, contact us at{" "}
              <a
                href="mailto:support@draftcrane.app"
                className="text-gray-900 underline hover:text-gray-700"
              >
                support@draftcrane.app
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer links */}
        <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-700">
              Privacy Policy
            </Link>
            <Link href="/" className="hover:text-gray-700">
              Home
            </Link>
          </div>
        </footer>
      </article>
    </div>
  );
}
