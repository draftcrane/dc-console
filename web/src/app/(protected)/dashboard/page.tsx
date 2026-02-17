"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useSignOut } from "@/hooks/use-sign-out";
import { useBackup } from "@/hooks/use-backup";

interface Project {
  id: string;
  title: string;
  wordCount: number;
  chapterCount: number;
  status: string;
}

interface UserData {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  projects: Project[];
  totalWordCount: number;
}

/**
 * Dashboard page - entry point after authentication.
 * Per PRD Section 9: "Opening DraftCrane takes the user directly to the Writing Environment
 * with the last-edited chapter loaded."
 *
 * If user has projects, redirect to the most recent one.
 * If no projects, show welcome screen with setup CTA.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { handleSignOut, isSigningOut } = useSignOut();
  const { importBackup, isImporting, error: importError } = useBackup();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const token = await getToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data: UserData = await response.json();

        // Per PRD: If user has projects, go directly to Writing Environment
        if (data.projects.length > 0) {
          // Redirect to most recent project (first in the list, sorted by updated_at DESC)
          router.push(`/editor/${data.projects[0].id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserData();
  }, [getToken, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No projects - show welcome screen with setup CTA
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
          Welcome to DraftCrane
        </h1>
        <p className="text-muted-foreground mb-8">
          A quiet place to write and shape your nonfiction book, chapter by chapter.
        </p>

        <div>
          <Link
            href="/setup"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-gray-900 px-8 text-lg font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Create Your First Book
          </Link>
        </div>

        <p className="mt-4 text-sm text-gray-400">Your first chapter will be waiting for you.</p>

        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const projectId = await importBackup(file);
              if (projectId) {
                router.push(`/editor/${projectId}`);
              }
              // Reset input so the same file can be selected again
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? "Importing..." : "Import from a backup file"}
          </button>
          {importError && <p className="text-sm text-red-600 mt-1">{importError}</p>}
        </div>

        {/* Sign out option (US-003) - Clerk UserButton in header handles this too */}
        <div className="mt-8">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? "Signing out\u2026" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
