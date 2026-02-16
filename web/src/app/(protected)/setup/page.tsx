"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { DriveBanner } from "@/components/drive-banner";
import { useDriveStatus } from "@/hooks/use-drive-status";
import { useDriveFolder } from "@/hooks/use-drive-folder";

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
  const {
    createFolder,
    folder: driveFolder,
    isCreating: isFolderCreating,
    error: folderError,
  } = useDriveFolder();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

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

      // If Drive is already connected, auto-create the folder and go to editor
      if (driveStatus?.connected) {
        // Fire-and-forget folder creation; redirect immediately
        createFolder(project.id);
        setCreatedProjectId(project.id);
        return;
      }

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
  const connectDriveWithProject = useCallback(() => {
    if (createdProjectId) {
      sessionStorage.setItem("dc_pending_drive_project", createdProjectId);
    }
    connectDrive();
  }, [createdProjectId, connectDrive]);

  const handleRetryFolderCreation = useCallback(() => {
    if (createdProjectId) {
      createFolder(createdProjectId);
    }
  }, [createdProjectId, createFolder]);

  // Step 2: Drive connection (shown after project creation)
  if (createdProjectId) {
    // If Drive is already connected, show folder creation status
    if (driveStatus?.connected) {
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
              <h1 className="text-2xl font-semibold text-foreground mb-2">Book Created</h1>
            </div>

            {/* Folder creation status */}
            <div className="mb-6">
              {isFolderCreating && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground p-4">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Creating book folder in Drive...</span>
                </div>
              )}

              {driveFolder && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-green-600"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800">Book folder created</p>
                      <p className="text-sm text-green-700 truncate">{driveFolder.name}</p>
                    </div>
                  </div>
                  <a
                    href={driveFolder.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-900 underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    View in Google Drive
                  </a>
                </div>
              )}

              {folderError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800">Failed to create book folder</p>
                  <p className="text-sm text-red-700 mt-1">{folderError}</p>
                  <button
                    onClick={handleRetryFolderCreation}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors min-h-[44px]"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Continue to editor */}
            {(driveFolder || folderError) && !isFolderCreating && (
              <div className="text-center">
                <button
                  onClick={() => router.push(`/editor/${createdProjectId}`)}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Start Writing
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Drive not connected - show connection prompt
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
            <h1 className="text-2xl font-semibold text-foreground mb-2">Book Created</h1>
            <p className="text-muted-foreground">
              Keep your chapters safe by connecting Google Drive.
            </p>
          </div>

          {/* Drive connection banner - uses project-aware connect handler */}
          <div className="mb-6">
            <DriveBanner
              connected={false}
              dismissible={false}
              onConnect={connectDriveWithProject}
            />
          </div>

          {/* Maybe later / skip to editor */}
          <div className="text-center">
            <button
              onClick={() => router.push(`/editor/${createdProjectId}`)}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Maybe later &mdash; start writing
            </button>
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
          <h1 className="text-2xl font-semibold text-foreground mb-2">Create Your Book</h1>
          <p className="text-muted-foreground">Start your writing journey with a working title.</p>
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
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm"
            >
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full py-3 px-4 rounded-lg bg-blue-600 text-white font-medium
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all"
          >
            {isSubmitting ? "Creating..." : "Create Book"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Your book will start with a first chapter ready for writing.
        </p>
      </div>
    </div>
  );
}
