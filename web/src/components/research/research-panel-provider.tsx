"use client";

import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from "react";

// === State Types ===

export type ResearchTab = "sources" | "ask" | "clips";
export type SourcesView = "list" | "detail" | "add-document";
export type AddMode = "link-folder" | "add-documents" | null;

export interface ResearchPanelState {
  isOpen: boolean;
  activeTab: ResearchTab;
  sourcesView: SourcesView;
  activeSourceId: string | null;
  /** Active Drive connection ID — used by add-document flow for pre-selection */
  activeConnectionId: string | null;
  returnTab: "ask" | "clips" | null;
  /** Text to scroll to when viewing a source detail (from citation navigation) */
  scrollToText: string | null;
  /** Distinguishes link-folder from add-documents in the add-document flow */
  addMode: AddMode;
}

// === Actions ===

export type ResearchPanelAction =
  | { type: "OPEN_PANEL"; tab?: ResearchTab }
  | { type: "CLOSE_PANEL" }
  | { type: "SET_TAB"; tab: ResearchTab }
  | { type: "VIEW_SOURCE"; sourceId: string; returnTo?: "ask" | "clips"; scrollToText?: string }
  | { type: "BACK_TO_LIST" }
  | { type: "RETURN_TO_TAB" }
  | { type: "START_ADD_DOCUMENT"; connectionId?: string }
  | { type: "START_LINK_FOLDER"; connectionId?: string }
  | { type: "SET_DRIVE_CONNECTION"; connectionId: string }
  | { type: "FINISH_FLOW" };

// === Initial State ===

const initialState: ResearchPanelState = {
  isOpen: false,
  activeTab: "sources",
  sourcesView: "list",
  activeSourceId: null,
  activeConnectionId: null,
  returnTab: null,
  scrollToText: null,
  addMode: null,
};

// === Reducer ===

/**
 * State machine reducer for the Research Panel.
 *
 * Valid states (6):
 *   1. Closed              - panel is not visible
 *   2. Sources-List        - panel open, sources tab, two-section list view
 *   3. Sources-Detail      - panel open, sources tab, viewing a specific source
 *   4. Sources-AddDocument - panel open, sources tab, add document flow (drive browser / upload)
 *   5. Ask                 - panel open, ask tab
 *   6. Clips               - panel open, clips tab
 *
 * Invalid transitions are prevented by returning current state unchanged.
 */
export function researchPanelReducer(
  state: ResearchPanelState,
  action: ResearchPanelAction,
): ResearchPanelState {
  switch (action.type) {
    case "OPEN_PANEL": {
      const tab = action.tab ?? "sources";
      return {
        ...state,
        isOpen: true,
        activeTab: tab,
        // Reset sources sub-view when opening to sources tab
        sourcesView: tab === "sources" ? "list" : state.sourcesView,
        activeSourceId: tab === "sources" ? null : state.activeSourceId,
        returnTab: null,
        scrollToText: null,
      };
    }

    case "CLOSE_PANEL": {
      return {
        ...initialState,
      };
    }

    case "SET_TAB": {
      // Can only switch tabs when the panel is open
      if (!state.isOpen) return state;

      return {
        ...state,
        activeTab: action.tab,
        // Reset sources sub-view when switching to sources tab
        sourcesView: action.tab === "sources" ? "list" : state.sourcesView,
        activeSourceId: action.tab === "sources" ? null : state.activeSourceId,
        returnTab: null,
      };
    }

    case "VIEW_SOURCE": {
      // Can only view a source when the panel is open
      if (!state.isOpen) return state;

      return {
        ...state,
        activeTab: "sources",
        sourcesView: "detail",
        activeSourceId: action.sourceId,
        returnTab: action.returnTo ?? null,
        scrollToText: action.scrollToText ?? null,
      };
    }

    case "BACK_TO_LIST": {
      // Valid from detail or add-document views
      if (!state.isOpen || state.activeTab !== "sources") return state;
      if (state.sourcesView !== "detail" && state.sourcesView !== "add-document") return state;

      return {
        ...state,
        sourcesView: "list",
        activeSourceId: null,
        activeConnectionId: null,
        returnTab: null,
        scrollToText: null,
        addMode: null,
      };
    }

    case "RETURN_TO_TAB": {
      // Only valid when viewing a source with a return tab set
      if (!state.isOpen || !state.returnTab) return state;

      const tab = state.returnTab;
      return {
        ...state,
        activeTab: tab,
        sourcesView: "list",
        activeSourceId: null,
        returnTab: null,
        scrollToText: null,
      };
    }

    case "START_ADD_DOCUMENT": {
      // Can only start add document flow when panel is open
      if (!state.isOpen) return state;

      return {
        ...state,
        activeTab: "sources",
        sourcesView: "add-document",
        activeSourceId: null,
        activeConnectionId: action.connectionId ?? null,
        returnTab: null,
        addMode: "add-documents",
      };
    }

    case "START_LINK_FOLDER": {
      // Can only start link folder flow when panel is open
      if (!state.isOpen) return state;

      return {
        ...state,
        activeTab: "sources",
        sourcesView: "add-document",
        activeSourceId: null,
        activeConnectionId: action.connectionId ?? null,
        returnTab: null,
        addMode: "link-folder",
      };
    }

    case "SET_DRIVE_CONNECTION": {
      // Only valid during add-document flow
      if (!state.isOpen || state.sourcesView !== "add-document") return state;

      return {
        ...state,
        activeConnectionId: action.connectionId,
      };
    }

    case "FINISH_FLOW": {
      // Valid during add-document flow
      if (!state.isOpen) return state;
      if (state.sourcesView !== "add-document") return state;

      return {
        ...state,
        sourcesView: "list",
        activeConnectionId: null,
        addMode: null,
      };
    }

    default:
      return state;
  }
}

// === Context ===

export interface ResearchPanelContextValue {
  // Panel state
  isOpen: boolean;
  activeTab: ResearchTab;
  sourcesView: SourcesView;
  activeSourceId: string | null;
  activeConnectionId: string | null;
  returnTab: "ask" | "clips" | null;
  scrollToText: string | null;
  addMode: AddMode;

  // Actions
  openPanel: (tab?: ResearchTab) => void;
  closePanel: () => void;
  setActiveTab: (tab: ResearchTab) => void;
  viewSource: (sourceId: string, returnTo?: "ask" | "clips", scrollToText?: string) => void;
  backToSourceList: () => void;
  returnToPreviousTab: () => void;
  startAddDocument: (connectionId?: string) => void;
  startLinkFolder: (connectionId?: string) => void;
  setDriveConnection: (connectionId: string) => void;
  finishFlow: () => void;

  // Raw dispatch for testing or advanced usage
  dispatch: React.Dispatch<ResearchPanelAction>;
}

const ResearchPanelContext = createContext<ResearchPanelContextValue | null>(null);

// === Provider ===

interface ResearchPanelProviderProps {
  children: ReactNode;
}

export function ResearchPanelProvider({ children }: ResearchPanelProviderProps) {
  const [state, dispatch] = useReducer(researchPanelReducer, initialState);

  const openPanel = useCallback(
    (tab?: ResearchTab) => {
      dispatch({ type: "OPEN_PANEL", tab });
    },
    [dispatch],
  );

  const closePanel = useCallback(() => {
    dispatch({ type: "CLOSE_PANEL" });
  }, [dispatch]);

  const setActiveTab = useCallback(
    (tab: ResearchTab) => {
      dispatch({ type: "SET_TAB", tab });
    },
    [dispatch],
  );

  const viewSource = useCallback(
    (sourceId: string, returnTo?: "ask" | "clips", scrollToText?: string) => {
      dispatch({ type: "VIEW_SOURCE", sourceId, returnTo, scrollToText });
    },
    [dispatch],
  );

  const backToSourceList = useCallback(() => {
    dispatch({ type: "BACK_TO_LIST" });
  }, [dispatch]);

  const returnToPreviousTab = useCallback(() => {
    dispatch({ type: "RETURN_TO_TAB" });
  }, [dispatch]);

  const startAddDocument = useCallback(
    (connectionId?: string) => {
      dispatch({ type: "START_ADD_DOCUMENT", connectionId });
    },
    [dispatch],
  );

  const startLinkFolder = useCallback(
    (connectionId?: string) => {
      dispatch({ type: "START_LINK_FOLDER", connectionId });
    },
    [dispatch],
  );

  const setDriveConnection = useCallback(
    (connectionId: string) => {
      dispatch({ type: "SET_DRIVE_CONNECTION", connectionId });
    },
    [dispatch],
  );

  const finishFlow = useCallback(() => {
    dispatch({ type: "FINISH_FLOW" });
  }, [dispatch]);

  const value = useMemo<ResearchPanelContextValue>(
    () => ({
      // State
      isOpen: state.isOpen,
      activeTab: state.activeTab,
      sourcesView: state.sourcesView,
      activeSourceId: state.activeSourceId,
      activeConnectionId: state.activeConnectionId,
      returnTab: state.returnTab,
      scrollToText: state.scrollToText,
      addMode: state.addMode,

      // Actions
      openPanel,
      closePanel,
      setActiveTab,
      viewSource,
      backToSourceList,
      returnToPreviousTab,
      startAddDocument,
      startLinkFolder,
      setDriveConnection,
      finishFlow,

      // Raw dispatch
      dispatch,
    }),
    [
      state,
      openPanel,
      closePanel,
      setActiveTab,
      viewSource,
      backToSourceList,
      returnToPreviousTab,
      startAddDocument,
      startLinkFolder,
      setDriveConnection,
      finishFlow,
    ],
  );

  return <ResearchPanelContext.Provider value={value}>{children}</ResearchPanelContext.Provider>;
}

// === Hook ===

/**
 * Access the Research Panel state and actions.
 * Must be used within a ResearchPanelProvider.
 */
export function useResearchPanel(): ResearchPanelContextValue {
  const context = useContext(ResearchPanelContext);
  if (!context) {
    throw new Error("useResearchPanel must be used within a ResearchPanelProvider");
  }
  return context;
}
