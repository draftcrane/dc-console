import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorToolbar } from "@/components/editor/editor-toolbar";

/**
 * Tests for EditorToolbar — the top toolbar for the writing environment.
 *
 * Contains: ProjectSwitcher, SaveIndicator, Editor panel toggle,
 * Library toggle, ExportMenu, SettingsMenu.
 *
 * Mock strategy: We mock all child components to isolate toolbar behavior.
 */

// Mock SourcesContext used by toolbar for Sources toggle button
vi.mock("@/contexts/sources-context", () => ({
  useSourcesContext: () => ({
    isPanelOpen: false,
    togglePanel: vi.fn(),
    connections: [],
  }),
}));

// Mock child components to avoid their dependencies
vi.mock("@/components/project/project-switcher", () => ({
  ProjectSwitcher: ({ currentProject }: { currentProject: { id: string; title: string } }) => (
    <div data-testid="project-switcher">{currentProject.title}</div>
  ),
}));

vi.mock("@/components/editor/save-indicator", () => ({
  SaveIndicator: ({ status }: { status: { state: string } }) => (
    <div data-testid="save-indicator" data-state={status.state}>
      {status.state}
    </div>
  ),
}));

vi.mock("@/components/project/export-menu", () => ({
  ExportMenu: () => <div data-testid="export-menu">Export</div>,
}));

vi.mock("@/components/project/settings-menu", () => ({
  SettingsMenu: () => <div data-testid="settings-menu">Settings</div>,
}));

function makeProps(overrides?: Partial<React.ComponentProps<typeof EditorToolbar>>) {
  return {
    projectData: {
      id: "proj-1",
      title: "My Book",
      status: "active",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
      chapters: [],
    },
    allProjects: [
      {
        id: "proj-1",
        title: "My Book",
        status: "active",
        wordCount: 1000,
        chapterCount: 3,
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ],
    totalWordCount: 1000,
    saveStatus: { state: "idle" as const },
    onSaveRetry: vi.fn(),
    viewMode: "chapter" as const,
    onViewModeChange: vi.fn(),
    projectId: "proj-1",
    activeChapterId: "ch-1",
    getToken: vi.fn().mockResolvedValue("token"),
    apiUrl: "https://api.test",
    onRenameBook: vi.fn(),
    onDuplicateBook: vi.fn(),
    isDuplicating: false,
    onDeleteProject: vi.fn(),
    onSignOut: vi.fn(),
    isSigningOut: false,
    ...overrides,
  };
}

describe("EditorToolbar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────
  // Core sub-components are rendered
  // ────────────────────────────────────────────

  it("renders project switcher with project title", () => {
    render(<EditorToolbar {...makeProps()} />);

    expect(screen.getByTestId("project-switcher")).toHaveTextContent("My Book");
  });

  it("renders save indicator", () => {
    render(<EditorToolbar {...makeProps()} />);

    expect(screen.getByTestId("save-indicator")).toBeInTheDocument();
  });

  it("renders export menu", () => {
    render(<EditorToolbar {...makeProps()} />);

    expect(screen.getByTestId("export-menu")).toBeInTheDocument();
  });

  it("renders settings menu", () => {
    render(<EditorToolbar {...makeProps()} />);

    expect(screen.getByTestId("settings-menu")).toBeInTheDocument();
  });

  // ────────────────────────────────────────────
  // Editor Panel toggle button
  // ────────────────────────────────────────────

  it("renders Editor panel toggle button when onToggleEditorPanel is provided", () => {
    render(<EditorToolbar {...makeProps({ onToggleEditorPanel: vi.fn() })} />);

    expect(screen.getByLabelText("Open editor panel")).toBeInTheDocument();
  });

  it("calls onToggleEditorPanel when Editor button is clicked", () => {
    const onToggleEditorPanel = vi.fn();
    render(<EditorToolbar {...makeProps({ onToggleEditorPanel })} />);

    fireEvent.click(screen.getByLabelText("Open editor panel"));
    expect(onToggleEditorPanel).toHaveBeenCalledTimes(1);
  });

  it("shows active state when editor panel is open", () => {
    render(
      <EditorToolbar {...makeProps({ isEditorPanelOpen: true, onToggleEditorPanel: vi.fn() })} />,
    );

    expect(screen.getByLabelText("Close editor panel")).toBeInTheDocument();
  });

  // ────────────────────────────────────────────
  // Save status passthrough
  // ────────────────────────────────────────────

  it("passes save status state to SaveIndicator", () => {
    render(<EditorToolbar {...makeProps({ saveStatus: { state: "saving" } })} />);

    expect(screen.getByTestId("save-indicator")).toHaveAttribute("data-state", "saving");
  });
});
