"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useDriveStatus } from "@/hooks/use-drive-status";

/**
 * Book Setup Screen
 *
 * Per PRD Section 7 (Step 3) and US-009:
 * - Two fields: book title (required) and optional description (1-2 sentences)
 * - Helper text: "This is a working title. You can change it anytime."
 * - "Create Book" button
 * - Creates default "Chapter 1"
 *
 * Per PRD Section 7 (Step 4) and US-005:
 * - After project creation, shows "Connect Google Drive" option
 * - "Maybe later" link available - Drive connection is optional
 *
 * Per PRD Section 8 (US-006):
 * - After Drive OAuth completes, auto-create folder named after project title
 * - Store project ID in sessionStorage so Drive success page can create the folder
 *
 * Per PRD Section 8:
 * - Title max 500 chars
 * - Description max 1000 chars
 */
export default function SetupPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { status: driveStatus, connect: connectDrive } = useDriveStatus();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const titleLength = title.length;
  const descriptionLength = description.length;

  const isValid = title.trim().length > 0 && titleLength <= 500 && descriptionLength <= 1000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await response.json();

      // Otherwise show the Drive connection step
      setCreatedProjectId(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Connect Drive with project context.
   * Stores the project ID in sessionStorage so the Drive success page
   * can auto-create the book folder after OAuth completes.
   */
  const connectDriveWithProject = useCallback(async () => {
    setIsConnecting(true);
    await connectDrive();
    // If connectDrive redirects to Google OAuth, we won't reach here.
    // If it fails, the hook sets driveError and we fall through.
    setIsConnecting(false);
  }, [createdProjectId, connectDrive]);

  // Step 2: Drive connection (shown after project creation)
  if (createdProjectId) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">Book Created</h1>
            <p className="text-muted-foreground">
              Your chapters can be saved to your own Google Drive, always under your control.
            </p>
          </div>

          {/* Connect Drive button */}
          <div className="text-center mb-6">
            <button
              onClick={connectDriveWithProject}
              disabled={isConnecting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {isConnecting ? (
                "Connecting..."
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Connect Google Drive
                </>
              )}
            </button>
          </div>

          {/* Maybe later / skip to editor */}
          <div className="text-center">
            <button
              onClick={() => router.push(`/editor/${createdProjectId}`)}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Maybe later &mdash; start writing
            </button>
            <p className="mt-4 text-xs text-gray-400">
              You can always save a backup to your device from the editor&apos;s Export menu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Book creation form
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
            Create Your Book
          </h1>
          <p className="text-muted-foreground">
            Give your book a working title. You can change it anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title field */}
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-foreground">
              Book Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your book title"
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground
                         placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all"
              maxLength={500}
              autoFocus
              aria-describedby="title-help title-count"
            />
            <div className="flex justify-between items-center text-sm">
              <p id="title-help" className="text-muted-foreground">
                This is a working title. You can change it anytime.
              </p>
              <span
                id="title-count"
                className={`tabular-nums ${titleLength > 450 ? "text-amber-500" : "text-muted-foreground"} ${titleLength > 500 ? "text-red-500" : ""}`}
              >
                {titleLength}/500
              </span>
            </div>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what your book is about"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground
                         placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all resize-none"
              maxLength={1000}
              aria-describedby="description-count"
            />
            <div className="flex justify-end">
              <span
                id="description-count"
                className={`text-sm tabular-nums ${descriptionLength > 900 ? "text-amber-500" : "text-muted-foreground"} ${descriptionLength > 1000 ? "text-red-500" : ""}`}
              >
                {descriptionLength}/1000
              </span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full py-3 px-4 rounded-lg bg-gray-900 text-white font-medium
                       hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all"
          >
            {isSubmitting ? "Creating..." : "Create Book"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Your first chapter will be waiting for you.
        </p>
      </div>
    </div>
  );
}
