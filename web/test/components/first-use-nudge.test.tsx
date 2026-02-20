import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  isNudgeDismissed,
  dismissNudge,
  useFirstUseNudge,
  PulsingDot,
  FirstUseNudge,
} from "@/components/research/first-use-nudge";

// ============================================================
// Mock localStorage
// ============================================================

let storage: Record<string, string>;

function mockLocalStorage() {
  storage = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      storage = {};
    },
  });
}

// ============================================================
// Unit tests for localStorage helpers
// ============================================================

describe("isNudgeDismissed", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("returns false when no value is stored", () => {
    expect(isNudgeDismissed("proj-1")).toBe(false);
  });

  it("returns true when value is 'true'", () => {
    storage["research-nudge-dismissed-proj-1"] = "true";
    expect(isNudgeDismissed("proj-1")).toBe(true);
  });

  it("returns false for a different projectId", () => {
    storage["research-nudge-dismissed-proj-1"] = "true";
    expect(isNudgeDismissed("proj-2")).toBe(false);
  });

  it("returns false when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("access denied");
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(isNudgeDismissed("proj-1")).toBe(false);
  });
});

describe("dismissNudge", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("sets the storage key to 'true'", () => {
    dismissNudge("proj-1");
    expect(storage["research-nudge-dismissed-proj-1"]).toBe("true");
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("access denied");
      },
      removeItem: () => {},
    });
    expect(() => dismissNudge("proj-1")).not.toThrow();
  });
});

// ============================================================
// Unit tests for useFirstUseNudge hook
// ============================================================

describe("useFirstUseNudge", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("shows pulsing dot when project has no sources and nudge not dismissed", () => {
    const { result } = renderHook(() =>
      useFirstUseNudge({
        projectId: "proj-1",
        hasAnySources: false,
        isResearchPanelOpen: false,
      }),
    );

    expect(result.current.showPulsingDot).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it("does not show pulsing dot when project has sources", () => {
    const { result } = renderHook(() =>
      useFirstUseNudge({
        projectId: "proj-1",
        hasAnySources: true,
        isResearchPanelOpen: false,
      }),
    );

    expect(result.current.showPulsingDot).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it("does not show pulsing dot when nudge was previously dismissed", () => {
    storage["research-nudge-dismissed-proj-1"] = "true";

    const { result } = renderHook(() =>
      useFirstUseNudge({
        projectId: "proj-1",
        hasAnySources: false,
        isResearchPanelOpen: false,
      }),
    );

    expect(result.current.showPulsingDot).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it("does not show pulsing dot when panel is open", () => {
    const { result } = renderHook(() =>
      useFirstUseNudge({
        projectId: "proj-1",
        hasAnySources: false,
        isResearchPanelOpen: true,
      }),
    );

    expect(result.current.showPulsingDot).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it("permanently dismisses when panel opens", () => {
    const { result, rerender } = renderHook((props) => useFirstUseNudge(props), {
      initialProps: {
        projectId: "proj-1",
        hasAnySources: false,
        isResearchPanelOpen: false,
      },
    });

    expect(result.current.showPulsingDot).toBe(true);

    // Simulate opening the panel
    rerender({
      projectId: "proj-1",
      hasAnySources: false,
      isResearchPanelOpen: true,
    });

    expect(result.current.showPulsingDot).toBe(false);

    // localStorage should be set
    expect(storage["research-nudge-dismissed-proj-1"]).toBe("true");
  });

  it("uses per-project storage key", () => {
    // Dismiss for proj-1
    storage["research-nudge-dismissed-proj-1"] = "true";

    // proj-2 should still show nudge
    const { result } = renderHook(() =>
      useFirstUseNudge({
        projectId: "proj-2",
        hasAnySources: false,
        isResearchPanelOpen: false,
      }),
    );

    expect(result.current.showPulsingDot).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it("is inactive when project has sources even if not dismissed", () => {
    const { result } = renderHook(() =>
      useFirstUseNudge({
        projectId: "proj-1",
        hasAnySources: true,
        isResearchPanelOpen: false,
      }),
    );

    expect(result.current.isActive).toBe(false);
    expect(result.current.showPulsingDot).toBe(false);
  });
});

// ============================================================
// Component tests
// ============================================================

describe("PulsingDot", () => {
  it("renders a span with the pulsing dot class", () => {
    const { container } = render(<PulsingDot />);
    const dot = container.querySelector(".research-nudge-dot");
    expect(dot).toBeTruthy();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("FirstUseNudge component", () => {
  beforeEach(() => {
    mockLocalStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createTargetRef() {
    const button = document.createElement("button");
    button.getBoundingClientRect = () => ({
      top: 10,
      right: 200,
      bottom: 50,
      left: 100,
      width: 100,
      height: 40,
      x: 100,
      y: 10,
      toJSON: () => {},
    });
    document.body.appendChild(button);

    return {
      ref: { current: button },
      cleanup: () => document.body.removeChild(button),
    };
  }

  it("renders tooltip after 500ms delay when isActive is true", () => {
    const { ref, cleanup } = createTargetRef();

    render(<FirstUseNudge isActive={true} targetRef={ref} />);

    // Before delay -- no tooltip yet
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Have research files? Tap here to bring them in.")).toBeInTheDocument();

    cleanup();
  });

  it("auto-dismisses tooltip after 8 seconds", () => {
    const { ref, cleanup } = createTargetRef();

    render(<FirstUseNudge isActive={true} targetRef={ref} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    cleanup();
  });

  it("does not render when isActive is false", () => {
    const { ref, cleanup } = createTargetRef();

    render(<FirstUseNudge isActive={false} targetRef={ref} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    cleanup();
  });

  it("dismisses tooltip when backdrop is clicked", () => {
    const { ref, cleanup } = createTargetRef();

    render(<FirstUseNudge isActive={true} targetRef={ref} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Click the invisible backdrop (the fixed inset-0 div)
    const backdrops = document.querySelectorAll(".fixed.inset-0");
    const backdrop = backdrops[backdrops.length - 1]; // get the last one (ours)
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    cleanup();
  });

  it("tooltip text matches acceptance criteria", () => {
    const { ref, cleanup } = createTargetRef();

    render(<FirstUseNudge isActive={true} targetRef={ref} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("Have research files? Tap here to bring them in.")).toBeInTheDocument();

    cleanup();
  });
});
