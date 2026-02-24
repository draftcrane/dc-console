/**
 * Layout Components
 *
 * Components for the DraftCrane workspace layout system.
 */

// Sidebar
export { Sidebar, SidebarOverlay } from "./sidebar";
export type { SidebarProps, ChapterData } from "./sidebar";

// WorkspaceShell - CSS Grid Layout System (#316)
export {
  WorkspaceShell,
  WorkspaceShellProvider,
  WorkspaceSidebar,
  WorkspaceEditorPanel,
  WorkspaceCenter,
  WorkspaceLibraryPanel,
  OverlayPanel,
  SidebarPill,
  StandaloneWorkspaceShell,
  useWorkspaceShell,
} from "./workspace-shell";
export type { Breakpoint, PanelMode, PanelState, WorkspaceLayoutState } from "./workspace-shell";
