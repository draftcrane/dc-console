"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Sidebar, SidebarOverlay, type ChapterData } from "@/components/sidebar";

interface Project {
  id: string;
  title: string;
  description?: string;
  driveFolderId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Chapter {
  id: string;
  title: string;
  sortOrder: number;
  wordCount: number;
  status: string;
}

interface ProjectData {
  project: Project;
  chapters: Chapter[];
}

/**
 * Writing Environment Page
 *
 * Per PRD Section 9 (Writing Environment Layout):
 * Three zones:
 * 1. Sidebar with chapter list, word counts, "+" button, total word count
 * 2. Editor with clean writing area, editable chapter title
 * 3. Toolbar with minimal formatting, save status, Export, Settings
 *
 * Per PRD Section 14 (iPad-First Design):
 * - Sidebar responsive: persistent in landscape (240-280pt), hidden in portrait with "Ch X" pill
 * - Touch targets 44x44pt minimum
 * - Uses 100dvh for viewport height
 *
 * Note: Editor area is a placeholder pending ADR-001 (editor library) decision.
 */
export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      try {
        const token = await getToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            router.push("/dashboard");
            return;
          }
          throw new Error("Failed to load project");
        }

        const data: ProjectData = await response.json();
        setProjectData(data);

        // Set active chapter to first one if not already set
        if (data.chapters.length > 0 && !activeChapterId) {
          const sortedChapters = [...data.chapters].sort(
            (a, b) => a.sortOrder - b.sortOrder
          );
          setActiveChapterId(sortedChapters[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProject();
  }, [projectId, getToken, router, activeChapterId]);

  // Handle chapter selection
  const handleChapterSelect = useCallback((chapterId: string) => {
    setActiveChapterId(chapterId);
    setMobileOverlayOpen(false);
  }, []);

  // Handle add chapter
  const handleAddChapter = useCallback(async () => {
    if (!projectData) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/chapters`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: "Untitled Chapter",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create chapter");
      }

      const newChapter: Chapter = await response.json();

      // Update local state
      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: [...prev.chapters, newChapter],
        };
      });

      // Select the new chapter
      setActiveChapterId(newChapter.id);
    } catch (err) {
      console.error("Failed to add chapter:", err);
    }
  }, [projectData, projectId, getToken]);

  // Calculate total word count
  const totalWordCount =
    projectData?.chapters.reduce((sum, ch) => sum + ch.wordCount, 0) ?? 0;

  // Convert chapters to sidebar format
  const sidebarChapters: ChapterData[] =
    projectData?.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      wordCount: ch.wordCount,
      sortOrder: ch.sortOrder,
    })) ?? [];

  // Get active chapter
  const activeChapter = projectData?.chapters.find(
    (ch) => ch.id === activeChapterId
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar
          chapters={sidebarChapters}
          activeChapterId={activeChapterId ?? undefined}
          onChapterSelect={handleChapterSelect}
          onAddChapter={handleAddChapter}
          totalWordCount={totalWordCount}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar - collapsed pill on small screens */}
      <div className="lg:hidden">
        <Sidebar
          chapters={sidebarChapters}
          activeChapterId={activeChapterId ?? undefined}
          onChapterSelect={handleChapterSelect}
          onAddChapter={handleAddChapter}
          totalWordCount={totalWordCount}
          collapsed={true}
          onToggleCollapsed={() => setMobileOverlayOpen(true)}
        />

        {/* Mobile overlay sidebar */}
        <SidebarOverlay
          isOpen={mobileOverlayOpen}
          onClose={() => setMobileOverlayOpen(false)}
        >
          <Sidebar
            chapters={sidebarChapters}
            activeChapterId={activeChapterId ?? undefined}
            onChapterSelect={handleChapterSelect}
            onAddChapter={handleAddChapter}
            totalWordCount={totalWordCount}
            collapsed={false}
            onToggleCollapsed={() => setMobileOverlayOpen(false)}
          />
        </SidebarOverlay>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
          {/* Project title / switcher */}
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-medium text-foreground truncate">
              {projectData?.project.title}
            </h2>
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-2">
            {/* Save status - placeholder */}
            <span className="text-xs text-muted-foreground">Saved</span>

            {/* Export button */}
            <button
              className="h-9 px-3 text-sm rounded-lg hover:bg-gray-100 transition-colors min-w-[44px]"
              aria-label="Export"
            >
              Export
            </button>

            {/* Settings button */}
            <button
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Settings"
            >
              <svg
                className="w-5 h-5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Chapter title - editable */}
            <h1 className="text-3xl font-semibold text-foreground mb-6 outline-none">
              {activeChapter?.title || "Untitled Chapter"}
            </h1>

            {/* Editor placeholder - pending ADR-001 */}
            <div className="min-h-[400px] p-6 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
              <div className="text-center text-muted-foreground">
                <svg
                  className="w-12 h-12 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <p className="text-lg font-medium mb-2">Editor pending ADR-001 decision</p>
                <p className="text-sm max-w-md mx-auto">
                  The rich text editor is being evaluated. Once ADR-001 (Editor Library)
                  is resolved, this area will contain the chapter editor with formatting
                  tools and AI rewrite capabilities.
                </p>
              </div>
            </div>

            {/* Word count display */}
            <div className="mt-4 flex justify-end">
              <span className="text-sm text-muted-foreground tabular-nums">
                {activeChapter?.wordCount.toLocaleString() ?? 0} words
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
