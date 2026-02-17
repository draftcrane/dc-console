"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ExportFormat = "pdf" | "epub";

type ExportState =
  | { phase: "idle" }
  | { phase: "exporting"; scope: "book" | "chapter" }
  | { phase: "complete"; fileName: string; downloadUrl: string; jobId: string }
  | { phase: "error"; message: string };

interface ExportMenuProps {
  projectId: string;
  activeChapterId: string | null;
  getToken: () => Promise<string | null>;
  apiUrl: string;
}

/**
 * ExportMenu - Dropdown menu for PDF and EPUB export.
 *
 * Per US-019 and US-020:
 * - "Export Book as PDF/EPUB" and "Export This Chapter as PDF/EPUB" options
 * - Progress indicator during generation
 * - On completion, provide download link
 * - iPad-first: 44pt touch targets
 */
export function ExportMenu({ projectId, activeChapterId, getToken, apiUrl }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ExportState>({ phase: "idle" });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close menu on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const handleExport = useCallback(
    async (scope: "book" | "chapter", format: ExportFormat = "pdf") => {
      setIsOpen(false);
      setState({ phase: "exporting", scope });

      try {
        const token = await getToken();
        if (!token) {
          setState({ phase: "error", message: "Authentication required" });
          return;
        }

        const url =
          scope === "book"
            ? `${apiUrl}/projects/${projectId}/export`
            : `${apiUrl}/projects/${projectId}/chapters/${activeChapterId}/export`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ format }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            setState({
              phase: "error",
              message: "Export rate limit reached. Please wait a moment.",
            });
            return;
          }
          const body = await response.json().catch(() => null);
          const msg = (body as { error?: string } | null)?.error || "Export failed";
          setState({ phase: "error", message: msg });
          return;
        }

        const result = (await response.json()) as {
          jobId: string;
          status: string;
          fileName: string | null;
          downloadUrl: string | null;
          error: string | null;
        };

        if (result.status === "failed") {
          setState({
            phase: "error",
            message: result.error || "Export failed",
          });
          return;
        }

        if (result.downloadUrl && result.fileName) {
          setState({
            phase: "complete",
            fileName: result.fileName,
            downloadUrl: result.downloadUrl,
            jobId: result.jobId,
          });

          // Trigger download automatically
          await triggerDownload(result.downloadUrl, result.fileName, token);
        } else {
          setState({ phase: "error", message: "Export completed but no download available" });
        }
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Export failed",
        });
      }
    },
    [projectId, activeChapterId, getToken, apiUrl],
  );

  const handleDismiss = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  const isExporting = state.phase === "exporting";

  return (
    <div className="relative" ref={menuRef}>
      {/* Export button */}
      <button
        onClick={() => {
          if (isExporting) return;
          setIsOpen(!isOpen);
        }}
        disabled={isExporting}
        className="h-9 px-3 text-sm rounded-lg hover:bg-gray-100 transition-colors min-w-[44px]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center gap-1.5"
        aria-label="Export"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Exporting...</span>
          </>
        ) : (
          "Export"
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          role="menu"
          aria-label="Export options"
        >
          <button
            onClick={() => handleExport("book", "pdf")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Export Book as PDF
          </button>

          <button
            onClick={() => handleExport("book", "epub")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Export Book as EPUB
          </button>

          <div className="border-t border-gray-100 my-1" role="separator" />

          <button
            onClick={() => handleExport("chapter", "pdf")}
            disabled={!activeChapterId}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export This Chapter as PDF
          </button>

          <button
            onClick={() => handleExport("chapter", "epub")}
            disabled={!activeChapterId}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors
                       min-h-[44px] flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-gray-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export This Chapter as EPUB
          </button>
        </div>
      )}

      {/* Status toast */}
      {state.phase === "complete" && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 shadow-lg z-50 max-w-sm">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 shrink-0 mt-0.5"
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
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">Export complete</p>
              <p className="text-xs text-green-600 truncate mt-0.5">{state.fileName}</p>
              <button
                onClick={async () => {
                  const token = await getToken();
                  if (token && state.phase === "complete") {
                    await triggerDownload(state.downloadUrl, state.fileName, token);
                  }
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                           text-green-700 bg-green-100 hover:bg-green-200 rounded-md
                           transition-colors min-h-[44px]"
                aria-label={`Download ${state.fileName}`}
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download
              </button>
            </div>
            <button
              onClick={handleDismiss}
              className="text-green-500 hover:text-green-700 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {state.phase === "error" && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 shadow-lg z-50 max-w-sm">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">Export failed</p>
              <p className="text-xs text-red-600 mt-0.5">{state.message}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-red-500 hover:text-red-700 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Trigger a file download by fetching the file with auth and creating a blob URL.
 *
 * Per US-022:
 * - Works on Safari (iPad), Chrome, and Firefox
 * - On iPad Safari, the file is saved to the Files app via the blob download
 * - Uses correct MIME type so the OS knows how to handle the file
 */
async function triggerDownload(
  downloadUrl: string,
  fileName: string,
  token: string,
): Promise<void> {
  try {
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    // Determine the correct MIME type from the response or file extension
    const contentType =
      response.headers.get("Content-Type") ||
      (fileName.endsWith(".epub") ? "application/epub+zip" : "application/pdf");

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    // Set type attribute to help Safari identify the file type
    link.type = contentType;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    // Cleanup after a delay to ensure the download has started
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    }, 5000);
  } catch {
    // Download trigger failed silently - user can still use the Download button
  }
}

export default ExportMenu;
