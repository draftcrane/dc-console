"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { DriveBanner } from "@/components/drive-banner";
import { useDriveStatus } from "@/hooks/use-drive-status";
import { useSignOut } from "@/hooks/use-sign-out";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status: driveStatus, connect: connectDrive } = useDriveStatus();
  const { handleSignOut, isSigningOut } = useSignOut();

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
      {/* Drive connection banner (US-005) */}
      {driveStatus && !driveStatus.connected && (
        <div className="w-full max-w-lg mb-8">
          <DriveBanner connected={false} dismissible={true} onConnect={connectDrive} />
        </div>
      )}

      {driveStatus?.connected && (
        <div className="w-full max-w-lg mb-8">
          <DriveBanner connected={true} email={driveStatus.email} dismissible={true} />
        </div>
      )}

      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome to DraftCrane</h1>
        <p className="text-muted-foreground mb-8">
          Start writing your book with a chapter-based editor, AI assistance, and automatic saving
          to Google Drive.
        </p>

        <Link
          href="/setup"
          className="inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-8 text-lg font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Create Your First Book
        </Link>

        {driveStatus?.connected && (
          <p className="mt-6 text-sm text-green-600">
            Connected to Google Drive{driveStatus.email ? ` as ${driveStatus.email}` : ""}
          </p>
        )}

        {/* Sign out option (US-003) */}
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-8 text-sm text-gray-500 hover:text-gray-700 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningOut ? "Signing out\u2026" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
