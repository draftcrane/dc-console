import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  clearAllDrafts,
  type DraftEntry,
} from "@/lib/indexeddb";

describe("IndexedDB autosave", () => {
  beforeEach(async () => {
    await clearAllDrafts();
  });

  it("round-trips a draft through save and load", async () => {
    const entry: DraftEntry = {
      chapterId: "ch-1",
      content: "<p>Hello world</p>",
      updatedAt: Date.now(),
      version: 1,
    };

    await saveDraft(entry);
    const loaded = await loadDraft("ch-1");

    expect(loaded).not.toBeNull();
    expect(loaded!.chapterId).toBe("ch-1");
    expect(loaded!.content).toBe("<p>Hello world</p>");
    expect(loaded!.version).toBe(1);
  });

  it("returns null for non-existent draft", async () => {
    const loaded = await loadDraft("nonexistent");
    expect(loaded).toBeNull();
  });

  it("overwrites draft on second save", async () => {
    await saveDraft({
      chapterId: "ch-1",
      content: "v1",
      updatedAt: Date.now(),
      version: 1,
    });

    await saveDraft({
      chapterId: "ch-1",
      content: "v2",
      updatedAt: Date.now(),
      version: 2,
    });

    const loaded = await loadDraft("ch-1");
    expect(loaded!.content).toBe("v2");
    expect(loaded!.version).toBe(2);
  });

  it("deletes a draft", async () => {
    await saveDraft({
      chapterId: "ch-1",
      content: "to-delete",
      updatedAt: Date.now(),
      version: 1,
    });

    await deleteDraft("ch-1");
    const loaded = await loadDraft("ch-1");
    expect(loaded).toBeNull();
  });

  it("clearAllDrafts removes everything", async () => {
    await saveDraft({
      chapterId: "ch-1",
      content: "first",
      updatedAt: Date.now(),
      version: 1,
    });
    await saveDraft({
      chapterId: "ch-2",
      content: "second",
      updatedAt: Date.now(),
      version: 1,
    });

    await clearAllDrafts();

    const a = await loadDraft("ch-1");
    const b = await loadDraft("ch-2");
    expect(a).toBeNull();
    expect(b).toBeNull();
  });
});
