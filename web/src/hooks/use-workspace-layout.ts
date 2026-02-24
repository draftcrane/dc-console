"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * WorkspaceShell Layout Hook (#316)
 *
 * Manages workspace layout state including:
 * - Viewport breakpoint detection
 * - Sidebar collapsed state
 * - Panel visibility states (hidden/persistent/overlay)
 * - Panel layout algorithm enforcement (center min 400px)
 *
 * Breakpoints per Design Brief:
 * - Portrait: 768-1023px
 * - Landscape: 1024-1279px
 * - Desktop: 1280px+
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Breakpoint = "portrait" | "landscape" | "desktop";
export type PanelMode = "hidden" | "persistent" | "overlay";

export interface PanelState {
  editorPanel: PanelMode;
  libraryPanel: PanelMode;
}

export interface WorkspaceLayoutState {
  /** Current viewport breakpoint */
  breakpoint: Breakpoint;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Panel visibility states */
  panels: PanelState;
  /** Whether center area can accommodate the minimum width */
  centerHasMinWidth: boolean;
}

export interface UseWorkspaceLayoutOptions {
  /** Initial sidebar collapsed state */
  initialSidebarCollapsed?: boolean;
  /** Initial editor panel mode */
  initialEditorPanel?: PanelMode;
  /** Initial library panel mode */
  initialLibraryPanel?: PanelMode;
  /** Callback when layout state changes */
  onStateChange?: (state: WorkspaceLayoutState) => void;
}

export interface UseWorkspaceLayoutReturn {
  /** Current layout state */
  state: WorkspaceLayoutState;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Open a panel (respects breakpoint rules) */
  openPanel: (panel: "editor" | "library") => void;
  /** Close a panel */
  closePanel: (panel: "editor" | "library") => void;
  /** Toggle a panel */
  togglePanel: (panel: "editor" | "library") => void;
  /** Set panel mode directly */
  setPanelMode: (panel: "editor" | "library", mode: PanelMode) => void;
  /** Data attributes for WorkspaceShell element */
  dataAttributes: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const BREAKPOINTS = {
  landscape: 1024,
  desktop: 1280,
} as const;

const SIDEBAR_WIDTH = 260;
const PANEL_WIDTH = 320;
const CENTER_MIN_WIDTH = 400;

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useWorkspaceLayout(
  options: UseWorkspaceLayoutOptions = {},
): UseWorkspaceLayoutReturn {
  const {
    initialSidebarCollapsed = false,
    initialEditorPanel = "hidden",
    initialLibraryPanel = "hidden",
    onStateChange,
  } = options;

  // Breakpoint detection
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(initialSidebarCollapsed);

  // Panel states
  const [panels, setPanels] = useState<PanelState>({
    editorPanel: initialEditorPanel,
    libraryPanel: initialLibraryPanel,
  });

  // Detect viewport width and update breakpoint
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width >= BREAKPOINTS.desktop) {
        setBreakpoint("desktop");
      } else if (width >= BREAKPOINTS.landscape) {
        setBreakpoint("landscape");
      } else {
        setBreakpoint("portrait");
      }
    };

    // Initial detection
    updateBreakpoint();

    // Listen for resize
    window.addEventListener("resize", updateBreakpoint);
    return () => window.removeEventListener("resize", updateBreakpoint);
  }, []);

  // Calculate if center has minimum width
  const centerHasMinWidth = useMemo(() => {
    // This is a simplified calculation - in reality would need to
    // account for actual viewport width and panel states
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;

    let usedWidth = 0;

    // Add sidebar width if not collapsed (and not portrait)
    if (breakpoint !== "portrait" && !sidebarCollapsed) {
      usedWidth += SIDEBAR_WIDTH;
    }

    // Add panel widths if persistent
    if (panels.editorPanel === "persistent") {
      usedWidth += PANEL_WIDTH;
    }
    if (panels.libraryPanel === "persistent") {
      usedWidth += PANEL_WIDTH;
    }

    return viewportWidth - usedWidth >= CENTER_MIN_WIDTH;
  }, [breakpoint, sidebarCollapsed, panels]);

  // Build state object
  const state = useMemo<WorkspaceLayoutState>(
    () => ({
      breakpoint,
      sidebarCollapsed,
      panels,
      centerHasMinWidth,
    }),
    [breakpoint, sidebarCollapsed, panels, centerHasMinWidth],
  );

  // Notify on state change
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Sidebar actions
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => !prev);
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
  }, []);

  // Panel actions with breakpoint-aware logic
  const openPanel = useCallback(
    (panel: "editor" | "library") => {
      setPanels((prev) => {
        const newState = { ...prev };

        if (breakpoint === "portrait") {
          // Portrait: panels can only be overlay
          if (panel === "editor") {
            newState.editorPanel = "overlay";
          } else {
            newState.libraryPanel = "overlay";
          }
        } else if (breakpoint === "landscape") {
          // Landscape: one panel can be persistent, second must be overlay
          if (panel === "editor") {
            newState.editorPanel = "persistent";
            // If library was persistent, demote to overlay
            if (prev.libraryPanel === "persistent") {
              newState.libraryPanel = "overlay";
            }
          } else {
            newState.libraryPanel = "persistent";
            // If editor was persistent, demote to overlay
            if (prev.editorPanel === "persistent") {
              newState.editorPanel = "overlay";
            }
          }
        } else {
          // Desktop: both can be persistent
          if (panel === "editor") {
            newState.editorPanel = "persistent";
          } else {
            newState.libraryPanel = "persistent";
          }
        }

        return newState;
      });
    },
    [breakpoint],
  );

  const closePanel = useCallback((panel: "editor" | "library") => {
    setPanels((prev) => ({
      ...prev,
      [panel === "editor" ? "editorPanel" : "libraryPanel"]: "hidden",
    }));
  }, []);

  const togglePanel = useCallback(
    (panel: "editor" | "library") => {
      const key = panel === "editor" ? "editorPanel" : "libraryPanel";
      if (panels[key] === "hidden") {
        openPanel(panel);
      } else {
        closePanel(panel);
      }
    },
    [panels, openPanel, closePanel],
  );

  const setPanelMode = useCallback((panel: "editor" | "library", mode: PanelMode) => {
    setPanels((prev) => ({
      ...prev,
      [panel === "editor" ? "editorPanel" : "libraryPanel"]: mode,
    }));
  }, []);

  // Generate data attributes for the WorkspaceShell element
  const dataAttributes = useMemo<Record<string, string>>(() => {
    const attrs: Record<string, string> = {};

    if (sidebarCollapsed) {
      attrs["data-sidebar-collapsed"] = "true";
    }

    if (panels.editorPanel !== "hidden") {
      attrs["data-editor-panel"] = panels.editorPanel;
    }

    if (panels.libraryPanel !== "hidden") {
      attrs["data-library-panel"] = panels.libraryPanel;
    }

    attrs["data-breakpoint"] = breakpoint;

    return attrs;
  }, [sidebarCollapsed, panels, breakpoint]);

  return {
    state,
    toggleSidebar,
    setSidebarCollapsed,
    openPanel,
    closePanel,
    togglePanel,
    setPanelMode,
    dataAttributes,
  };
}
