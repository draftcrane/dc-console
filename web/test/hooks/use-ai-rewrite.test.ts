import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAIRewrite } from "@/hooks/use-ai-rewrite";
import type { AIRewriteResult } from "@/components/ai-rewrite-sheet";

/**
 * Tests for useAIRewrite — the AI rewrite state machine hook.
 *
 * State machine: idle -> streaming -> complete
 *
 * The hook manages:
 * - Sheet open/close state
 * - Streaming token accumulation
 * - Accept/reject/retry/discard actions
 * - API logging of interactions (fire-and-forget)
 */

function makeOptions(overrides?: Partial<Parameters<typeof useAIRewrite>[0]>) {
  return {
    getToken: vi.fn().mockResolvedValue("test-token"),
    apiUrl: "https://api.test",
    ...overrides,
  };
}

function makeResult(overrides?: Partial<AIRewriteResult>): AIRewriteResult {
  return {
    interactionId: "int-123",
    originalText: "The quick brown fox",
    rewriteText: "A swift auburn fox",
    instruction: "Make it more vivid",
    attemptNumber: 1,
    tier: "frontier",
    ...overrides,
  };
}

describe("useAIRewrite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  // ────────────────────────────────────────────
  // Initial state
  // ────────────────────────────────────────────

  it("starts in idle state with no result or error", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    expect(result.current.sheetState).toBe("idle");
    expect(result.current.currentResult).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  // ────────────────────────────────────────────
  // State transitions: idle -> streaming -> complete
  // ────────────────────────────────────────────

  it("transitions from idle to streaming on startStreaming", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Original text", "Simplify this", "edge");
    });

    expect(result.current.sheetState).toBe("streaming");
    expect(result.current.currentResult).not.toBeNull();
    expect(result.current.currentResult!.originalText).toBe("Original text");
    expect(result.current.currentResult!.instruction).toBe("Simplify this");
    expect(result.current.currentResult!.tier).toBe("edge");
    expect(result.current.currentResult!.rewriteText).toBe("");
    expect(result.current.currentResult!.interactionId).toBe("");
    expect(result.current.currentResult!.attemptNumber).toBe(0);
    expect(result.current.errorMessage).toBeNull();
  });

  it("accumulates tokens during streaming via appendToken", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Original", "Rewrite", "frontier");
    });

    act(() => {
      result.current.appendToken("A ");
    });
    expect(result.current.currentResult!.rewriteText).toBe("A ");

    act(() => {
      result.current.appendToken("swift ");
    });
    expect(result.current.currentResult!.rewriteText).toBe("A swift ");

    act(() => {
      result.current.appendToken("fox");
    });
    expect(result.current.currentResult!.rewriteText).toBe("A swift fox");
  });

  it("transitions from streaming to complete on completeStreaming", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Original", "Rewrite", "frontier");
    });
    act(() => {
      result.current.appendToken("Final text");
    });
    act(() => {
      result.current.completeStreaming("int-456", 1);
    });

    expect(result.current.sheetState).toBe("complete");
    expect(result.current.currentResult!.interactionId).toBe("int-456");
    expect(result.current.currentResult!.attemptNumber).toBe(1);
    expect(result.current.currentResult!.rewriteText).toBe("Final text");
  });

  it("full lifecycle: idle -> streaming -> complete -> idle (accept)", async () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    // idle
    expect(result.current.sheetState).toBe("idle");

    // idle -> streaming
    act(() => {
      result.current.startStreaming("Original text", "Fix grammar", "edge");
    });
    expect(result.current.sheetState).toBe("streaming");

    // streaming: accumulate tokens
    act(() => {
      result.current.appendToken("Corrected text");
    });

    // streaming -> complete
    act(() => {
      result.current.completeStreaming("int-789", 1);
    });
    expect(result.current.sheetState).toBe("complete");

    // complete -> idle (accept)
    const accepted = result.current.currentResult!;
    await act(async () => {
      await result.current.handleAccept(accepted);
    });
    expect(result.current.sheetState).toBe("idle");
    expect(result.current.currentResult).toBeNull();
  });

  // ────────────────────────────────────────────
  // Reset / discard
  // ────────────────────────────────────────────

  it("closeSheet resets all state to idle", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Text", "Instruction", "frontier");
    });
    act(() => {
      result.current.appendToken("Some tokens");
    });

    expect(result.current.sheetState).toBe("streaming");

    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.sheetState).toBe("idle");
    expect(result.current.currentResult).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.hasTokens()).toBe(false);
  });

  it("handleDiscard logs rejection and resets to idle", async () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    const resultData = makeResult();

    await act(async () => {
      await result.current.handleDiscard(resultData);
    });

    // Should have called the reject API
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/ai/interactions/int-123/reject",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );

    expect(result.current.sheetState).toBe("idle");
    expect(result.current.currentResult).toBeNull();
  });

  it("handleDiscard skips API call when interactionId is empty", async () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    const resultData = makeResult({ interactionId: "" });

    await act(async () => {
      await result.current.handleDiscard(resultData);
    });

    // logInteraction should bail out for empty interactionId
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.sheetState).toBe("idle");
  });

  // ────────────────────────────────────────────
  // Error state handling
  // ────────────────────────────────────────────

  it("abortStreaming with error message and partial tokens shows error inline", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Text", "Instruction", "frontier");
    });
    act(() => {
      result.current.appendToken("Partial output");
    });
    act(() => {
      result.current.abortStreaming("Stream interrupted");
    });

    expect(result.current.sheetState).toBe("complete");
    expect(result.current.errorMessage).toBe("Stream interrupted");
    // Partial text should still be available in the result
    expect(result.current.currentResult).not.toBeNull();
  });

  it("abortStreaming with error message and no tokens shows error then complete", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Text", "Instruction", "frontier");
    });

    // No tokens appended
    act(() => {
      result.current.abortStreaming("Connection failed");
    });

    expect(result.current.sheetState).toBe("complete");
    expect(result.current.errorMessage).toBe("Connection failed");
  });

  it("abortStreaming without error message (user cancel) resets to idle", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Text", "Instruction", "frontier");
    });
    act(() => {
      result.current.appendToken("Some text");
    });

    // User cancels — no error message
    act(() => {
      result.current.abortStreaming();
    });

    expect(result.current.sheetState).toBe("idle");
    expect(result.current.currentResult).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  // ────────────────────────────────────────────
  // Accept / reject / retry
  // ────────────────────────────────────────────

  it("handleAccept logs acceptance and returns the result", async () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    const rewriteResult = makeResult();

    let returnedResult: AIRewriteResult | undefined;
    await act(async () => {
      returnedResult = await result.current.handleAccept(rewriteResult);
    });

    expect(returnedResult).toEqual(rewriteResult);

    // Should have called the accept API endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/ai/interactions/int-123/accept",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );

    // Sheet should be closed
    expect(result.current.sheetState).toBe("idle");
  });

  it("handleRetry logs rejection for the current result", async () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    const rewriteResult = makeResult();

    await act(async () => {
      await result.current.handleRetry(rewriteResult, "Try a different approach");
    });

    // Should have called the reject API endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/ai/interactions/int-123/reject",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("handleAccept does not crash when API logging fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    const rewriteResult = makeResult();

    let returnedResult: AIRewriteResult | undefined;
    await act(async () => {
      returnedResult = await result.current.handleAccept(rewriteResult);
    });

    // Accept should still return the result and close the sheet
    expect(returnedResult).toEqual(rewriteResult);
    expect(result.current.sheetState).toBe("idle");

    consoleErrorSpy.mockRestore();
  });

  // ────────────────────────────────────────────
  // setTier
  // ────────────────────────────────────────────

  it("setTier updates the tier on the current result", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Text", "Instruction", "edge");
    });
    expect(result.current.currentResult!.tier).toBe("edge");

    act(() => {
      result.current.setTier("frontier");
    });
    expect(result.current.currentResult!.tier).toBe("frontier");
  });

  it("setTier is a no-op when there is no current result", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    // Should not throw
    act(() => {
      result.current.setTier("frontier");
    });

    expect(result.current.currentResult).toBeNull();
  });

  // ────────────────────────────────────────────
  // hasTokens
  // ────────────────────────────────────────────

  it("hasTokens returns false before any tokens are appended", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    expect(result.current.hasTokens()).toBe(false);
  });

  it("hasTokens returns true after tokens are appended", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Text", "Instruction", "frontier");
    });
    act(() => {
      result.current.appendToken("token");
    });

    expect(result.current.hasTokens()).toBe(true);
  });

  it("hasTokens returns false after closeSheet resets state", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    act(() => {
      result.current.startStreaming("Text", "Instruction", "frontier");
    });
    act(() => {
      result.current.appendToken("token");
    });
    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.hasTokens()).toBe(false);
  });

  // ────────────────────────────────────────────
  // startStreaming clears previous error state
  // ────────────────────────────────────────────

  it("startStreaming clears any previous error message", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    // Create an error state
    act(() => {
      result.current.startStreaming("Text", "Instruction", "frontier");
    });
    act(() => {
      result.current.abortStreaming("Something went wrong");
    });
    expect(result.current.errorMessage).toBe("Something went wrong");

    // Start a new streaming session
    act(() => {
      result.current.startStreaming("New text", "New instruction", "edge");
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.sheetState).toBe("streaming");
    expect(result.current.currentResult!.originalText).toBe("New text");
  });

  // ────────────────────────────────────────────
  // Token accumulation resets between sessions
  // ────────────────────────────────────────────

  it("tokens from a previous session do not leak into a new session", () => {
    const { result } = renderHook(() => useAIRewrite(makeOptions()));

    // Session 1
    act(() => {
      result.current.startStreaming("Text 1", "Instr 1", "frontier");
    });
    act(() => {
      result.current.appendToken("Old tokens");
    });
    act(() => {
      result.current.closeSheet();
    });

    // Session 2
    act(() => {
      result.current.startStreaming("Text 2", "Instr 2", "edge");
    });

    // The rewriteText should be empty, not carry over "Old tokens"
    expect(result.current.currentResult!.rewriteText).toBe("");

    // Append new tokens
    act(() => {
      result.current.appendToken("New tokens");
    });
    expect(result.current.currentResult!.rewriteText).toBe("New tokens");
  });

  // ────────────────────────────────────────────
  // getToken failure does not crash logging
  // ────────────────────────────────────────────

  it("handleAccept does not crash when getToken returns null", async () => {
    const { result } = renderHook(() =>
      useAIRewrite(makeOptions({ getToken: vi.fn().mockResolvedValue(null) })),
    );

    const rewriteResult = makeResult();

    let returnedResult: AIRewriteResult | undefined;
    await act(async () => {
      returnedResult = await result.current.handleAccept(rewriteResult);
    });

    // Should return the result and close sheet even when token is null
    expect(returnedResult).toEqual(rewriteResult);
    expect(result.current.sheetState).toBe("idle");
    // fetch should not have been called because getToken returned null
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
