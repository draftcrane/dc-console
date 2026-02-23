"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useSources,
  type SourceMaterial,
  type SourceContentResult,
  type SearchResult,
  type SourceConnection,
  type AddSourceInput,
} from "@/hooks/use-sources";
import { useSourceAnalysis } from "@/hooks/use-source-analysis";
import { useAIInstructions, type AIInstruction } from "@/hooks/use-ai-instructions";
import { useSourcesPanel, type SourcesTab } from "@/hooks/use-sources-panel";
import { useDriveAccounts } from "@/hooks/use-drive-accounts";
import type { ChapterEditorHandle } from "@/components/editor/chapter-editor";

// ── Context Value Type ──

interface SourcesContextValue {
  // Panel state
  activeTab: SourcesTab;
  setActiveTab: (tab: SourcesTab) => void;
  selectedSourceId: string | null;
  selectSource: (sourceId: string | null) => void;
  openSourceReview: (sourceId: string) => void;
  openSourceAnalysis: (sourceId: string) => void;
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;

  // Sources data
  sources: SourceMaterial[];
  isLoadingSources: boolean;
  sourcesError: string | null;
  getContent: (sourceId: string) => Promise<SourceContentResult>;
  contentCache: Map<string, SourceContentResult>;
  addDriveSources: (files: AddSourceInput[], connectionId?: string) => Promise<void>;
  uploadLocalFile: (file: File) => Promise<void>;
  removeSource: (sourceId: string) => Promise<void>;
  restoreSource: (sourceId: string) => Promise<void>;
  refetchSources: () => Promise<void>;

  // Search
  searchResults: SearchResult[] | null;
  isSearching: boolean;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Connections
  connections: SourceConnection[];
  linkConnection: (driveConnectionId: string) => Promise<void>;
  unlinkConnection: (connectionId: string) => Promise<void>;

  // AI Analysis
  analyze: (projectId: string, sourceId: string, instruction: string) => void;
  analysisText: string;
  isAnalyzing: boolean;
  isAnalysisComplete: boolean;
  analysisError: string | null;
  resetAnalysis: () => void;
  abortAnalysis: () => void;

  // AI Instructions
  analysisInstructions: AIInstruction[];
  rewriteInstructions: AIInstruction[];
  isLoadingInstructions: boolean;
  createInstruction: (input: {
    label: string;
    instructionText: string;
    type: "analysis" | "rewrite";
  }) => Promise<AIInstruction>;
  updateInstruction: (
    id: string,
    input: { label?: string; instructionText?: string },
  ) => Promise<void>;
  removeInstruction: (id: string) => Promise<void>;

  // Drive OAuth (initiates Google OAuth — never shows user-level account data)
  connectDrive: (loginHint?: string, projectId?: string) => Promise<void>;

  // Editor ref (for content insertion)
  editorRef: React.RefObject<ChapterEditorHandle | null>;

  // Project ID
  projectId: string;
}

const SourcesContext = createContext<SourcesContextValue | null>(null);

// ── Provider ──

interface SourcesProviderProps {
  projectId: string;
  editorRef: React.RefObject<ChapterEditorHandle | null>;
  children: ReactNode;
}

export function SourcesProvider({ projectId, editorRef, children }: SourcesProviderProps) {
  // Compose all hooks
  const panel = useSourcesPanel();
  const sourcesData = useSources(projectId);
  const analysis = useSourceAnalysis();
  const analysisInstructions = useAIInstructions("analysis");
  const rewriteInstructions = useAIInstructions("rewrite");
  // Disable auto-fetch: user-level account data is NEVER surfaced in project UI.
  // We only need the connect function to initiate OAuth.
  const driveAccountsHook = useDriveAccounts({ enabled: false });

  const value: SourcesContextValue = {
    // Panel
    ...panel,

    // Sources
    sources: sourcesData.sources,
    isLoadingSources: sourcesData.isLoading,
    sourcesError: sourcesData.error,
    getContent: sourcesData.getContent,
    contentCache: sourcesData.contentCache,
    addDriveSources: sourcesData.addDriveSources,
    uploadLocalFile: sourcesData.uploadLocalFile,
    removeSource: sourcesData.removeSource,
    restoreSource: sourcesData.restoreSource,
    refetchSources: sourcesData.refetch,

    // Search
    searchResults: sourcesData.searchResults,
    isSearching: sourcesData.isSearching,
    search: sourcesData.search,
    clearSearch: sourcesData.clearSearch,

    // Connections
    connections: sourcesData.connections,
    linkConnection: sourcesData.linkConnection,
    unlinkConnection: sourcesData.unlinkConnection,

    // Analysis
    analyze: analysis.analyze,
    analysisText: analysis.streamingText,
    isAnalyzing: analysis.isStreaming,
    isAnalysisComplete: analysis.isComplete,
    analysisError: analysis.error,
    resetAnalysis: analysis.reset,
    abortAnalysis: analysis.abort,

    // Instructions
    analysisInstructions: analysisInstructions.instructions,
    rewriteInstructions: rewriteInstructions.instructions,
    isLoadingInstructions: analysisInstructions.isLoading || rewriteInstructions.isLoading,
    createInstruction: async (input) => {
      if (input.type === "analysis") {
        return analysisInstructions.create(input);
      }
      return rewriteInstructions.create(input);
    },
    updateInstruction: async (id, input) => {
      // Try both — only one will have the ID
      await Promise.allSettled([
        analysisInstructions.update(id, input),
        rewriteInstructions.update(id, input),
      ]);
    },
    removeInstruction: async (id) => {
      await Promise.allSettled([analysisInstructions.remove(id), rewriteInstructions.remove(id)]);
    },

    // Drive OAuth (initiates Google OAuth — never shows user-level account data)
    connectDrive: driveAccountsHook.connect,

    // Refs
    editorRef,
    projectId,
  };

  return <SourcesContext.Provider value={value}>{children}</SourcesContext.Provider>;
}

// ── Hook ──

export function useSourcesContext(): SourcesContextValue {
  const context = useContext(SourcesContext);
  if (!context) {
    throw new Error("useSourcesContext must be used within a SourcesProvider");
  }
  return context;
}
