"use client";

import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from "react";

// === State Types ===

export type ResearchTab = "sources" | "ask" | "clips";
export type SourcesView = "list" | "detail" | "add" | "provider-detail";

export interface ResearchPanelState {
  isOpen: boolean;
  activeTab: ResearchTab;
  sourcesView: SourcesView;
  activeSourceId: string | null;
  /** Active Drive connection ID — used by provider-detail and add flow */
  activeConnectionId: string | null;
  returnTab: "ask" | "clips" | null;
  /** Text to scroll to when viewing a source detail (from citation navigation) */
  scrollToText: string | null;
}

// === Actions ===

export type ResearchPanelAction =
  | { type: "OPEN_PANEL"; tab?: ResearchTab }
  | { type: "CLOSE_PANEL" }
  | { type: "SET_TAB"; tab: ResearchTab }
  | { type: "VIEW_SOURCE"; sourceId: string; returnTo?: "ask" | "clips"; scrollToText?: string }
  | { type: "BACK_TO_LIST" }
  | { type: "RETURN_TO_TAB" }
  | { type: "START_ADD_FLOW"; connectionId?: string }
  | { type: "VIEW_PROVIDER_DETAIL"; connectionId: string | null }
  | { type: "SET_DRIVE_CONNECTION"; connectionId: string }
  | { type: "FINISH_ADD" };

// === Initial State ===

const initialState: ResearchPanelState = {
  isOpen: false,
  activeTab: "sources",
  sourcesView: "list",
  activeSourceId: null,
  activeConnectionId: null,
  returnTab: null,
  scrollToText: null,
};

// === Reducer ===

/**
 * State machine reducer for the Research Panel.
 *
 * Valid states (7):
 *   1. Closed              - panel is not visible
 *   2. Sources-List        - panel open, sources tab, grouped list view
 *   3. Sources-Detail      - panel open, sources tab, viewing a specific source
 *   4. Sources-Add         - panel open, sources tab, add flow (drive browser / upload)
 *   5. Sources-ProviderDetail - panel open, sources tab, viewing docs from a single provider
 *   6. Ask                 - panel open, ask tab
 *   7. Clips               - panel open, clips tab
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
      // Valid from detail, add, or provider-detail views
      if (!state.isOpen || state.activeTab !== "sources") return state;
      if (
        state.sourcesView !== "detail" &&
        state.sourcesView !== "add" &&
        state.sourcesView !== "provider-detail"
      )
        return state;

      return {
        ...state,
        sourcesView: "list",
        activeSourceId: null,
        activeConnectionId: null,
        returnTab: null,
        scrollToText: null,
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

    case "START_ADD_FLOW": {
      // Can only start add flow when panel is open
      if (!state.isOpen) return state;

      return {
        ...state,
        activeTab: "sources",
        sourcesView: "add",
        activeSourceId: null,
        activeConnectionId: action.connectionId ?? null,
        returnTab: null,
      };
    }

    case "VIEW_PROVIDER_DETAIL": {
      if (!state.isOpen) return state;

      return {
        ...state,
        activeTab: "sources",
        sourcesView: "provider-detail",
        activeConnectionId: action.connectionId,
        activeSourceId: null,
        returnTab: null,
      };
    }

    case "SET_DRIVE_CONNECTION": {
      // Only valid during add flow
      if (!state.isOpen || state.sourcesView !== "add") return state;

      return {
        ...state,
        activeConnectionId: action.connectionId,
      };
    }

    case "FINISH_ADD": {
      // Only valid during add flow
      if (!state.isOpen || state.sourcesView !== "add") return state;

      return {
        ...state,
        sourcesView: "list",
        activeConnectionId: null,
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

  // Actions
  openPanel: (tab?: ResearchTab) => void;
  closePanel: () => void;
  setActiveTab: (tab: ResearchTab) => void;
  viewSource: (sourceId: string, returnTo?: "ask" | "clips", scrollToText?: string) => void;
  backToSourceList: () => void;
  returnToPreviousTab: () => void;
  startAddFlow: (connectionId?: string) => void;
  viewProviderDetail: (connectionId: string | null) => void;
  setDriveConnection: (connectionId: string) => void;
  finishAdd: () => void;

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

  const startAddFlow = useCallback(
    (connectionId?: string) => {
      dispatch({ type: "START_ADD_FLOW", connectionId });
    },
    [dispatch],
  );

  const viewProviderDetail = useCallback(
    (connectionId: string | null) => {
      dispatch({ type: "VIEW_PROVIDER_DETAIL", connectionId });
    },
    [dispatch],
  );

  const setDriveConnection = useCallback(
    (connectionId: string) => {
      dispatch({ type: "SET_DRIVE_CONNECTION", connectionId });
    },
    [dispatch],
  );

  const finishAdd = useCallback(() => {
    dispatch({ type: "FINISH_ADD" });
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

      // Actions
      openPanel,
      closePanel,
      setActiveTab,
      viewSource,
      backToSourceList,
      returnToPreviousTab,
      startAddFlow,
      viewProviderDetail,
      setDriveConnection,
      finishAdd,

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
      startAddFlow,
      viewProviderDetail,
      setDriveConnection,
      finishAdd,
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
