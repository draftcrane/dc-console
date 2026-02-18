import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseDismissState, computeShouldShow } from "../use-drive-banner-dismiss";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "dc_drive_banner_dismiss";

describe("parseDismissState", () => {
  it("returns zero state for null", () => {
    expect(parseDismissState(null)).toEqual({ count: 0, timestamp: 0 });
  });

  it("returns zero state for empty string", () => {
    expect(parseDismissState("")).toEqual({ count: 0, timestamp: 0 });
  });

  it("returns zero state for missing separator", () => {
    expect(parseDismissState("garbage")).toEqual({ count: 0, timestamp: 0 });
  });

  it("returns zero state for non-numeric values", () => {
    expect(parseDismissState("abc:def")).toEqual({ count: 0, timestamp: 0 });
  });

  it("returns zero state for negative count", () => {
    expect(parseDismissState("-1:1000")).toEqual({ count: 0, timestamp: 0 });
  });

  it("parses valid state", () => {
    expect(parseDismissState("1:1708200000000")).toEqual({
      count: 1,
      timestamp: 1708200000000,
    });
  });

  it("parses count of 2", () => {
    expect(parseDismissState("2:1708200000000")).toEqual({
      count: 2,
      timestamp: 1708200000000,
    });
  });
});

describe("computeShouldShow", () => {
  const now = 1708200000000;

  it("shows banner when count is 0 (fresh state)", () => {
    expect(computeShouldShow(0, 0, now)).toBe(true);
  });

  it("hides banner when count is 1 and within 7 days", () => {
    const recentDismiss = now - 1000; // 1 second ago
    expect(computeShouldShow(1, recentDismiss, now)).toBe(false);
  });

  it("hides banner when count is 1 and exactly at 7 days minus 1ms", () => {
    const almostExpired = now - SEVEN_DAYS_MS + 1;
    expect(computeShouldShow(1, almostExpired, now)).toBe(false);
  });

  it("shows banner when count is 1 and exactly 7 days have passed", () => {
    const expired = now - SEVEN_DAYS_MS;
    expect(computeShouldShow(1, expired, now)).toBe(true);
  });

  it("shows banner when count is 1 and more than 7 days have passed", () => {
    const longAgo = now - SEVEN_DAYS_MS - 1000;
    expect(computeShouldShow(1, longAgo, now)).toBe(true);
  });

  it("permanently hides banner when count is 2", () => {
    expect(computeShouldShow(2, now, now)).toBe(false);
  });

  it("permanently hides banner when count is greater than 2", () => {
    expect(computeShouldShow(5, 0, now)).toBe(false);
  });
});

describe("localStorage integration", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    });
  });

  it("fresh state: no localStorage entry means show banner", () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const { count, timestamp } = parseDismissState(raw);
    expect(computeShouldShow(count, timestamp)).toBe(true);
    expect(count).toBe(0);
  });

  it("first dismiss: writes count 1 and hides banner", () => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, `1:${now}`);

    const raw = localStorage.getItem(STORAGE_KEY);
    const { count, timestamp } = parseDismissState(raw);
    expect(count).toBe(1);
    expect(computeShouldShow(count, timestamp, now + 1000)).toBe(false);
  });

  it("after 7+ days with 1 dismiss: shows banner again", () => {
    const dismissTime = Date.now() - SEVEN_DAYS_MS - 1000;
    localStorage.setItem(STORAGE_KEY, `1:${dismissTime}`);

    const raw = localStorage.getItem(STORAGE_KEY);
    const { count, timestamp } = parseDismissState(raw);
    expect(count).toBe(1);
    expect(computeShouldShow(count, timestamp)).toBe(true);
  });

  it("second dismiss: permanently hides banner", () => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, `2:${now}`);

    const raw = localStorage.getItem(STORAGE_KEY);
    const { count, timestamp } = parseDismissState(raw);
    expect(count).toBe(2);
    expect(computeShouldShow(count, timestamp)).toBe(false);
  });

  it("corrupted localStorage value: falls back to showing banner", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-data");

    const raw = localStorage.getItem(STORAGE_KEY);
    const { count, timestamp } = parseDismissState(raw);
    expect(count).toBe(0);
    expect(computeShouldShow(count, timestamp)).toBe(true);
  });

  it("localStorage throws: parseDismissState handles null gracefully", () => {
    // Simulates what happens when getSnapshot catches and returns null
    const { count, timestamp } = parseDismissState(null);
    expect(count).toBe(0);
    expect(computeShouldShow(count, timestamp)).toBe(true);
  });
});
