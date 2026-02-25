import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - DraftCrane",
  description: "How DraftCrane handles your data, manuscripts, and Google Drive access.",
};

/**
 * Privacy Policy page.
 * Public route (no auth required).
 * Required for Google OAuth verification and user trust.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-[var(--dc-color-surface-primary)] px-6 py-12">
      <article className="mx-auto max-w-2xl">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-[var(--dc-color-text-muted)] hover:text-[var(--dc-color-text-secondary)]"
        >
          &larr; Back to DraftCrane
        </Link>

        <h1 className="mb-2 font-serif text-4xl font-semibold tracking-tight text-[var(--dc-color-text-primary)]">
          Privacy Policy
        </h1>
        <p className="mb-10 text-sm text-[var(--dc-color-text-muted)]">
          Effective date: February 16, 2026
        </p>

        <div className="space-y-8 text-base leading-relaxed text-[var(--dc-color-text-secondary)]">
          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              What DraftCrane Is
            </h2>
            <p>
              DraftCrane is a browser-based writing environment for nonfiction authors. It helps you
              organize, write, and export your book chapter by chapter. Your manuscripts are stored
              in your own Google Drive account. DraftCrane provides AI-assisted rewriting tools to
              help you improve your prose.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Information We Collect
            </h2>

            <h3 className="mb-2 mt-4 text-lg font-semibold text-[var(--dc-color-text-primary)]">
              Account information
            </h3>
            <p>
              When you create an account, we collect your name, email address, and profile
              information through our authentication provider, Clerk. If you sign in with Google, we
              receive basic profile information (name, email, profile photo) from Google OAuth.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-semibold text-[var(--dc-color-text-primary)]">
              Google Drive file metadata
            </h3>
            <p>
              When you connect your Google Drive, DraftCrane accesses file metadata (file names,
              folder structure, modification dates) for files that DraftCrane creates. We store this
              metadata in our database to power the dashboard and chapter list.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-semibold text-[var(--dc-color-text-primary)]">
              Manuscript content
            </h3>
            <p>
              When you open a chapter in the editor, DraftCrane reads the chapter content from your
              Google Drive to display it. When you use the AI rewrite feature, the selected text is
              sent to our AI provider for processing. The full content of your manuscripts is never
              stored on our servers. Your Google Drive is the canonical store for your writing.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-semibold text-[var(--dc-color-text-primary)]">
              Usage data
            </h3>
            <p>
              We collect basic usage information such as pages visited and features used to improve
              the product. We do not use third-party analytics or advertising trackers.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Google Drive Access
            </h2>
            <p>
              DraftCrane requests the{" "}
              <code className="rounded bg-[var(--dc-color-surface-tertiary)] px-1.5 py-0.5 text-sm">
                drive.file
              </code>{" "}
              scope from Google. This is the most restrictive file-access scope available. It means:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                DraftCrane can <strong>only</strong> access files and folders that DraftCrane itself
                creates in your Google Drive.
              </li>
              <li>
                DraftCrane <strong>cannot</strong> see, read, or modify any other files in your
                Drive, including documents, photos, or files created by other apps.
              </li>
              <li>
                If you revoke access, DraftCrane immediately loses the ability to read or write any
                files in your Drive. Your files remain in your Drive, fully accessible to you.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              AI Processing
            </h2>
            <p>
              When you use the AI rewrite feature, the text you select is sent to OpenAI (our AI
              provider) for processing. Here is what you should know:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Only the specific text you select for rewriting is sent to OpenAI. We do not send
                your entire manuscript.
              </li>
              <li>
                OpenAI processes the text to generate a rewrite suggestion, which is returned to you
                for review. You always choose whether to accept or reject the suggestion.
              </li>
              <li>
                We do not use your content to train AI models. Our agreement with OpenAI specifies
                that data sent through the API is not used for model training.
              </li>
              <li>
                AI interaction metadata (timestamps, word counts, accept/reject decisions) is stored
                in our database for product improvement. The actual text content is not retained
                after the request completes.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Where Your Data Lives
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Your manuscripts:</strong> In your own Google Drive account, always under
                your control.
              </li>
              <li>
                <strong>Project and chapter metadata:</strong> In our database (Cloudflare D1),
                including project names, chapter titles, and file references.
              </li>
              <li>
                <strong>Export files:</strong> Temporarily cached in cloud storage (Cloudflare R2)
                when you generate PDF or EPUB exports. These are treated as temporary artifacts.
              </li>
              <li>
                <strong>Authentication tokens:</strong> Google OAuth refresh tokens are stored
                server-side, encrypted with AES-256-GCM. They are used solely to maintain your
                Google Drive connection.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Authentication
            </h2>
            <p>
              DraftCrane uses Clerk as its authentication provider. When you sign in, Clerk handles
              your credentials securely. DraftCrane never sees or stores your password. If you sign
              in with Google, the OAuth flow is handled by Clerk and Google directly. For details on
              how Clerk handles your authentication data, see{" "}
              <a
                href="https://clerk.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--dc-color-text-primary)] underline hover:text-[var(--dc-color-text-secondary)]"
              >
                Clerk&apos;s Privacy Policy
              </a>
              .
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              What We Do Not Do
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>We do not sell your data to anyone.</li>
              <li>We do not use your manuscripts to train AI models.</li>
              <li>We do not show you ads.</li>
              <li>We do not share your content with other users.</li>
              <li>
                We do not access files in your Google Drive beyond the ones DraftCrane creates.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Deleting Your Data
            </h2>
            <p>You can request account deletion at any time by contacting us. When you do:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Your account and all associated metadata (project records, chapter records, AI
                interaction logs) will be permanently deleted from our database.
              </li>
              <li>Any cached export files in our cloud storage will be deleted.</li>
              <li>Your Google OAuth tokens will be revoked and deleted.</li>
              <li>
                Your files in Google Drive are <strong>not</strong> deleted, because they belong to
                you. They remain in your Drive, fully accessible.
              </li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Data Security
            </h2>
            <p>
              We use industry-standard security practices to protect your data. All connections use
              HTTPS. OAuth tokens are encrypted at rest with AES-256-GCM. Our infrastructure runs on
              Cloudflare, which provides DDoS protection and edge security. Access to production
              systems is restricted and audited.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Changes to This Policy
            </h2>
            <p>
              If we make significant changes to this privacy policy, we will notify you by email or
              through a notice in the app before the changes take effect.
            </p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-[var(--dc-color-text-primary)]">
              Contact
            </h2>
            <p>
              If you have questions about this privacy policy or your data, contact us at{" "}
              <a
                href="mailto:privacy@draftcrane.app"
                className="text-[var(--dc-color-text-primary)] underline hover:text-[var(--dc-color-text-secondary)]"
              >
                privacy@draftcrane.app
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer links */}
        <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-[var(--dc-color-text-muted)]">
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[var(--dc-color-text-secondary)]">
              Terms of Service
            </Link>
            <Link href="/" className="hover:text-[var(--dc-color-text-secondary)]">
              Home
            </Link>
          </div>
        </footer>
      </article>
    </div>
  );
}
