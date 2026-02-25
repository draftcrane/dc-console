import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorPanel, EditorPanelOverlay } from "@/components/editor/editor-panel";
import { ChapterEditorPanel } from "@/components/editor/chapter-editor-panel";
import { StreamingResponse } from "@/components/editor/streaming-response";

/**
 * Tests for Editor Panel (#317) — the left-side panel for chapter rewriting.
 *
 * Components tested:
 * - EditorPanel (persistent desktop shell)
 * - EditorPanelOverlay (mobile overlay shell)
 * - ChapterEditorPanel (chapter-mode content)
 * - StreamingResponse (reusable streaming text display)
 */

// Mock SourcesContext used by ChapterEditorPanel for instruction list
vi.mock("@/contexts/sources-context", () => ({
  useSourcesContext: () => ({
    chapterInstructions: [
      {
        id: "inst-1",
        userId: "user-1",
        label: "Simpler language",
        instructionText: "Rewrite using simpler vocabulary.",
        type: "chapter",
        lastUsedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "inst-2",
        userId: "user-1",
        label: "More concise",
        instructionText: "Make this more concise.",
        type: "chapter",
        lastUsedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    isLoadingInstructions: false,
    createInstruction: vi.fn(),
    updateInstruction: vi.fn(),
    removeInstruction: vi.fn(),
    touchInstructionLastUsed: vi.fn(),
  }),
}));

// Mock InstructionList to avoid its internal dependencies (useToast)
vi.mock("@/components/instruction-list", () => ({
  InstructionList: ({
    instructions,
    onSelect,
    disabled,
  }: {
    instructions: Array<{ id: string; label: string; instructionText: string }>;
    onSelect: (inst: { id: string; label: string; instructionText: string }) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="instruction-list" role="listbox" aria-label="chapter instructions">
      {instructions.map((inst) => (
        <button
          key={inst.id}
          role="option"
          aria-selected={false}
          onClick={() => !disabled && onSelect(inst)}
          disabled={disabled}
        >
          {inst.label}
        </button>
      ))}
    </div>
  ),
}));

// ─────────────────────────────────────────────────────────────────
// StreamingResponse
// ─────────────────────────────────────────────────────────────────

describe("StreamingResponse", () => {
  it("renders text content", () => {
    render(<StreamingResponse text="Hello world" isStreaming={false} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("shows blinking cursor during streaming", () => {
    const { container } = render(<StreamingResponse text="Hello" isStreaming={true} />);
    const cursor = container.querySelector(".editor-cursor-blink");
    expect(cursor).toBeInTheDocument();
  });

  it("does not show cursor when not streaming", () => {
    const { container } = render(<StreamingResponse text="Hello" isStreaming={false} />);
    const cursor = container.querySelector(".editor-cursor-blink");
    expect(cursor).not.toBeInTheDocument();
  });

  it("shows error message when no text exists", () => {
    render(<StreamingResponse text="" isStreaming={false} errorMessage="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows inline error when text exists", () => {
    render(
      <StreamingResponse text="Partial text" isStreaming={false} errorMessage="Connection lost" />,
    );
    expect(screen.getByText("Partial text")).toBeInTheDocument();
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });

  it("has aria-busy=true during streaming", () => {
    render(<StreamingResponse text="" isStreaming={true} />);
    const region = screen.getByRole("region", { name: "Rewrite result" });
    expect(region).toHaveAttribute("aria-busy", "true");
  });

  it("has aria-busy=false when not streaming", () => {
    render(<StreamingResponse text="Done" isStreaming={false} />);
    const region = screen.getByRole("region", { name: "Rewrite result" });
    expect(region).toHaveAttribute("aria-busy", "false");
  });
});

// ─────────────────────────────────────────────────────────────────
// EditorPanel (persistent desktop)
// ─────────────────────────────────────────────────────────────────

describe("EditorPanel", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <EditorPanel isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </EditorPanel>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders panel with Chapter Editor title when open", () => {
    render(
      <EditorPanel isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </EditorPanel>,
    );
    expect(screen.getByText("Chapter Editor")).toBeInTheDocument();
  });

  it("has role=complementary for persistent panel", () => {
    render(
      <EditorPanel isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </EditorPanel>,
    );
    expect(screen.getByRole("complementary", { name: "Chapter editor" })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <EditorPanel isOpen={true} onClose={onClose}>
        <div>Content</div>
      </EditorPanel>,
    );
    fireEvent.click(screen.getByLabelText("Close editor panel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders children content", () => {
    render(
      <EditorPanel isOpen={true} onClose={vi.fn()}>
        <div data-testid="panel-content">Panel content</div>
      </EditorPanel>,
    );
    expect(screen.getByTestId("panel-content")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// EditorPanelOverlay (mobile)
// ─────────────────────────────────────────────────────────────────

describe("EditorPanelOverlay", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <EditorPanelOverlay isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </EditorPanelOverlay>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("has role=complementary for non-modal overlay (allows editor text selection)", () => {
    render(
      <EditorPanelOverlay isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </EditorPanelOverlay>,
    );
    expect(screen.getByRole("complementary", { name: "Chapter editor" })).toBeInTheDocument();
  });

  it("does not have aria-modal (non-modal panel)", () => {
    render(
      <EditorPanelOverlay isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </EditorPanelOverlay>,
    );
    const panel = screen.getByRole("complementary", { name: "Chapter editor" });
    expect(panel).not.toHaveAttribute("aria-modal");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <EditorPanelOverlay isOpen={true} onClose={onClose}>
        <div>Content</div>
      </EditorPanelOverlay>,
    );
    fireEvent.click(screen.getByLabelText("Close editor panel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// ChapterEditorPanel
// ─────────────────────────────────────────────────────────────────

describe("ChapterEditorPanel", () => {
  const makeResult = (overrides = {}) => ({
    interactionId: "int-1",
    originalText: "Original text here",
    rewriteText: "Rewritten text here",
    instruction: "Make it better",
    attemptNumber: 1,
    tier: "frontier" as const,
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Empty state ──

  it("shows empty state when no text is selected and no result", () => {
    render(
      <ChapterEditorPanel
        sheetState="idle"
        result={null}
        errorMessage={null}
        selectedText=""
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Ready when you are.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select text in your chapter, then choose an instruction or write your own.",
      ),
    ).toBeInTheDocument();
  });

  // ── With selected text ──

  it("shows instruction list when text is selected", () => {
    render(
      <ChapterEditorPanel
        sheetState="idle"
        result={null}
        errorMessage={null}
        selectedText="Some selected text"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByTestId("instruction-list")).toBeInTheDocument();
    expect(screen.getByText("Simpler language")).toBeInTheDocument();
    expect(screen.getByText("More concise")).toBeInTheDocument();
  });

  it("shows freeform instruction field when text is selected", () => {
    render(
      <ChapterEditorPanel
        sheetState="idle"
        result={null}
        errorMessage={null}
        selectedText="Some selected text"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Or write your own")).toBeInTheDocument();
  });

  it("shows selected text disclosure", () => {
    render(
      <ChapterEditorPanel
        sheetState="idle"
        result={null}
        errorMessage={null}
        selectedText="Some selected text"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Selected text")).toBeInTheDocument();
  });

  it("expands selected text when disclosure is clicked", () => {
    render(
      <ChapterEditorPanel
        sheetState="idle"
        result={null}
        errorMessage={null}
        selectedText="Some selected text content"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Selected text"));
    expect(screen.getByText("Some selected text content")).toBeInTheDocument();
  });

  // ── Streaming state ──

  it("shows streaming response with spinner during streaming", () => {
    render(
      <ChapterEditorPanel
        sheetState="streaming"
        result={makeResult({ rewriteText: "In progress..." })}
        errorMessage={null}
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Writing...")).toBeInTheDocument();
    expect(screen.getByText("In progress...")).toBeInTheDocument();
  });

  it("shows Cancel button during streaming", () => {
    render(
      <ChapterEditorPanel
        sheetState="streaming"
        result={makeResult({ rewriteText: "..." })}
        errorMessage={null}
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("disables Try Again and Use This during streaming", () => {
    render(
      <ChapterEditorPanel
        sheetState="streaming"
        result={makeResult({ rewriteText: "..." })}
        errorMessage={null}
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Try Again")).toBeDisabled();
    expect(screen.getByText("Use This")).toBeDisabled();
  });

  // ── Complete state ──

  it("shows all three action buttons in complete state", () => {
    render(
      <ChapterEditorPanel
        sheetState="complete"
        result={makeResult()}
        errorMessage={null}
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Discard")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(screen.getByText("Use This")).toBeInTheDocument();
  });

  it("calls onAccept when Use This is clicked", () => {
    const onAccept = vi.fn();
    const result = makeResult();
    render(
      <ChapterEditorPanel
        sheetState="complete"
        result={result}
        errorMessage={null}
        selectedText="Original"
        onAccept={onAccept}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Use This"));
    expect(onAccept).toHaveBeenCalledWith(result);
  });

  it("calls onDiscard when Discard is clicked", () => {
    const onDiscard = vi.fn();
    const result = makeResult();
    render(
      <ChapterEditorPanel
        sheetState="complete"
        result={result}
        errorMessage={null}
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={onDiscard}
      />,
    );
    fireEvent.click(screen.getByText("Discard"));
    expect(onDiscard).toHaveBeenCalledWith(result);
  });

  it("calls onRetry when Try Again is clicked", () => {
    const onRetry = vi.fn();
    const result = makeResult();
    render(
      <ChapterEditorPanel
        sheetState="complete"
        result={result}
        errorMessage={null}
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={onRetry}
        onDiscard={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Try Again"));
    expect(onRetry).toHaveBeenCalledWith(result, "Make it better");
  });

  // ── Error state ──

  it("shows error message in response area", () => {
    render(
      <ChapterEditorPanel
        sheetState="complete"
        result={makeResult({ rewriteText: "" })}
        errorMessage="Connection error. Please try again."
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Connection error. Please try again.")).toBeInTheDocument();
  });

  // ── Instruction list ──

  it("shows instruction list for saved instructions", () => {
    render(
      <ChapterEditorPanel
        sheetState="idle"
        result={null}
        errorMessage={null}
        selectedText="Some text"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByTestId("instruction-list")).toBeInTheDocument();
  });

  // ── Attempt number ──

  it("shows attempt number when complete", () => {
    render(
      <ChapterEditorPanel
        sheetState="complete"
        result={makeResult({ attemptNumber: 3 })}
        errorMessage={null}
        selectedText="Original"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText("Attempt 3")).toBeInTheDocument();
  });

  // ── Instruction selection ──

  it("triggers rewrite when instruction is selected", () => {
    const onRewriteWithInstruction = vi.fn();
    render(
      <ChapterEditorPanel
        sheetState="idle"
        result={null}
        errorMessage={null}
        selectedText="Some text"
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
        onRewriteWithInstruction={onRewriteWithInstruction}
      />,
    );
    fireEvent.click(screen.getByText("More concise"));
    expect(onRewriteWithInstruction).toHaveBeenCalledWith("Make this more concise.");
  });
});
