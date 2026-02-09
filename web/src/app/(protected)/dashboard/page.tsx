"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

interface Project {
  id: string;
  title: string;
  wordCount: number;
  chapterCount: number;
  status: string;
}

interface DriveStatus {
  connected: boolean;
  email?: string;
}

interface UserData {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  drive: DriveStatus;
  projects: Project[];
  totalWordCount: number;
}

/**
 * Dashboard page - entry point after authentication.
 * Per PRD Section 9: "Opening DraftCrane takes the user directly to the Writing Environment
 * with the last-edited chapter loaded."
 *
 * If user has projects, redirect to the most recent one.
 * If no projects, redirect to setup.
 * Shows Drive connection banner if not connected.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setUserData(data);

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
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
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
      {/* Drive connection banner */}
      {userData && !userData.drive.connected && (
        <div className="w-full max-w-lg mb-8 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-medium">Google Drive not connected</p>
              <p className="text-sm mt-1">
                Your work is saved on this device only. Connect Google Drive to keep your book safe.
              </p>
              <button className="mt-2 text-sm font-medium text-amber-900 underline hover:no-underline">
                Connect Google Drive
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Welcome to DraftCrane
        </h1>
        <p className="text-muted-foreground mb-8">
          Start writing your book with a chapter-based editor, AI assistance, and automatic saving to Google Drive.
        </p>

        <Link
          href="/setup"
          className="inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-8 text-lg font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Create Your First Book
        </Link>

        {userData?.drive.connected && (
          <p className="mt-6 text-sm text-green-600">
            Connected to Google Drive as {userData.drive.email}
          </p>
        )}
      </div>
    </div>
  );
}
