"use client";

import { useState, useCallback, useEffect } from "react";
import { useSources, type SourceMaterial } from "./use-sources";
import { useSourceContent } from "./use-source-content";
import { useGooglePicker } from "./use-google-picker";

/**
 * Facade hook that wraps source-related hooks behind a single interface.
 * Follows the useProjectActions pattern to keep the editor page clean.
 */
export function useSourceActions(projectId: string) {
  // Underlying hooks
  const {
    sources,
    isLoading: isSourcesLoading,
    error: sourcesError,
    fetchSources,
    addSources,
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

  // Panel state
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceMaterial | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

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

  /** Open Google Picker and add selected files as sources */
  const addFromPicker = useCallback(async () => {
    const files = await openPicker();
    if (files.length > 0) {
      await addSources(files);
    }
  }, [openPicker, addSources]);

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
  const error = sourcesError || contentError || pickerError;

  return {
    // Source list
    sources,
    isSourcesLoading,

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

    // Actions
    addFromPicker,
    isPickerLoading,
    removeSource,
    importSourceAsChapter,

    // Error
    error,
  };
}
