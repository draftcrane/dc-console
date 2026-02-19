"use client";

import { useState, useCallback, useEffect } from "react";
import { useSources, type SourceMaterial } from "./use-sources";
import { useSourceContent } from "./use-source-content";
import { useGooglePicker } from "./use-google-picker";
import { useDriveBrowser } from "./use-drive-browser";

/**
 * Facade hook that wraps source-related hooks behind a single interface.
 * Follows the useProjectActions pattern to keep the editor page clean.
 *
 * Expanded for multi-account: addFromPicker accepts connectionId.
 * Expanded for local upload: uploadLocalFile wraps useSources.
 */
export function useSourceActions(projectId: string) {
  // Underlying hooks
  const {
    sources,
    isLoading: isSourcesLoading,
    error: sourcesError,
    fetchSources,
    addSources,
    uploadLocalFile: uploadLocal,
    removeSource,
    importAsChapter,
  } = useSources(projectId);

  const {
    content: viewerContent,
    wordCount: viewerWordCount,
    isLoading: isContentLoading,
    error: contentError,
    fetchContent,
    reset: resetContent,
  } = useSourceContent();

  const {
    openPicker,
    isLoading: isPickerLoading,
    error: pickerError,
    resetError: resetPickerError,
  } = useGooglePicker();

  const {
    items: driveItems,
    isLoading: isDriveLoading,
    error: driveError,
    canGoBack: driveCanGoBack,
    openRoot: openDriveRoot,
    openFolder: openDriveFolder,
    goBack: driveGoBack,
    isDoc: isDriveDoc,
    isFolder: isDriveFolder,
  } = useDriveBrowser();

  // Panel state
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceMaterial | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  // Add source sheet state
  const [isAddSourceSheetOpen, setIsAddSourceSheetOpen] = useState(false);
  const [isDriveBrowserOpen, setIsDriveBrowserOpen] = useState(false);
  const [driveConnectionId, setDriveConnectionId] = useState<string | undefined>(undefined);

  // Fetch sources when panel opens
  useEffect(() => {
    if (isSourcesPanelOpen) {
      fetchSources();
    }
  }, [isSourcesPanelOpen, fetchSources]);

  const openSourcesPanel = useCallback(() => {
    resetPickerError();
    setIsSourcesPanelOpen(true);
  }, [resetPickerError]);

  const closeSourcesPanel = useCallback(() => {
    setIsSourcesPanelOpen(false);
    setIsViewerOpen(false);
    setActiveSource(null);
    resetContent();
    resetPickerError();
    setIsDriveBrowserOpen(false);
  }, [resetContent, resetPickerError]);

  const openSourceViewer = useCallback(
    (source: SourceMaterial) => {
      setActiveSource(source);
      setIsViewerOpen(true);
      fetchContent(source.id);
    },
    [fetchContent],
  );

  const closeSourceViewer = useCallback(() => {
    setIsViewerOpen(false);
    setActiveSource(null);
    resetContent();
  }, [resetContent]);

  /** Open Google Picker for a specific Drive connection and add selected files */
  const addFromPicker = useCallback(
    async (connectionId?: string) => {
      const files = await openPicker(connectionId);
      if (files.length > 0) {
        await addSources(files, connectionId);
      }
    },
    [openPicker, addSources],
  );

  const openDriveBrowser = useCallback(
    async (connectionId?: string) => {
      setDriveConnectionId(connectionId);
      setIsDriveBrowserOpen(true);
      await openDriveRoot(connectionId);
    },
    [openDriveRoot],
  );

  const closeDriveBrowser = useCallback(() => {
    setIsDriveBrowserOpen(false);
  }, []);

  const addFromDriveBrowser = useCallback(
    async (files: Array<{ id: string; name: string; mimeType: string }>) => {
      if (files.length === 0) return;
      const pickerFiles = files.map((file) => ({
        driveFileId: file.id,
        title: file.name,
        mimeType: file.mimeType,
      }));
      await addSources(pickerFiles, driveConnectionId);
    },
    [addSources, driveConnectionId],
  );

  /** Upload a local file (.txt, .md) as a source */
  const uploadLocalFile = useCallback(
    async (file: File) => {
      await uploadLocal(file);
    },
    [uploadLocal],
  );

  /** Import source as chapter and return the new chapter ID */
  const importSourceAsChapter = useCallback(
    async (sourceId: string) => {
      const result = await importAsChapter(sourceId);
      if (result) {
        setIsViewerOpen(false);
        setActiveSource(null);
        resetContent();
      }
      return result;
    },
    [importAsChapter, resetContent],
  );

  // Aggregate error
  const error = sourcesError || contentError || pickerError || driveError;

  return {
    // Source list
    sources,
    isSourcesLoading,
    fetchSources,

    // Panel state
    isSourcesPanelOpen,
    openSourcesPanel,
    closeSourcesPanel,

    // Viewer state
    isViewerOpen,
    activeSource,
    viewerContent,
    viewerWordCount,
    isContentLoading,
    openSourceViewer,
    closeSourceViewer,

    // Add source sheet
    isAddSourceSheetOpen,
    openAddSourceSheet: () => setIsAddSourceSheetOpen(true),
    closeAddSourceSheet: () => setIsAddSourceSheetOpen(false),

    // Actions
    addFromPicker,
    uploadLocalFile,
    isPickerLoading,
    removeSource,
    importSourceAsChapter,
    // Drive browser
    isDriveBrowserOpen,
    openDriveBrowser,
    closeDriveBrowser,
    driveItems,
    isDriveLoading,
    driveCanGoBack,
    driveGoBack,
    openDriveFolder,
    addFromDriveBrowser,
    isDriveDoc,
    isDriveFolder,
    driveError,

    // Error (aggregated for panels that show any source-related error)
    error,
    // Content-specific error (isolated for the viewer so stale panel errors don't suppress content)
    contentError,
  };
}
