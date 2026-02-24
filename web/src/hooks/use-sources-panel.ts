"use client";

import { useState, useCallback } from "react";

export type SourcesTab = "library" | "review" | "assist";

interface UseSourcesPanelReturn {
  activeTab: SourcesTab;
  setActiveTab: (tab: SourcesTab) => void;
  selectedSourceId: string | null;
  selectSource: (sourceId: string | null) => void;
  detailSourceId: string | null;
  setDetailSourceId: (sourceId: string | null) => void;
  openSourceReview: (sourceId: string) => void;
  openSourceAnalysis: (sourceId: string) => void;
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

/**
 * Panel UI state hook - pure state, no API calls.
 * Manages tab selection, source selection, detail view, and panel visibility.
 */
export function useSourcesPanel(): UseSourcesPanelReturn {
  const [activeTab, setActiveTab] = useState<SourcesTab>("library");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [detailSourceId, setDetailSourceId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const selectSource = useCallback((sourceId: string | null) => {
    setSelectedSourceId(sourceId);
  }, []);

  const openSourceReview = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
    setDetailSourceId(sourceId);
    setActiveTab("library");
    setIsPanelOpen(true);
  }, []);

  const openSourceAnalysis = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
    setActiveTab("assist");
    setIsPanelOpen(true);
  }, []);

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return {
    activeTab,
    setActiveTab,
    selectedSourceId,
    selectSource,
    detailSourceId,
    setDetailSourceId,
    openSourceReview,
    openSourceAnalysis,
    isPanelOpen,
    togglePanel,
    openPanel,
    closePanel,
  };
}
