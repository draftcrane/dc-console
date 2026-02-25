"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSourcesContext } from "@/contexts/sources-context";
import { DriveBrowser } from "./drive-browser";
import { SourcePicker } from "./source-picker";
import { SourcesSection } from "./sources-section";
import { SourceDetailView } from "./review-tab";
import { DocumentPeekView } from "./document-peek-view";
import { EmptyState } from "./empty-state";
import { useToast } from "@/components/toast";
import type { SourceConnection } from "@/hooks/use-sources";
import type { DriveFile } from "@/hooks/use-drive-files";

type ViewMode = "browse" | "detail" | "connect" | "peek";

const SOURCE_LINK_KEY = "dc_pending_source_link";
const POST_OAUTH_CONNECTION_KEY = "dc_post_oauth_connection";

/**
 * Library tab - Source Manager with four view modes.
 *
 * browse:  Drive file browser (default when connected)
 * detail:  Source content viewer (entered from tapping a document)
 * connect: SourcePicker for new connections only
 *
 * CRITICAL: Uses project-scoped `connections` (from useSources), NOT user-level
 * `driveAccounts`. User-level accounts are NEVER fetched or displayed in project UI.
 *
 * Vocabulary: Source = provider, Folder = directory, Document = file.
 */
export function LibraryTab() {
  const {
    sources,
    isLoadingSources,
    connections,
    connectDrive,
    uploadLocalFile,
    addDriveSources,
    removeSource,
    projectId,
    detailSourceId,
    setDetailSourceId,
  } = useSourcesContext();
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [, setIsUploading] = useState(false);
  const [selectedConnectionIndex, setSelectedConnectionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [peekFile, setPeekFile] = useState<{
    fileId: string;
    fileName: string;
    mimeType: string;
    connectionId: string;
  } | null>(null);

  // Post-OAuth signal: read connection ID from sessionStorage on mount
  const [postOAuthConnectionId, setPostOAuthConnectionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(POST_OAUTH_CONNECTION_KEY);
    } catch {
      return null;
    }
  });

  // Show toast when post-OAuth signal is detected.
  // Immediately clear sessionStorage to prevent re-fire on remount.
  useEffect(() => {
    if (postOAuthConnectionId) {
      showToast("Google Drive connected");
      try {
        sessionStorage.removeItem(POST_OAUTH_CONNECTION_KEY);
      } catch {
        // ignore
      }
    }
  }, [postOAuthConnectionId, showToast]);

  // Auto-browse: when the post-OAuth connection appears in connections, switch to browse mode
  useEffect(() => {
    if (!postOAuthConnectionId) return;

    const matchIndex = connections.findIndex((c) => c.driveConnectionId === postOAuthConnectionId);
    if (matchIndex >= 0) {
      setSelectedConnectionIndex(matchIndex);
      setViewMode("browse");
      setPostOAuthConnectionId(null);
      try {
        sessionStorage.removeItem(POST_OAUTH_CONNECTION_KEY);
      } catch {
        // ignore
      }
      return;
    }

    // Safety timeout: clear stale signal after 10s if connection never arrives
    const timeout = setTimeout(() => {
      setPostOAuthConnectionId(null);
      try {
        sessionStorage.removeItem(POST_OAUTH_CONNECTION_KEY);
      } catch {
        // ignore
      }
    }, 10_000);
    return () => clearTimeout(timeout);
  }, [postOAuthConnectionId, connections]);

  // React to detailSourceId changes (e.g., from openSourceReview in other components)
  useEffect(() => {
    if (detailSourceId) {
      setViewMode("detail");
    }
  }, [detailSourceId]);

  // Determine which project-scoped connection to use for the Drive browser
  // CRITICAL: Use driveConnectionId for Drive API, NOT id (junction row)
  const safeIndex = Math.min(selectedConnectionIndex, Math.max(connections.length - 1, 0));
  const activeConnection = connections[safeIndex] ?? null;
  const activeConnectionId = activeConnection?.driveConnectionId ?? null;
  const activeAccountEmail = activeConnection?.email ?? null;

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        await uploadLocalFile(file);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsUploading(false);
        setViewMode("browse");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [uploadLocalFile],
  );

  const handleBrowseConnection = useCallback(
    (connection: SourceConnection) => {
      const index = connections.findIndex(
        (c) => c.driveConnectionId === connection.driveConnectionId,
      );
      setSelectedConnectionIndex(index >= 0 ? index : 0);
      setViewMode("browse");
    },
    [connections],
  );

  const handleSelectConnection = useCallback(
    (connection: SourceConnection) => {
      const index = connections.findIndex(
        (c) => c.driveConnectionId === connection.driveConnectionId,
      );
      setSelectedConnectionIndex(index >= 0 ? index : 0);
      setViewMode("browse");
    },
    [connections],
  );

  const handleUploadLocal = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Go straight to OAuth - no intermediate screen showing user-level account emails.
  // After OAuth return, the account is auto-linked to this project via pid in state.
  const handleConnectDriveOAuth = useCallback(() => {
    try {
      sessionStorage.setItem(SOURCE_LINK_KEY, projectId);
    } catch {
      // sessionStorage unavailable - pid fallback in OAuth state handles this
    }
    connectDrive(undefined, projectId);
  }, [connectDrive, projectId]);

  const handleBackToList = useCallback(() => {
    setViewMode("browse");
    setDetailSourceId(null);
  }, [setDetailSourceId]);

  const handleDocumentTap = useCallback(
    (file: DriveFile) => {
      if (!activeConnectionId) return;
      setPeekFile({
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        connectionId: activeConnectionId,
      });
      setViewMode("peek");
    },
    [activeConnectionId],
  );

  const handleBackToBrowse = useCallback(() => {
    setViewMode("browse");
    setPeekFile(null);
  }, []);

  // Tagged documents: driveFileIds that are on the Desk
  const taggedFileIds = useMemo(
    () =>
      new Set(
        sources.filter((s) => s.driveFileId && s.status === "active").map((s) => s.driveFileId!),
      ),
    [sources],
  );

  const handleTag = useCallback(
    async (file: DriveFile) => {
      if (!activeConnectionId) return;
      try {
        await addDriveSources(
          [{ driveFileId: file.id, title: file.name, mimeType: file.mimeType }],
          activeConnectionId,
        );
        showToast(`Added "${file.name}" to desk`);
      } catch (err) {
        console.error("Failed to tag document:", err);
      }
    },
    [addDriveSources, activeConnectionId, showToast],
  );

  const handleUntag = useCallback(
    async (file: DriveFile) => {
      const source = sources.find((s) => s.driveFileId === file.id && s.status === "active");
      if (!source) return;
      try {
        await removeSource(source.id);
        showToast(`Removed "${file.name}" from desk`);
      } catch (err) {
        console.error("Failed to untag document:", err);
      }
    },
    [sources, removeSource, showToast],
  );

  // Loading state
  if (isLoadingSources) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-sm text-[var(--dc-color-text-muted)]">Loading...</p>
      </div>
    );
  }

  // Hidden file input (always rendered for upload)
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".txt,.md,.pdf,.docx"
      onChange={handleUpload}
      className="hidden"
    />
  );

  // ── CONNECT MODE (source type picker for new connections) ──
  if (viewMode === "connect") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}
        <SourcePicker
          connections={connections}
          onSelectConnection={handleSelectConnection}
          onConnectDrive={handleConnectDriveOAuth}
          onUploadLocal={handleUploadLocal}
          onCancel={handleBackToList}
        />
      </div>
    );
  }

  // ── BROWSE MODE (default when connected) ──
  if (viewMode === "browse" && activeConnectionId) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}

        {/* Connection header */}
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M7.71 3.5L1.15 15l3.43 5.99L11.01 9.5 7.71 3.5zm1.14 0l6.87 12H22.86l-3.43-6-6.87-12H8.85l-.01 0 .01-.01zm6.88 12.01H2.58l3.43 6h13.15l-3.43-6z"
              className="text-blue-500"
            />
          </svg>

          {connections.length === 1 ? (
            <span className="text-xs text-[var(--dc-color-text-secondary)] truncate flex-1">
              {activeAccountEmail}
            </span>
          ) : (
            <>
              <label htmlFor="browse-account-picker" className="sr-only">
                Source
              </label>
              <select
                id="browse-account-picker"
                value={safeIndex}
                onChange={(e) => setSelectedConnectionIndex(Number(e.target.value))}
                className="text-xs text-[var(--dc-color-text-secondary)] bg-white border border-gray-200 rounded-md
                           px-2 py-1.5 min-h-[32px] flex-1 truncate"
              >
                {connections.map((connection, i) => (
                  <option key={connection.driveConnectionId} value={i}>
                    {connection.email}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Drive contents */}
        <DriveBrowser
          connectionId={activeConnectionId}
          onReconnect={() => connectDrive(activeAccountEmail ?? undefined)}
          rootLabel={activeAccountEmail ?? undefined}
          accountEmail={activeAccountEmail ?? ""}
          onDocumentTap={handleDocumentTap}
          taggedFileIds={taggedFileIds}
          onTag={handleTag}
          onUntag={handleUntag}
        />

        {/* Footer: manage connections */}
        <SourcesSection
          onBrowseConnection={handleBrowseConnection}
          onAddSource={() => setViewMode("connect")}
        />
      </div>
    );
  }

  // ── PEEK MODE (live Drive document preview) ──
  if (viewMode === "peek" && peekFile) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}
        <DocumentPeekView
          fileId={peekFile.fileId}
          fileName={peekFile.fileName}
          mimeType={peekFile.mimeType}
          connectionId={peekFile.connectionId}
          onBack={handleBackToBrowse}
        />
      </div>
    );
  }

  // ── DETAIL MODE (source content viewer, inline) ──
  if (viewMode === "detail" && detailSourceId) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fileInput}
        <SourceDetailView onBack={handleBackToList} />
      </div>
    );
  }

  // ── NO CONNECTIONS (fallback) ──
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {fileInput}
      <EmptyState
        icon={
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        }
        message="Add documents to reference while you write."
        description="Your originals are never changed."
        action={{ label: "Add Source", onClick: () => setViewMode("connect") }}
      />
    </div>
  );
}
