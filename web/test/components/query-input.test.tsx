import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryInput } from "@/components/research/query-input";

/**
 * Tests for QueryInput — chat-style input for the Ask tab.
 *
 * Key requirements per design spec:
 * - enterkeyhint="send" for mobile keyboards
 * - Minimum 16px font size (prevents iOS zoom)
 * - 44pt minimum send button
 * - Send disabled when input empty
 * - Cmd+Return submits
 */

function makeProps(overrides?: Partial<React.ComponentProps<typeof QueryInput>>) {
  return {
    placeholder: "Ask about your sources...",
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
    ...overrides,
  };
}

describe("QueryInput", () => {
  it("renders textarea with placeholder and aria-label", () => {
    render(<QueryInput {...makeProps()} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("aria-label", "Ask about your sources");
    expect(textarea).toHaveAttribute("placeholder", "Ask about your sources...");
  });

  it("has enterkeyhint=send for mobile keyboards", () => {
    render(<QueryInput {...makeProps()} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("enterkeyhint", "send");
  });

  it("has minimum 16px font size to prevent iOS zoom", () => {
    render(<QueryInput {...makeProps()} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea.style.fontSize).toBe("16px");
  });

  it("send button is disabled when input is empty", () => {
    render(<QueryInput {...makeProps({ value: "" })} />);

    const button = screen.getByRole("button", { name: "Submit query" });
    expect(button).toBeDisabled();
  });

  it("send button is enabled when input has value", () => {
    render(<QueryInput {...makeProps({ value: "test query" })} />);

    const button = screen.getByRole("button", { name: "Submit query" });
    expect(button).not.toBeDisabled();
  });

  it("send button is disabled when loading", () => {
    render(<QueryInput {...makeProps({ value: "test", isLoading: true })} />);

    const button = screen.getByRole("button", { name: "Searching..." });
    expect(button).toBeDisabled();
  });

  it("calls onSubmit when send button is clicked", () => {
    const onSubmit = vi.fn();
    render(<QueryInput {...makeProps({ value: "test query", onSubmit })} />);

    const button = screen.getByRole("button", { name: "Submit query" });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not call onSubmit when send button is clicked with empty value", () => {
    const onSubmit = vi.fn();
    render(<QueryInput {...makeProps({ value: "", onSubmit })} />);

    const button = screen.getByRole("button", { name: "Submit query" });
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onChange when typing", () => {
    const onChange = vi.fn();
    render(<QueryInput {...makeProps({ onChange })} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "new text" } });
    expect(onChange).toHaveBeenCalledWith("new text");
  });

  it("submits on Enter key (not Shift+Enter)", () => {
    const onSubmit = vi.fn();
    render(<QueryInput {...makeProps({ value: "test", onSubmit })} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Shift+Enter", () => {
    const onSubmit = vi.fn();
    render(<QueryInput {...makeProps({ value: "test", onSubmit })} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits on Cmd+Enter (macOS)", () => {
    const onSubmit = vi.fn();
    render(<QueryInput {...makeProps({ value: "test", onSubmit })} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits on Ctrl+Enter (Windows/Linux)", () => {
    const onSubmit = vi.fn();
    render(<QueryInput {...makeProps({ value: "test", onSubmit })} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables textarea when disabled prop is true", () => {
    render(<QueryInput {...makeProps({ disabled: true })} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });

  it("disables textarea when loading", () => {
    render(<QueryInput {...makeProps({ isLoading: true })} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });
});
