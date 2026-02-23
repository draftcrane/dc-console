import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorToolbar } from "@/components/editor/editor-toolbar";

/**
 * Tests for EditorToolbar — the top toolbar for the writing environment.
 *
 * Contains: ProjectSwitcher, SaveIndicator, AI Rewrite button,
 * ExportMenu, SettingsMenu.
 *
 * Mock strategy: We mock all child components to isolate toolbar behavior.
 * The key behavior to test is the conditional rendering of the AI Rewrite button
 * based on selectionWordCount and aiSheetState.
 */

// Mock SourcesContext used by toolbar for Sources toggle button
vi.mock("@/contexts/sources-context", () => ({
  useSourcesContext: () => ({
    isPanelOpen: false,
    togglePanel: vi.fn(),
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
      driveFolderId: null,
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
    driveConnected: false,
    selectionWordCount: 0,
    aiSheetState: "idle" as const,
    onOpenAiRewrite: vi.fn(),
    projectId: "proj-1",
    activeChapterId: "ch-1",
    getToken: vi.fn().mockResolvedValue("token"),
    apiUrl: "https://api.test",
    hasDriveFolder: false,
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
  // AI Rewrite button conditional rendering
  // ────────────────────────────────────────────

  it("does not show AI Rewrite button when no text is selected", () => {
    render(<EditorToolbar {...makeProps({ selectionWordCount: 0 })} />);

    expect(screen.queryByLabelText("AI Rewrite selected text")).not.toBeInTheDocument();
  });

  it("shows AI Rewrite button when text is selected and sheet is idle", () => {
    render(<EditorToolbar {...makeProps({ selectionWordCount: 5, aiSheetState: "idle" })} />);

    expect(screen.getByLabelText("AI Rewrite selected text")).toBeInTheDocument();
  });

  it("does not show AI Rewrite button when sheet is streaming", () => {
    render(<EditorToolbar {...makeProps({ selectionWordCount: 5, aiSheetState: "streaming" })} />);

    expect(screen.queryByLabelText("AI Rewrite selected text")).not.toBeInTheDocument();
  });

  it("does not show AI Rewrite button when sheet is complete", () => {
    render(<EditorToolbar {...makeProps({ selectionWordCount: 5, aiSheetState: "complete" })} />);

    expect(screen.queryByLabelText("AI Rewrite selected text")).not.toBeInTheDocument();
  });

  it("calls onOpenAiRewrite when AI Rewrite button is clicked", () => {
    const onOpenAiRewrite = vi.fn();
    render(
      <EditorToolbar
        {...makeProps({ selectionWordCount: 5, aiSheetState: "idle", onOpenAiRewrite })}
      />,
    );

    fireEvent.click(screen.getByLabelText("AI Rewrite selected text"));
    expect(onOpenAiRewrite).toHaveBeenCalledTimes(1);
  });

  // ────────────────────────────────────────────
  // Save status passthrough
  // ────────────────────────────────────────────

  it("passes save status state to SaveIndicator", () => {
    render(<EditorToolbar {...makeProps({ saveStatus: { state: "saving" } })} />);

    expect(screen.getByTestId("save-indicator")).toHaveAttribute("data-state", "saving");
  });
});
