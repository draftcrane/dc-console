"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  useWorkspaceLayout,
  type Breakpoint,
  type PanelMode,
  type PanelState,
  type WorkspaceLayoutState,
  type UseWorkspaceLayoutOptions,
} from "@/hooks/use-workspace-layout";
import { useFocusTrap } from "@/hooks/use-focus-trap";

/**
 * WorkspaceShell CSS Grid Layout System (#316)
 *
 * Implements a responsive workspace layout with four named grid areas:
 * - sidebar: Chapter navigation (left)
 * - editor-panel: Source/assist panel (left of center)
 * - center: Main writing area (never < 400px)
 * - library-panel: Library/desk panel (right)
 *
 * Breakpoints per Design Brief:
 * - Portrait (768-1023px): sidebar collapsed to pill, panels as overlays, center full-width
 * - Landscape (1024-1279px): sidebar persistent/collapsible, one panel + overlay, center min 400px
 * - Desktop (1280px+): sidebar persistent, both panels can be persistent, center flexible
 *
 * Uses:
 * - CSS Grid with named areas
 * - 100dvh for dynamic viewport height (Safari)
 * - env(safe-area-inset-*) for notch/toolbar handling
 * - Container queries for component-internal adaptation
 * - ARIA landmarks for accessibility
 */

// -----------------------------------------------------------------------------
// Re-export types from hook
// -----------------------------------------------------------------------------

export type { Breakpoint, PanelMode, PanelState, WorkspaceLayoutState };

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface WorkspaceShellContextValue {
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
  /** Data attributes for the shell element */
  dataAttributes: Record<string, string>;
}

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

export function useWorkspaceShell(): WorkspaceShellContextValue {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error("useWorkspaceShell must be used within a WorkspaceShellProvider");
  }
  return context;
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface WorkspaceShellProviderProps extends UseWorkspaceLayoutOptions {
  children: ReactNode;
}

interface WorkspaceShellProps {
  children: ReactNode;
  className?: string;
}

interface GridAreaProps {
  children: ReactNode;
  className?: string;
}

// -----------------------------------------------------------------------------
// Provider Component
// -----------------------------------------------------------------------------

/**
 * WorkspaceShellProvider - Context provider for workspace layout state
 *
 * Wraps the layout hook and provides state to all child components.
 * Use this at the top level of your editor page.
 */
export function WorkspaceShellProvider({
  children,
  initialSidebarCollapsed,
  initialEditorPanel,
  initialLibraryPanel,
  onStateChange,
}: WorkspaceShellProviderProps) {
  const layout = useWorkspaceLayout({
    initialSidebarCollapsed,
    initialEditorPanel,
    initialLibraryPanel,
    onStateChange,
  });

  const value = useMemo<WorkspaceShellContextValue>(
    () => ({
      state: layout.state,
      toggleSidebar: layout.toggleSidebar,
      setSidebarCollapsed: layout.setSidebarCollapsed,
      openPanel: layout.openPanel,
      closePanel: layout.closePanel,
      togglePanel: layout.togglePanel,
      setPanelMode: layout.setPanelMode,
      dataAttributes: layout.dataAttributes,
    }),
    [layout],
  );

  return <WorkspaceShellContext.Provider value={value}>{children}</WorkspaceShellContext.Provider>;
}

// -----------------------------------------------------------------------------
// CSS Grid Layout Component
// -----------------------------------------------------------------------------

/**
 * WorkspaceShell - Main layout container
 *
 * This component provides the CSS Grid structure for the writing environment.
 * It handles:
 * - Grid area definitions for all four regions
 * - Responsive breakpoint adjustments via data attributes
 * - Safe area insets
 * - Container query scoping
 *
 * Must be used within a WorkspaceShellProvider.
 */
export function WorkspaceShell({ children, className = "" }: WorkspaceShellProps) {
  const { dataAttributes } = useWorkspaceShell();

  return (
    <div
      className={`workspace-shell ${className}`}
      role="main"
      aria-label="Writing workspace"
      {...dataAttributes}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Grid Area Components
// -----------------------------------------------------------------------------

/**
 * WorkspaceSidebar - Sidebar grid area for chapter navigation
 *
 * Behavior by breakpoint:
 * - Portrait: collapsed to pill (not rendered in grid, use SidebarPill)
 * - Landscape: persistent, collapsible (240-280px)
 * - Desktop: always persistent (260px)
 */
export function WorkspaceSidebar({ children, className = "" }: GridAreaProps) {
  return (
    <aside
      className={`workspace-sidebar ${className}`}
      role="navigation"
      aria-label="Chapter navigation"
    >
      {children}
    </aside>
  );
}

/**
 * WorkspaceEditorPanel - Editor panel grid area (left of center)
 *
 * Behavior by breakpoint:
 * - Portrait: overlay only
 * - Landscape: can be persistent OR overlay (not both with library)
 * - Desktop: can be persistent alongside library panel
 */
export function WorkspaceEditorPanel({ children, className = "" }: GridAreaProps) {
  return (
    <aside
      className={`workspace-editor-panel ${className}`}
      role="complementary"
      aria-label="Editor panel"
    >
      {children}
    </aside>
  );
}

/**
 * WorkspaceCenter - Main writing area grid area
 *
 * - Never collapses below 400px
 * - Contains the Tiptap editor
 * - Uses container query for internal adaptation
 */
export function WorkspaceCenter({ children, className = "" }: GridAreaProps) {
  return (
    <main className={`workspace-center ${className}`} role="region" aria-label="Writing area">
      {children}
    </main>
  );
}

/**
 * WorkspaceLibraryPanel - Library panel grid area (right)
 *
 * Behavior by breakpoint:
 * - Portrait: overlay only
 * - Landscape: can be persistent OR overlay (not both with editor)
 * - Desktop: can be persistent alongside editor panel
 */
export function WorkspaceLibraryPanel({ children, className = "" }: GridAreaProps) {
  return (
    <aside
      className={`workspace-library-panel ${className}`}
      role="complementary"
      aria-label="Library panel"
    >
      {children}
    </aside>
  );
}

// -----------------------------------------------------------------------------
// Overlay Components
// -----------------------------------------------------------------------------

interface OverlayPanelProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  position: "left" | "right";
  ariaLabel: string;
  className?: string;
}

/**
 * OverlayPanel - Generic overlay wrapper for panels in portrait/overlay mode
 *
 * Features:
 * - Backdrop with click-to-close
 * - Slide animation from left/right
 * - Focus trapping
 * - Escape key handling
 * - Safe area inset handling
 */
export function OverlayPanel({
  children,
  isOpen,
  onClose,
  position,
  ariaLabel,
  className = "",
}: OverlayPanelProps) {
  const panelRef = useFocusTrap({ isOpen, onEscape: onClose });

  if (!isOpen) return null;

  const slideClass =
    position === "left" ? "workspace-overlay-slide-left" : "workspace-overlay-slide-right";
  const positionClass = position === "left" ? "left-0" : "right-0";

  return (
    <div className="workspace-overlay-container">
      {/* Backdrop */}
      <div className="workspace-overlay-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`workspace-overlay-panel ${positionClass} ${slideClass} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Collapsed Sidebar Pill
// -----------------------------------------------------------------------------

interface SidebarPillProps {
  label: string;
  onClick: () => void;
}

/**
 * SidebarPill - Collapsed sidebar indicator
 *
 * Shows "Ch X" pill when sidebar is collapsed in portrait mode.
 * Tapping opens the sidebar overlay.
 */
export function SidebarPill({ label, onClick }: SidebarPillProps) {
  return (
    <button
      onClick={onClick}
      className="workspace-sidebar-pill"
      aria-label={`${label}. Tap to open chapter list.`}
    >
      {label}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Standalone Shell (no context required)
// -----------------------------------------------------------------------------

interface StandaloneWorkspaceShellProps extends WorkspaceShellProps {
  dataAttributes?: Record<string, string>;
}

/**
 * StandaloneWorkspaceShell - Shell component that doesn't require context
 *
 * Use this when you want to manage layout state externally or for simpler
 * use cases where the full provider isn't needed.
 */
export function StandaloneWorkspaceShell({
  children,
  className = "",
  dataAttributes = {},
}: StandaloneWorkspaceShellProps) {
  return (
    <div
      className={`workspace-shell ${className}`}
      role="main"
      aria-label="Writing workspace"
      {...dataAttributes}
    >
      {children}
    </div>
  );
}

export default WorkspaceShell;
