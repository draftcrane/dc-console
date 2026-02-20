import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ResearchQueryState, ConversationEntry } from "@/hooks/use-ai-research";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "proj-1" }),
}));

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("test-token"),
  }),
}));

// Mock ResearchPanelProvider
const mockSetActiveTab = vi.fn();
const mockViewSource = vi.fn();
vi.mock("@/components/research/research-panel-provider", () => ({
  useResearchPanel: () => ({
    setActiveTab: mockSetActiveTab,
    viewSource: mockViewSource,
  }),
}));

// Mock useAIResearch hook to control state in tests
const mockSubmitQuery = vi.fn();
const mockSetQueryInput = vi.fn();
const mockRetry = vi.fn();
const mockSaveToClips = vi.fn().mockResolvedValue({ success: true });
const mockAbort = vi.fn();

let mockResearchState: {
  state: ResearchQueryState;
  queryInput: string;
  setQueryInput: typeof mockSetQueryInput;
  submitQuery: typeof mockSubmitQuery;
  retry: typeof mockRetry;
  conversation: ConversationEntry[];
  currentResult: null | Record<string, unknown>;
  errorMessage: string | null;
  noSources: boolean;
  sourceCount: number | null;
  abort: typeof mockAbort;
  saveToClips: typeof mockSaveToClips;
  savedSnippetKeys: Set<string>;
} = {
  state: "idle",
  queryInput: "",
  setQueryInput: mockSetQueryInput,
  submitQuery: mockSubmitQuery,
  retry: mockRetry,
  conversation: [],
  currentResult: null,
  errorMessage: null,
  noSources: false,
  sourceCount: null,
  abort: mockAbort,
  saveToClips: mockSaveToClips,
  savedSnippetKeys: new Set<string>(),
};

vi.mock("@/hooks/use-ai-research", () => ({
  useAIResearch: () => mockResearchState,
  snippetKey: (s: { sourceId: string | null; content: string }) =>
    `${s.sourceId || ""}:${s.content.slice(0, 100)}`,
}));

import { AskTab } from "@/components/research/ask-tab";

/**
 * Tests for AskTab — the AI natural-language query tab.
 *
 * Key requirements per design spec:
 * - Empty state shows 3 suggested queries
 * - No-sources state shows "Add source documents first"
 * - Error state shows retry button
 * - Conversation history with Q&A pairs
 * - Query input at bottom
 */

describe("AskTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResearchState = {
      state: "idle",
      queryInput: "",
      setQueryInput: mockSetQueryInput,
      submitQuery: mockSubmitQuery,
      retry: mockRetry,
      conversation: [],
      currentResult: null,
      errorMessage: null,
      noSources: false,
      sourceCount: null,
      abort: mockAbort,
      saveToClips: mockSaveToClips,
      savedSnippetKeys: new Set(),
    };
  });

  // --- Empty state ---

  it("shows empty state with suggested queries", () => {
    render(<AskTab />);

    expect(screen.getByText("Ask about your sources")).toBeInTheDocument();
    expect(screen.getByText("What are the key themes across my sources?")).toBeInTheDocument();
    expect(screen.getByText("Find quotes about leadership and teamwork")).toBeInTheDocument();
    expect(screen.getByText("Summarize the main arguments in my research")).toBeInTheDocument();
  });

  it("suggested queries are tappable and auto-submit", () => {
    render(<AskTab />);

    const suggestedQuery = screen.getByText("What are the key themes across my sources?");
    fireEvent.click(suggestedQuery);

    expect(mockSetQueryInput).toHaveBeenCalledWith("What are the key themes across my sources?");
    expect(mockSubmitQuery).toHaveBeenCalledWith("What are the key themes across my sources?");
  });

  // --- No sources state ---

  it("shows no-sources state with link to Sources tab", () => {
    mockResearchState.noSources = true;
    render(<AskTab />);

    expect(screen.getByText("Add source documents first")).toBeInTheDocument();
    expect(screen.getByText(/You need at least one source document/)).toBeInTheDocument();

    const goToSources = screen.getByText("Go to Sources");
    expect(goToSources).toBeInTheDocument();
  });

  it("Go to Sources navigates to sources tab", () => {
    mockResearchState.noSources = true;
    render(<AskTab />);

    fireEvent.click(screen.getByText("Go to Sources"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("sources");
  });

  // --- Error state ---

  it("shows error state with retry button when no conversation", () => {
    mockResearchState.state = "error";
    mockResearchState.errorMessage = "Something went wrong. Please try again.";
    render(<AskTab />);

    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();

    const retryButton = screen.getByText("Retry");
    expect(retryButton).toBeInTheDocument();
  });

  it("retry button calls retry function", () => {
    mockResearchState.state = "error";
    mockResearchState.errorMessage = "Something went wrong.";
    render(<AskTab />);

    fireEvent.click(screen.getByText("Retry"));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  // --- Conversation display ---

  it("shows conversation history with Q&A pairs", () => {
    mockResearchState.state = "complete";
    mockResearchState.conversation = [
      {
        id: "entry-1",
        query: "What about leadership?",
        result: {
          id: "entry-1",
          query: "What about leadership?",
          snippets: [
            {
              content: "Leadership passage text",
              sourceId: "src-1",
              sourceTitle: "Workshop Notes",
              sourceLocation: "Page 5",
              relevance: 0.9,
            },
          ],
          summary: null,
          noResults: false,
          error: null,
          isStreaming: false,
          resultCount: 1,
          processingTimeMs: 1500,
        },
      },
    ];

    render(<AskTab />);

    // User query
    expect(screen.getByText("What about leadership?")).toBeInTheDocument();
    // Result card content
    expect(screen.getByText(/Leadership passage text/)).toBeInTheDocument();
    // Source title
    expect(screen.getByText("Workshop Notes")).toBeInTheDocument();
    // Result count
    expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
  });

  it("shows no-results message when query returns empty", () => {
    mockResearchState.state = "complete";
    mockResearchState.conversation = [
      {
        id: "entry-1",
        query: "Something obscure",
        result: {
          id: "entry-1",
          query: "Something obscure",
          snippets: [],
          summary: null,
          noResults: true,
          error: null,
          isStreaming: false,
          resultCount: 0,
          processingTimeMs: 800,
        },
      },
    ];

    render(<AskTab />);

    expect(screen.getByText("No relevant results found")).toBeInTheDocument();
    expect(screen.getByText(/Try rephrasing your question/)).toBeInTheDocument();
  });

  // --- Query input ---

  it("renders query input at bottom", () => {
    render(<AskTab />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Ask about your sources...");
  });

  it("query input is disabled when no sources", () => {
    mockResearchState.noSources = true;
    render(<AskTab />);

    // In no-sources state the full AskTab changes to NoSourcesState
    // so the query input should not be visible
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  // --- Source navigation ---

  it("tapping source title navigates to source detail with return to ask", () => {
    mockResearchState.state = "complete";
    mockResearchState.conversation = [
      {
        id: "entry-1",
        query: "Test",
        result: {
          id: "entry-1",
          query: "Test",
          snippets: [
            {
              content: "Passage text",
              sourceId: "src-1",
              sourceTitle: "My Source",
              sourceLocation: null,
              relevance: 0.9,
            },
          ],
          summary: null,
          noResults: false,
          error: null,
          isStreaming: false,
          resultCount: 1,
          processingTimeMs: 500,
        },
      },
    ];

    render(<AskTab />);

    fireEvent.click(screen.getByText("My Source"));
    expect(mockViewSource).toHaveBeenCalledWith("src-1", "ask");
  });
});
