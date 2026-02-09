"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Book Setup Screen
 *
 * Per PRD Section 7 (Step 3) and US-009:
 * - Two fields: book title (required) and optional description (1-2 sentences)
 * - Helper text: "This is a working title. You can change it anytime."
 * - "Create Book" button
 * - Creates default "Chapter 1"
 *
 * Per PRD Section 8:
 * - Title max 500 chars
 * - Description max 1000 chars
 */
export default function SetupPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Redirect to the writing environment with the new project
      // For now, redirect to a placeholder route
      router.push(`/editor/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Create Your Book</h1>
          <p className="text-muted-foreground">
            Start your writing journey with a working title.
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
