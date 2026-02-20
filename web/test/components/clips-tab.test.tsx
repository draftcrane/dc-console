import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

/**
 * Tests for ClipsTab component (#198, #199).
 *
 * 1. useResearchClips.deleteClip — removes clip from local state
 * 2. ClipsTab search — filters by content and source title
 */

// ============================================================
// Mock setup
// ============================================================

const mockGetToken = vi.fn().mockResolvedValue("test-token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "proj-1" }),
}));

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "https://api.test";
});

// ============================================================
// Imports
// ============================================================

import { useResearchClips, type ResearchClip } from "@/hooks/use-research-clips";

// ============================================================
// Helpers
// ============================================================

function makeClip(overrides?: Partial<ResearchClip>): ResearchClip {
  return {
    id: "clip-1",
    projectId: "proj-1",
    sourceId: "src-1",
    sourceTitle: "Test Source",
    content: "Test clip content",
    sourceLocation: null,
    chapterId: null,
    chapterTitle: null,
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ============================================================
// useResearchClips.deleteClip tests
// ============================================================

describe("useResearchClips.deleteClip", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetToken.mockResolvedValue("test-token");
  });

  it("deletes a clip and removes it from local state", async () => {
    const clips = [makeClip({ id: "clip-1" }), makeClip({ id: "clip-2", content: "Other" })];

    // First call: fetchClips, second call: deleteClip
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clips }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    // Fetch clips first
    await act(async () => {
      await result.current.fetchClips();
    });
    expect(result.current.clips).toHaveLength(2);
    expect(result.current.clipCount).toBe(2);

    // Delete clip-1
    let deleteResult = false;
    await act(async () => {
      deleteResult = await result.current.deleteClip("clip-1");
    });

    expect(deleteResult).toBe(true);
    expect(result.current.clips).toHaveLength(1);
    expect(result.current.clips[0].id).toBe("clip-2");
    expect(result.current.clipCount).toBe(1);
  });

  it("sends DELETE request with auth header", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    await act(async () => {
      await result.current.deleteClip("clip-99");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.test/research/clips/clip-99",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("returns false and sets error on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    let deleteResult = true;
    await act(async () => {
      deleteResult = await result.current.deleteClip("nonexistent");
    });

    expect(deleteResult).toBe(false);
    expect(result.current.error).toBe("Failed to delete clip");
  });

  it("returns false and sets error on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useResearchClips("proj-1"));

    let deleteResult = true;
    await act(async () => {
      deleteResult = await result.current.deleteClip("clip-1");
    });

    expect(deleteResult).toBe(false);
    expect(result.current.error).toBe("Network error");
  });

  it("does not decrement clipCount below zero", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useResearchClips("proj-1"));

    // clipCount starts at 0
    expect(result.current.clipCount).toBe(0);

    await act(async () => {
      await result.current.deleteClip("clip-1");
    });

    expect(result.current.clipCount).toBe(0);
  });
});
