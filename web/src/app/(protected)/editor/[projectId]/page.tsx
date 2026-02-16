"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Sidebar, SidebarOverlay, type ChapterData } from "@/components/sidebar";
import { DriveBanner } from "@/components/drive-banner";
import { ChapterEditor } from "@/components/chapter-editor";

interface Project {
  id: string;
  title: string;
  description?: string;
  driveFolderId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DriveStatus {
  connected: boolean;
  email?: string;
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
 * Per PRD US-012 (Chapter Navigation):
 * - Chapter list with titles and word counts
 * - Active chapter highlighted
 * - Auto-save before navigation to different chapter
 * - Scroll position restored on return to previously edited chapter
 * - Chapter content loaded on demand from API
 * - Responsive sidebar: persistent on desktop/landscape, overlay on portrait
 */
export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  // Editor state
  const [chapterContent, setChapterContent] = useState<Record<string, string>>({});
  const [chapterVersions, setChapterVersions] = useState<Record<string, number>>({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [contentLoading, setContentLoading] = useState(false);

  // Track dirty chapters (modified since last save)
  const dirtyChaptersRef = useRef<Set<string>>(new Set());

  // Scroll position tracking per chapter
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const editorScrollRef = useRef<HTMLDivElement>(null);

  // Track whether content has been loaded for each chapter
  const loadedChaptersRef = useRef<Set<string>>(new Set());

  // Fetch project data and drive status
  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();

        // Fetch project and user data in parallel
        const [projectResponse, userResponse] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!projectResponse.ok) {
          if (projectResponse.status === 404) {
            router.push("/dashboard");
            return;
          }
          throw new Error("Failed to load project");
        }

        const data: ProjectData = await projectResponse.json();
        setProjectData(data);

        // Set active chapter to first one if not already set
        if (data.chapters.length > 0 && !activeChapterId) {
          const sortedChapters = [...data.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
          setActiveChapterId(sortedChapters[0].id);
        }

        // Set drive status if user data loaded successfully
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setDriveStatus(userData.drive);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [projectId, getToken, router, activeChapterId]);

  // Fetch chapter content when active chapter changes
  useEffect(() => {
    if (!activeChapterId) return;
    if (loadedChaptersRef.current.has(activeChapterId)) return;

    async function fetchContent() {
      setContentLoading(true);
      try {
        const token = await getToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/chapters/${activeChapterId}/content`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const data = (await response.json()) as { content: string; version: number };
          setChapterContent((prev) => ({ ...prev, [activeChapterId!]: data.content }));
          setChapterVersions((prev) => ({ ...prev, [activeChapterId!]: data.version }));
          loadedChaptersRef.current.add(activeChapterId!);
        }
      } catch (err) {
        console.error("Failed to fetch chapter content:", err);
      } finally {
        setContentLoading(false);
      }
    }

    fetchContent();
  }, [activeChapterId, getToken]);

  // Restore scroll position when switching back to a chapter
  useEffect(() => {
    if (!activeChapterId || !editorScrollRef.current) return;

    const savedPosition = scrollPositionsRef.current[activeChapterId] ?? 0;
    // Use requestAnimationFrame to ensure DOM has rendered
    requestAnimationFrame(() => {
      if (editorScrollRef.current) {
        editorScrollRef.current.scrollTop = savedPosition;
      }
    });
  }, [activeChapterId]);

  // Get active chapter (needed early for handlers)
  const activeChapter = projectData?.chapters.find((ch) => ch.id === activeChapterId);

  /**
   * Save chapter content to the API.
   * Called both on manual save and before navigation (auto-save).
   */
  const saveChapterContent = useCallback(
    async (chapterId: string): Promise<boolean> => {
      const content = chapterContent[chapterId];
      if (content === undefined) return true;

      try {
        const token = await getToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/chapters/${chapterId}/content`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              content,
              version: chapterVersions[chapterId],
            }),
          },
        );

        if (response.ok) {
          const updatedChapter = (await response.json()) as Chapter & { version: number };
          dirtyChaptersRef.current.delete(chapterId);

          // Update version for optimistic concurrency
          setChapterVersions((prev) => ({ ...prev, [chapterId]: updatedChapter.version }));

          // Update word count in project data
          setProjectData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              chapters: prev.chapters.map((ch) =>
                ch.id === chapterId ? { ...ch, wordCount: updatedChapter.wordCount } : ch,
              ),
            };
          });

          return true;
        }
        return false;
      } catch (err) {
        console.error("Failed to save chapter content:", err);
        return false;
      }
    },
    [chapterContent, chapterVersions, getToken],
  );

  /**
   * Handle chapter selection with auto-save and scroll position preservation.
   * Per PRD US-012: Auto-save triggers before navigation to a different chapter.
   */
  const handleChapterSelect = useCallback(
    async (chapterId: string) => {
      if (chapterId === activeChapterId) {
        setMobileOverlayOpen(false);
        return;
      }

      // Save scroll position for current chapter
      if (activeChapterId && editorScrollRef.current) {
        scrollPositionsRef.current[activeChapterId] = editorScrollRef.current.scrollTop;
      }

      // Auto-save current chapter if dirty
      if (activeChapterId && dirtyChaptersRef.current.has(activeChapterId)) {
        setSaveStatus("saving");
        const saved = await saveChapterContent(activeChapterId);
        setSaveStatus(saved ? "saved" : "unsaved");
      }

      setActiveChapterId(chapterId);
      setMobileOverlayOpen(false);
      setEditingTitle(false);
    },
    [activeChapterId, saveChapterContent],
  );

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
        },
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

  // Handle content changes
  const handleContentUpdate = useCallback(
    (html: string) => {
      if (!activeChapterId) return;
      setChapterContent((prev) => ({ ...prev, [activeChapterId]: html }));
      dirtyChaptersRef.current.add(activeChapterId);
      setSaveStatus("unsaved");
    },
    [activeChapterId],
  );

  // Handle explicit save (Cmd+S)
  const handleSave = useCallback(async () => {
    if (!activeChapterId) return;

    setSaveStatus("saving");
    const saved = await saveChapterContent(activeChapterId);
    setSaveStatus(saved ? "saved" : "unsaved");
  }, [activeChapterId, saveChapterContent]);

  // Handle chapter title update
  const handleTitleSave = useCallback(async () => {
    if (!activeChapterId || !titleValue.trim()) {
      setEditingTitle(false);
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chapters/${activeChapterId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: titleValue.trim() }),
        },
      );

      if (response.ok) {
        // Update local state
        setProjectData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            chapters: prev.chapters.map((ch) =>
              ch.id === activeChapterId ? { ...ch, title: titleValue.trim() } : ch,
            ),
          };
        });
      }
    } catch (err) {
      console.error("Failed to update chapter title:", err);
    } finally {
      setEditingTitle(false);
    }
  }, [activeChapterId, titleValue, getToken]);

  // Start editing title
  const handleTitleEdit = useCallback(() => {
    if (activeChapter) {
      setTitleValue(activeChapter.title);
      setEditingTitle(true);
    }
  }, [activeChapter]);

  // Count words in HTML content
  const countWords = useCallback((html: string): number => {
    const text = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text ? text.split(" ").length : 0;
  }, []);

  // Get current content for active chapter
  const currentContent = activeChapterId ? chapterContent[activeChapterId] || "" : "";
  const currentWordCount = countWords(currentContent);

  // Calculate total word count
  const totalWordCount = projectData?.chapters.reduce((sum, ch) => sum + ch.wordCount, 0) ?? 0;

  // Convert chapters to sidebar format
  const sidebarChapters: ChapterData[] =
    projectData?.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      wordCount: ch.wordCount,
      sortOrder: ch.sortOrder,
    })) ?? [];

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
      {/* Desktop/Landscape Sidebar - persistent at 1024px+ (iPad Landscape and Desktop) */}
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

      {/* Portrait/Mobile Sidebar - collapsed pill on screens under 1024px */}
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
        <SidebarOverlay isOpen={mobileOverlayOpen} onClose={() => setMobileOverlayOpen(false)}>
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
            {/* Save status */}
            <span
              className={`text-xs ${saveStatus === "unsaved" ? "text-amber-600" : "text-muted-foreground"}`}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "unsaved"
                  ? "Unsaved"
                  : "Saved"}
            </span>

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
        <div className="flex-1 overflow-auto" ref={editorScrollRef}>
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Drive connection banner - contextual, not blocking */}
            {driveStatus && !driveStatus.connected && (
              <div className="mb-6">
                <DriveBanner connected={false} dismissible={true} />
              </div>
            )}

            {/* Chapter title - editable via double-click */}
            {editingTitle ? (
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="text-3xl font-semibold text-foreground mb-6 outline-none w-full
                           border-b-2 border-blue-500 bg-transparent"
                autoFocus
                maxLength={200}
              />
            ) : (
              <h1
                className="text-3xl font-semibold text-foreground mb-6 outline-none cursor-text
                           hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
                onDoubleClick={handleTitleEdit}
                title="Double-click to edit"
              >
                {activeChapter?.title || "Untitled Chapter"}
              </h1>
            )}

            {/* Content loading state */}
            {contentLoading ? (
              <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-muted-foreground text-sm">Loading chapter...</div>
              </div>
            ) : (
              <>
                {/* Rich Text Editor */}
                <ChapterEditor
                  key={activeChapterId}
                  content={currentContent}
                  onUpdate={handleContentUpdate}
                  onSave={handleSave}
                />

                {/* Word count display */}
                <div className="mt-4 flex justify-end">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {currentWordCount.toLocaleString()} words
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
