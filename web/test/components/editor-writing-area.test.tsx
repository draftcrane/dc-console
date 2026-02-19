import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorWritingArea } from "@/components/editor-writing-area";
import type { RefObject } from "react";
import type { ChapterEditorHandle } from "@/components/chapter-editor";

/**
 * Tests for EditorWritingArea — the main writing surface component.
 *
 * Contains:
 * - Editable chapter title (display mode / editing mode)
 * - ChapterEditor (Tiptap) — mocked to avoid full ProseMirror setup
 * - Word count display (total and selection)
 *
 * Mock strategy: We mock ChapterEditor since it requires a full Tiptap/ProseMirror
 * environment. The interesting behavior to test is the title editing UX and
 * word count display, which don't depend on the editor internals.
 */

// Mock the ChapterEditor component — must handle forwardRef since the real
// component uses it for the imperative handle
vi.mock("@/components/chapter-editor", () => ({
  ChapterEditor: React.forwardRef(function MockChapterEditor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ref: React.Ref<ChapterEditorHandle>,
  ) {
    return <div data-testid="chapter-editor" data-content={props.content} />;
  }),
}));

function makeProps(overrides?: Partial<React.ComponentProps<typeof EditorWritingArea>>) {
  return {
    editorRef: { current: null } as RefObject<ChapterEditorHandle | null>,
    currentContent: "<p>Some content here</p>",
    onContentChange: vi.fn(),
    onSelectionWordCountChange: vi.fn(),
    activeChapter: {
      id: "ch-1",
      title: "Test Chapter",
      sortOrder: 1,
      wordCount: 100,
      version: 1,
      status: "draft",
    },
    editingTitle: false,
    titleValue: "",
    onTitleValueChange: vi.fn(),
    onTitleEdit: vi.fn(),
    onTitleSave: vi.fn(),
    onTitleEditCancel: vi.fn(),
    currentWordCount: 42,
    selectionWordCount: 0,
    ...overrides,
  };
}

describe("EditorWritingArea", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────
  // Title display mode
  // ────────────────────────────────────────────

  it("renders the chapter title in display mode", () => {
    render(<EditorWritingArea {...makeProps()} />);

    const title = screen.getByRole("button", { name: /edit chapter title: test chapter/i });
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Test Chapter");
  });

  it("renders 'Untitled Chapter' when activeChapter has no title", () => {
    render(
      <EditorWritingArea
        {...makeProps({
          activeChapter: {
            id: "ch-1",
            title: "",
            sortOrder: 1,
            wordCount: 0,
            version: 1,
            status: "draft",
          },
        })}
      />,
    );

    // Empty title is falsy, so the component renders "Untitled Chapter"
    const title = screen.getByRole("button", { name: /edit chapter title: untitled chapter/i });
    expect(title).toHaveTextContent("Untitled Chapter");
  });

  it("renders 'Untitled Chapter' when activeChapter is undefined", () => {
    render(<EditorWritingArea {...makeProps({ activeChapter: undefined })} />);

    const title = screen.getByRole("button", { name: /edit chapter title: untitled chapter/i });
    expect(title).toHaveTextContent("Untitled Chapter");
  });

  it("calls onTitleEdit when title is clicked in display mode", () => {
    const onTitleEdit = vi.fn();
    render(<EditorWritingArea {...makeProps({ onTitleEdit })} />);

    const title = screen.getByRole("button", { name: /edit chapter title/i });
    fireEvent.click(title);

    expect(onTitleEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onTitleEdit on Enter key in display mode", () => {
    const onTitleEdit = vi.fn();
    render(<EditorWritingArea {...makeProps({ onTitleEdit })} />);

    const title = screen.getByRole("button", { name: /edit chapter title/i });
    fireEvent.keyDown(title, { key: "Enter" });

    expect(onTitleEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onTitleEdit on Space key in display mode", () => {
    const onTitleEdit = vi.fn();
    render(<EditorWritingArea {...makeProps({ onTitleEdit })} />);

    const title = screen.getByRole("button", { name: /edit chapter title/i });
    fireEvent.keyDown(title, { key: " " });

    expect(onTitleEdit).toHaveBeenCalledTimes(1);
  });

  // ────────────────────────────────────────────
  // Title editing mode
  // ────────────────────────────────────────────

  it("renders an input when in editing mode", () => {
    render(<EditorWritingArea {...makeProps({ editingTitle: true, titleValue: "Chapter 1" })} />);

    const input = screen.getByDisplayValue("Chapter 1");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("calls onTitleValueChange when typing in edit mode", () => {
    const onTitleValueChange = vi.fn();
    render(
      <EditorWritingArea
        {...makeProps({
          editingTitle: true,
          titleValue: "Chapter 1",
          onTitleValueChange,
        })}
      />,
    );

    const input = screen.getByDisplayValue("Chapter 1");
    fireEvent.change(input, { target: { value: "New Title" } });

    expect(onTitleValueChange).toHaveBeenCalledWith("New Title");
  });

  it("calls onTitleSave on Enter key in edit mode", () => {
    const onTitleSave = vi.fn();
    render(
      <EditorWritingArea {...makeProps({ editingTitle: true, titleValue: "Test", onTitleSave })} />,
    );

    const input = screen.getByDisplayValue("Test");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onTitleSave).toHaveBeenCalledTimes(1);
  });

  it("calls onTitleEditCancel on Escape key in edit mode", () => {
    const onTitleEditCancel = vi.fn();
    render(
      <EditorWritingArea
        {...makeProps({ editingTitle: true, titleValue: "Test", onTitleEditCancel })}
      />,
    );

    const input = screen.getByDisplayValue("Test");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onTitleEditCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onTitleSave on blur in edit mode", () => {
    const onTitleSave = vi.fn();
    render(
      <EditorWritingArea {...makeProps({ editingTitle: true, titleValue: "Test", onTitleSave })} />,
    );

    const input = screen.getByDisplayValue("Test");
    fireEvent.blur(input);

    expect(onTitleSave).toHaveBeenCalledTimes(1);
  });

  it("input has maxLength of 200 characters", () => {
    render(<EditorWritingArea {...makeProps({ editingTitle: true, titleValue: "Test" })} />);

    const input = screen.getByDisplayValue("Test");
    expect(input).toHaveAttribute("maxLength", "200");
  });

  // ────────────────────────────────────────────
  // Word count display
  // ────────────────────────────────────────────

  it("displays total word count when no selection", () => {
    render(<EditorWritingArea {...makeProps({ currentWordCount: 1234, selectionWordCount: 0 })} />);

    expect(screen.getByText("1,234 words")).toBeInTheDocument();
  });

  it("displays selection word count with total when there is a selection", () => {
    render(
      <EditorWritingArea {...makeProps({ currentWordCount: 1234, selectionWordCount: 50 })} />,
    );

    expect(screen.getByText("50 / 1,234 words")).toBeInTheDocument();
  });

  it("displays 0 words for empty content", () => {
    render(<EditorWritingArea {...makeProps({ currentWordCount: 0, selectionWordCount: 0 })} />);

    expect(screen.getByText("0 words")).toBeInTheDocument();
  });

  // ────────────────────────────────────────────
  // Editor integration
  // ────────────────────────────────────────────

  it("renders the ChapterEditor component", () => {
    render(<EditorWritingArea {...makeProps()} />);

    expect(screen.getByTestId("chapter-editor")).toBeInTheDocument();
  });

  it("has proper content width constraint (max-w-[700px])", () => {
    const { container } = render(<EditorWritingArea {...makeProps()} />);

    // The inner div that constrains width
    const contentWrapper = container.querySelector(".max-w-\\[700px\\]");
    expect(contentWrapper).toBeInTheDocument();
  });
});
