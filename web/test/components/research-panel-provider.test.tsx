import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import {
  researchPanelReducer,
  ResearchPanelProvider,
  useResearchPanel,
  type ResearchPanelState,
  type ResearchPanelAction,
} from "@/components/research/research-panel-provider";

// ============================================================
// Unit tests for researchPanelReducer (state machine logic)
// ============================================================

describe("researchPanelReducer", () => {
  const closedState: ResearchPanelState = {
    isOpen: false,
    activeTab: "sources",
    sourcesView: "list",
    activeSourceId: null,
    activeConnectionId: null,
    returnTab: null,
    scrollToText: null,
  };

  const sourcesListState: ResearchPanelState = {
    isOpen: true,
    activeTab: "sources",
    sourcesView: "list",
    activeSourceId: null,
    activeConnectionId: null,
    returnTab: null,
    scrollToText: null,
  };

  const sourcesDetailState: ResearchPanelState = {
    isOpen: true,
    activeTab: "sources",
    sourcesView: "detail",
    activeSourceId: "src-1",
    activeConnectionId: null,
    returnTab: null,
    scrollToText: null,
  };

  const addDocumentState: ResearchPanelState = {
    isOpen: true,
    activeTab: "sources",
    sourcesView: "add-document",
    activeSourceId: null,
    activeConnectionId: null,
    returnTab: null,
    scrollToText: null,
  };

  const askState: ResearchPanelState = {
    isOpen: true,
    activeTab: "ask",
    sourcesView: "list",
    activeSourceId: null,
    activeConnectionId: null,
    returnTab: null,
    scrollToText: null,
  };

  const clipsState: ResearchPanelState = {
    isOpen: true,
    activeTab: "clips",
    sourcesView: "list",
    activeSourceId: null,
    activeConnectionId: null,
    returnTab: null,
    scrollToText: null,
  };

  // --- OPEN_PANEL ---

  describe("OPEN_PANEL", () => {
    it("opens to sources tab by default", () => {
      const result = researchPanelReducer(closedState, { type: "OPEN_PANEL" });
      expect(result.isOpen).toBe(true);
      expect(result.activeTab).toBe("sources");
      expect(result.sourcesView).toBe("list");
    });

    it("opens to a specified tab", () => {
      const result = researchPanelReducer(closedState, {
        type: "OPEN_PANEL",
        tab: "ask",
      });
      expect(result.isOpen).toBe(true);
      expect(result.activeTab).toBe("ask");
    });

    it("opens to clips tab", () => {
      const result = researchPanelReducer(closedState, {
        type: "OPEN_PANEL",
        tab: "clips",
      });
      expect(result.isOpen).toBe(true);
      expect(result.activeTab).toBe("clips");
    });

    it("clears returnTab when opening", () => {
      const stateWithReturn: ResearchPanelState = {
        ...closedState,
        returnTab: "ask",
      };
      const result = researchPanelReducer(stateWithReturn, { type: "OPEN_PANEL" });
      expect(result.returnTab).toBeNull();
    });

    it("resets sources sub-view when opening to sources tab", () => {
      const stateWithDetail: ResearchPanelState = {
        ...closedState,
        sourcesView: "detail",
        activeSourceId: "old-src",
      };
      const result = researchPanelReducer(stateWithDetail, {
        type: "OPEN_PANEL",
        tab: "sources",
      });
      expect(result.sourcesView).toBe("list");
      expect(result.activeSourceId).toBeNull();
    });
  });

  // --- CLOSE_PANEL ---

  describe("CLOSE_PANEL", () => {
    it("resets all state to initial", () => {
      const result = researchPanelReducer(sourcesDetailState, { type: "CLOSE_PANEL" });
      expect(result).toEqual(closedState);
    });

    it("resets from ask state", () => {
      const result = researchPanelReducer(askState, { type: "CLOSE_PANEL" });
      expect(result.isOpen).toBe(false);
      expect(result.activeTab).toBe("sources");
      expect(result.returnTab).toBeNull();
    });
  });

  // --- SET_TAB ---

  describe("SET_TAB", () => {
    it("switches to ask tab", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "SET_TAB",
        tab: "ask",
      });
      expect(result.activeTab).toBe("ask");
      expect(result.returnTab).toBeNull();
    });

    it("switches to clips tab", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "SET_TAB",
        tab: "clips",
      });
      expect(result.activeTab).toBe("clips");
    });

    it("switches back to sources tab and resets sub-view", () => {
      const result = researchPanelReducer(askState, {
        type: "SET_TAB",
        tab: "sources",
      });
      expect(result.activeTab).toBe("sources");
      expect(result.sourcesView).toBe("list");
      expect(result.activeSourceId).toBeNull();
    });

    it("is a no-op when panel is closed", () => {
      const result = researchPanelReducer(closedState, {
        type: "SET_TAB",
        tab: "ask",
      });
      expect(result).toEqual(closedState);
    });

    it("clears returnTab when switching tabs", () => {
      const stateWithReturn: ResearchPanelState = {
        ...sourcesDetailState,
        returnTab: "ask",
      };
      const result = researchPanelReducer(stateWithReturn, {
        type: "SET_TAB",
        tab: "clips",
      });
      expect(result.returnTab).toBeNull();
    });
  });

  // --- VIEW_SOURCE ---

  describe("VIEW_SOURCE", () => {
    it("navigates to source detail from sources list", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "VIEW_SOURCE",
        sourceId: "src-42",
      });
      expect(result.activeTab).toBe("sources");
      expect(result.sourcesView).toBe("detail");
      expect(result.activeSourceId).toBe("src-42");
      expect(result.returnTab).toBeNull();
    });

    it("navigates to source detail from ask tab with return", () => {
      const result = researchPanelReducer(askState, {
        type: "VIEW_SOURCE",
        sourceId: "src-42",
        returnTo: "ask",
      });
      expect(result.activeTab).toBe("sources");
      expect(result.sourcesView).toBe("detail");
      expect(result.activeSourceId).toBe("src-42");
      expect(result.returnTab).toBe("ask");
    });

    it("navigates to source detail from clips tab with return", () => {
      const result = researchPanelReducer(clipsState, {
        type: "VIEW_SOURCE",
        sourceId: "src-42",
        returnTo: "clips",
      });
      expect(result.activeTab).toBe("sources");
      expect(result.sourcesView).toBe("detail");
      expect(result.returnTab).toBe("clips");
    });

    it("stores scrollToText when provided", () => {
      const result = researchPanelReducer(askState, {
        type: "VIEW_SOURCE",
        sourceId: "src-42",
        returnTo: "ask",
        scrollToText: "psychological safety",
      });
      expect(result.scrollToText).toBe("psychological safety");
    });

    it("sets scrollToText to null when not provided", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "VIEW_SOURCE",
        sourceId: "src-42",
      });
      expect(result.scrollToText).toBeNull();
    });

    it("is a no-op when panel is closed", () => {
      const result = researchPanelReducer(closedState, {
        type: "VIEW_SOURCE",
        sourceId: "src-42",
      });
      expect(result).toEqual(closedState);
    });
  });

  // --- BACK_TO_LIST ---

  describe("BACK_TO_LIST", () => {
    it("returns to list from detail view", () => {
      const result = researchPanelReducer(sourcesDetailState, {
        type: "BACK_TO_LIST",
      });
      expect(result.sourcesView).toBe("list");
      expect(result.activeSourceId).toBeNull();
      expect(result.returnTab).toBeNull();
      expect(result.scrollToText).toBeNull();
    });

    it("clears scrollToText when going back to list", () => {
      const stateWithScroll: ResearchPanelState = {
        ...sourcesDetailState,
        scrollToText: "some text",
      };
      const result = researchPanelReducer(stateWithScroll, {
        type: "BACK_TO_LIST",
      });
      expect(result.scrollToText).toBeNull();
    });

    it("returns to list from add-document view", () => {
      const addWithConnection: ResearchPanelState = {
        ...addDocumentState,
        activeConnectionId: "conn-1",
      };
      const result = researchPanelReducer(addWithConnection, {
        type: "BACK_TO_LIST",
      });
      expect(result.sourcesView).toBe("list");
      expect(result.activeConnectionId).toBeNull();
    });

    it("is a no-op when already on list view", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "BACK_TO_LIST",
      });
      expect(result).toEqual(sourcesListState);
    });

    it("is a no-op when panel is closed", () => {
      const result = researchPanelReducer(closedState, {
        type: "BACK_TO_LIST",
      });
      expect(result).toEqual(closedState);
    });

    it("is a no-op when on a different tab", () => {
      const result = researchPanelReducer(askState, {
        type: "BACK_TO_LIST",
      });
      expect(result).toEqual(askState);
    });
  });

  // --- RETURN_TO_TAB ---

  describe("RETURN_TO_TAB", () => {
    it("returns to ask tab from source detail", () => {
      const stateWithReturn: ResearchPanelState = {
        ...sourcesDetailState,
        returnTab: "ask",
      };
      const result = researchPanelReducer(stateWithReturn, {
        type: "RETURN_TO_TAB",
      });
      expect(result.activeTab).toBe("ask");
      expect(result.sourcesView).toBe("list");
      expect(result.activeSourceId).toBeNull();
      expect(result.returnTab).toBeNull();
      expect(result.scrollToText).toBeNull();
    });

    it("returns to clips tab from source detail", () => {
      const stateWithReturn: ResearchPanelState = {
        ...sourcesDetailState,
        returnTab: "clips",
      };
      const result = researchPanelReducer(stateWithReturn, {
        type: "RETURN_TO_TAB",
      });
      expect(result.activeTab).toBe("clips");
      expect(result.returnTab).toBeNull();
    });

    it("is a no-op when no returnTab is set", () => {
      const result = researchPanelReducer(sourcesDetailState, {
        type: "RETURN_TO_TAB",
      });
      expect(result).toEqual(sourcesDetailState);
    });

    it("is a no-op when panel is closed", () => {
      const result = researchPanelReducer(closedState, {
        type: "RETURN_TO_TAB",
      });
      expect(result).toEqual(closedState);
    });
  });

  // --- START_ADD_DOCUMENT ---

  describe("START_ADD_DOCUMENT", () => {
    it("enters add-document flow from sources list", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "START_ADD_DOCUMENT",
      });
      expect(result.activeTab).toBe("sources");
      expect(result.sourcesView).toBe("add-document");
      expect(result.activeSourceId).toBeNull();
    });

    it("enters add-document flow from ask tab (switches to sources)", () => {
      const result = researchPanelReducer(askState, {
        type: "START_ADD_DOCUMENT",
      });
      expect(result.activeTab).toBe("sources");
      expect(result.sourcesView).toBe("add-document");
    });

    it("stores connectionId when provided (from source row tap)", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "START_ADD_DOCUMENT",
        connectionId: "conn-42",
      });
      expect(result.sourcesView).toBe("add-document");
      expect(result.activeConnectionId).toBe("conn-42");
    });

    it("sets activeConnectionId to null when no connectionId provided", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "START_ADD_DOCUMENT",
      });
      expect(result.sourcesView).toBe("add-document");
      expect(result.activeConnectionId).toBeNull();
    });

    it("is a no-op when panel is closed", () => {
      const result = researchPanelReducer(closedState, {
        type: "START_ADD_DOCUMENT",
      });
      expect(result).toEqual(closedState);
    });
  });

  // --- SET_DRIVE_CONNECTION ---

  describe("SET_DRIVE_CONNECTION", () => {
    it("sets drive connection during add-document flow", () => {
      const result = researchPanelReducer(addDocumentState, {
        type: "SET_DRIVE_CONNECTION",
        connectionId: "conn-123",
      });
      expect(result.activeConnectionId).toBe("conn-123");
    });

    it("is a no-op when not in add-document flow", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "SET_DRIVE_CONNECTION",
        connectionId: "conn-123",
      });
      expect(result).toEqual(sourcesListState);
    });

    it("is a no-op when panel is closed", () => {
      const result = researchPanelReducer(closedState, {
        type: "SET_DRIVE_CONNECTION",
        connectionId: "conn-123",
      });
      expect(result).toEqual(closedState);
    });
  });

  // --- FINISH_FLOW ---

  describe("FINISH_FLOW", () => {
    it("returns to list from add-document flow", () => {
      const addWithConnection: ResearchPanelState = {
        ...addDocumentState,
        activeConnectionId: "conn-123",
      };
      const result = researchPanelReducer(addWithConnection, {
        type: "FINISH_FLOW",
      });
      expect(result.sourcesView).toBe("list");
      expect(result.activeConnectionId).toBeNull();
    });

    it("is a no-op when not in a flow", () => {
      const result = researchPanelReducer(sourcesListState, {
        type: "FINISH_FLOW",
      });
      expect(result).toEqual(sourcesListState);
    });

    it("is a no-op when panel is closed", () => {
      const result = researchPanelReducer(closedState, {
        type: "FINISH_FLOW",
      });
      expect(result).toEqual(closedState);
    });
  });

  // --- State machine invariants ---

  describe("state machine invariants", () => {
    it("always has exactly one of the 6 valid states", () => {
      // Define all valid state combinations
      const isValidState = (s: ResearchPanelState): boolean => {
        if (!s.isOpen) return true; // State 1: Closed
        if (s.activeTab === "sources" && s.sourcesView === "list") return true; // State 2: Sources-List
        if (s.activeTab === "sources" && s.sourcesView === "detail" && s.activeSourceId !== null)
          return true; // State 3: Sources-Detail
        if (s.activeTab === "sources" && s.sourcesView === "add-document") return true; // State 4: Sources-AddDocument
        if (s.activeTab === "ask") return true; // State 5: Ask
        if (s.activeTab === "clips") return true; // State 6: Clips
        return false;
      };

      // Run through all actions from all valid starting states
      const states = [
        closedState,
        sourcesListState,
        sourcesDetailState,
        addDocumentState,
        askState,
        clipsState,
      ];

      const actions: ResearchPanelAction[] = [
        { type: "OPEN_PANEL" },
        { type: "OPEN_PANEL", tab: "sources" },
        { type: "OPEN_PANEL", tab: "ask" },
        { type: "OPEN_PANEL", tab: "clips" },
        { type: "CLOSE_PANEL" },
        { type: "SET_TAB", tab: "sources" },
        { type: "SET_TAB", tab: "ask" },
        { type: "SET_TAB", tab: "clips" },
        { type: "VIEW_SOURCE", sourceId: "src-1" },
        { type: "VIEW_SOURCE", sourceId: "src-1", returnTo: "ask" },
        { type: "VIEW_SOURCE", sourceId: "src-1", returnTo: "clips" },
        { type: "VIEW_SOURCE", sourceId: "src-1", returnTo: "ask", scrollToText: "test text" },
        { type: "BACK_TO_LIST" },
        { type: "RETURN_TO_TAB" },
        { type: "START_ADD_DOCUMENT" },
        { type: "START_ADD_DOCUMENT", connectionId: "conn-1" },
        { type: "SET_DRIVE_CONNECTION", connectionId: "conn-1" },
        { type: "FINISH_FLOW" },
      ];

      for (const state of states) {
        for (const action of actions) {
          const result = researchPanelReducer(state, action);
          expect(isValidState(result)).toBe(true);
        }
      }
    });

    it("unknown actions return current state", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unknownAction = { type: "UNKNOWN_ACTION" } as any;
      const result = researchPanelReducer(sourcesListState, unknownAction);
      expect(result).toEqual(sourcesListState);
    });
  });
});

// ============================================================
// Integration tests for ResearchPanelProvider + useResearchPanel
// ============================================================

describe("ResearchPanelProvider + useResearchPanel", () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <ResearchPanelProvider>{children}</ResearchPanelProvider>;
  }

  it("provides initial closed state", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeTab).toBe("sources");
    expect(result.current.sourcesView).toBe("list");
    expect(result.current.activeSourceId).toBeNull();
    expect(result.current.returnTab).toBeNull();
    expect(result.current.scrollToText).toBeNull();
  });

  it("opens and closes the panel", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    act(() => {
      result.current.openPanel();
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeTab).toBe("sources");

    act(() => {
      result.current.closePanel();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("opens to a specific tab", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    act(() => {
      result.current.openPanel("ask");
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeTab).toBe("ask");
  });

  it("switches tabs", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    act(() => {
      result.current.openPanel();
    });

    act(() => {
      result.current.setActiveTab("clips");
    });
    expect(result.current.activeTab).toBe("clips");
  });

  it("navigates to source detail and back", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    act(() => {
      result.current.openPanel();
    });

    act(() => {
      result.current.viewSource("src-99");
    });
    expect(result.current.sourcesView).toBe("detail");
    expect(result.current.activeSourceId).toBe("src-99");

    act(() => {
      result.current.backToSourceList();
    });
    expect(result.current.sourcesView).toBe("list");
    expect(result.current.activeSourceId).toBeNull();
  });

  it("supports cross-tab navigation with returnToPreviousTab", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    // Open to Ask tab
    act(() => {
      result.current.openPanel("ask");
    });

    // Navigate to source from Ask with return
    act(() => {
      result.current.viewSource("src-42", "ask");
    });
    expect(result.current.activeTab).toBe("sources");
    expect(result.current.sourcesView).toBe("detail");
    expect(result.current.returnTab).toBe("ask");

    // Return to Ask tab
    act(() => {
      result.current.returnToPreviousTab();
    });
    expect(result.current.activeTab).toBe("ask");
    expect(result.current.returnTab).toBeNull();
  });

  it("stores scrollToText when navigating to source from citation", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    act(() => {
      result.current.openPanel("ask");
    });

    act(() => {
      result.current.viewSource("src-42", "ask", "psychological safety");
    });
    expect(result.current.scrollToText).toBe("psychological safety");
    expect(result.current.activeTab).toBe("sources");
    expect(result.current.sourcesView).toBe("detail");
    expect(result.current.returnTab).toBe("ask");

    // Returning to tab clears scrollToText
    act(() => {
      result.current.returnToPreviousTab();
    });
    expect(result.current.scrollToText).toBeNull();
  });

  it("starts add-document flow with pre-selected connectionId from source row", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    act(() => {
      result.current.openPanel();
    });

    act(() => {
      result.current.startAddDocument("conn-42");
    });
    expect(result.current.sourcesView).toBe("add-document");
    expect(result.current.activeConnectionId).toBe("conn-42");

    act(() => {
      result.current.finishFlow();
    });
    expect(result.current.sourcesView).toBe("list");
    expect(result.current.activeConnectionId).toBeNull();
  });

  it("manages add-document flow lifecycle", () => {
    const { result } = renderHook(() => useResearchPanel(), { wrapper });

    act(() => {
      result.current.openPanel();
    });

    act(() => {
      result.current.startAddDocument();
    });
    expect(result.current.sourcesView).toBe("add-document");

    act(() => {
      result.current.setDriveConnection("conn-123");
    });
    expect(result.current.activeConnectionId).toBe("conn-123");

    act(() => {
      result.current.finishFlow();
    });
    expect(result.current.sourcesView).toBe("list");
    expect(result.current.activeConnectionId).toBeNull();
  });

  it("throws when used outside provider", () => {
    // Suppress console.error from React error boundary
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useResearchPanel());
    }).toThrow("useResearchPanel must be used within a ResearchPanelProvider");

    consoleSpy.mockRestore();
  });
});
