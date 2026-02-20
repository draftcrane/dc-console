import { describe, it, expect } from "vitest";
import {
  parseSnippetResponse,
  type ResearchQueryResult,
  type Snippet,
} from "../src/services/snippet-parser.js";

/** Helper to build a valid LLM response JSON string */
function validResponse(overrides?: Partial<ResearchQueryResult>): string {
  return JSON.stringify({
    snippets: [
      {
        content: "The adoption rate of agile methodologies increased by 47% between 2020 and 2023.",
        sourceId: "src-001",
        sourceTitle: "Agile Trends Report 2023",
        sourceLocation: "Chapter 2 > Adoption Metrics",
        relevance: "Directly answers the query about agile adoption rates.",
      },
      {
        content: "Organizations with mature agile practices reported 35% faster time-to-market.",
        sourceId: "src-002",
        sourceTitle: "Enterprise Software Delivery Study",
        sourceLocation: "Section 4 > Performance Outcomes",
        relevance: "Provides supporting data on agile impact.",
      },
    ],
    summary:
      "Agile adoption has grown significantly, with a 47% increase from 2020-2023. Organizations with mature practices see measurable improvements including 35% faster delivery.",
    noResults: false,
    ...overrides,
  });
}

describe("parseSnippetResponse", () => {
  // --- Happy path ---

  describe("valid responses", () => {
    it("parses a well-formed response with multiple snippets", () => {
      const result = parseSnippetResponse(validResponse());

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.snippets).toHaveLength(2);
      expect(result.data.summary).toContain("Agile adoption");
      expect(result.data.noResults).toBe(false);

      const first = result.data.snippets[0];
      expect(first.content).toContain("adoption rate");
      expect(first.sourceId).toBe("src-001");
      expect(first.sourceTitle).toBe("Agile Trends Report 2023");
      expect(first.sourceLocation).toBe("Chapter 2 > Adoption Metrics");
      expect(first.relevance).toContain("agile adoption");
    });

    it("parses a no-results response correctly", () => {
      const result = parseSnippetResponse(
        validResponse({
          snippets: [],
          summary: "No relevant information found in the source materials.",
          noResults: true,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.snippets).toHaveLength(0);
      expect(result.data.noResults).toBe(true);
      expect(result.data.summary).toContain("No relevant information");
    });

    it("handles a single snippet response", () => {
      const result = parseSnippetResponse(
        validResponse({
          snippets: [
            {
              content: "Only one relevant passage found.",
              sourceId: "src-010",
              sourceTitle: "Single Source",
              sourceLocation: "Introduction",
              relevance: "Matches query exactly.",
            },
          ],
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.snippets).toHaveLength(1);
      expect(result.data.snippets[0].sourceId).toBe("src-010");
    });
  });

  // --- Markdown fence handling ---

  describe("markdown fence stripping", () => {
    it("strips ```json fences from response", () => {
      const raw = "```json\n" + validResponse() + "\n```";
      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(2);
    });

    it("strips plain ``` fences from response", () => {
      const raw = "```\n" + validResponse() + "\n```";
      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(2);
    });
  });

  // --- Snake_case field name support ---

  describe("snake_case field support", () => {
    it("accepts snake_case field names for snippets", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Some relevant text about the topic.",
            source_id: "src-snake",
            source_title: "Snake Case Source",
            source_location: "Section 1",
            relevance: "Matches query.",
          },
        ],
        summary: "Found one relevant passage.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.snippets[0].sourceId).toBe("src-snake");
      expect(result.data.snippets[0].sourceTitle).toBe("Snake Case Source");
      expect(result.data.snippets[0].sourceLocation).toBe("Section 1");
    });

    it("accepts no_results as alternative to noResults", () => {
      const raw = JSON.stringify({
        snippets: [],
        summary: "Nothing found.",
        no_results: true,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.noResults).toBe(true);
    });

    it("accepts location_in_source as alternative field name", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Passage about methodology.",
            sourceId: "src-loc",
            sourceTitle: "Methods Paper",
            location_in_source: "Chapter 3 > Methods",
            relevance: "Relevant to methodology query.",
          },
        ],
        summary: "Found one passage.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets[0].sourceLocation).toBe("Chapter 3 > Methods");
    });
  });

  // --- Missing optional fields ---

  describe("missing optional fields", () => {
    it("defaults sourceTitle to empty string when missing", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Important finding.",
            sourceId: "src-minimal",
          },
        ],
        summary: "One result.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.snippets[0].sourceTitle).toBe("");
      expect(result.data.snippets[0].sourceLocation).toBe("");
      expect(result.data.snippets[0].relevance).toBe("");
    });

    it("defaults summary to empty string when missing", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Some text.",
            sourceId: "src-001",
            sourceTitle: "Source",
            sourceLocation: "Section 1",
            relevance: "Relevant.",
          },
        ],
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.summary).toBe("");
    });

    it("infers noResults=true when snippets array is empty and field is missing", () => {
      const raw = JSON.stringify({
        snippets: [],
        summary: "Nothing relevant.",
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.noResults).toBe(true);
    });

    it("infers noResults=false when snippets are present and field is missing", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "A passage.",
            sourceId: "src-001",
            sourceTitle: "Source",
            sourceLocation: "Section 1",
            relevance: "Relevant.",
          },
        ],
        summary: "Found results.",
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.noResults).toBe(false);
    });
  });

  // --- Malformed responses ---

  describe("malformed responses", () => {
    it("returns error for empty string", () => {
      const result = parseSnippetResponse("");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Empty response");
      expect(result.partial).toBeNull();
    });

    it("returns error for whitespace-only string", () => {
      const result = parseSnippetResponse("   \n\t  ");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Empty response");
    });

    it("returns error for non-JSON text", () => {
      const result = parseSnippetResponse("This is just plain text, not JSON.");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not valid JSON");
      expect(result.error.rawResponse).toBeDefined();
    });

    it("returns error for JSON array instead of object", () => {
      const result = parseSnippetResponse('[{"content": "text"}]');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not a JSON object");
    });

    it("returns error for JSON primitive", () => {
      const result = parseSnippetResponse('"just a string"');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not a JSON object");
    });

    it("returns error for null JSON", () => {
      const result = parseSnippetResponse("null");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not a JSON object");
    });

    it("handles truncated JSON gracefully", () => {
      const result = parseSnippetResponse('{"snippets": [{"content": "trun');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not valid JSON");
    });

    it("returns error for object with no snippets array and no recognizable structure", () => {
      const raw = JSON.stringify({ foo: "bar", baz: 42 });
      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Schema validation failed");
    });
  });

  // --- Partial/degraded responses ---

  describe("partial responses", () => {
    it("skips snippets with missing content", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Valid snippet.",
            sourceId: "src-001",
            sourceTitle: "Source A",
            sourceLocation: "Section 1",
            relevance: "Relevant.",
          },
          {
            // Missing content
            sourceId: "src-002",
            sourceTitle: "Source B",
          },
          {
            content: "", // Empty content
            sourceId: "src-003",
          },
        ],
        summary: "Partial results.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(1);
      expect(result.data.snippets[0].sourceId).toBe("src-001");
    });

    it("skips snippets with missing sourceId", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Good snippet.",
            sourceId: "src-001",
            sourceTitle: "Source",
            sourceLocation: "Section 1",
            relevance: "Relevant.",
          },
          {
            content: "Snippet without source ID.",
            // sourceId is missing
            sourceTitle: "Orphan Source",
          },
        ],
        summary: "Results with one orphan.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(1);
      expect(result.data.snippets[0].sourceId).toBe("src-001");
    });

    it("skips non-object items in snippets array", () => {
      const raw = JSON.stringify({
        snippets: [
          "not an object",
          42,
          null,
          {
            content: "Valid one.",
            sourceId: "src-valid",
            sourceTitle: "Source",
            sourceLocation: "Section 1",
            relevance: "Relevant.",
          },
        ],
        summary: "Mixed array.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(1);
      expect(result.data.snippets[0].sourceId).toBe("src-valid");
    });

    it("handles response that is a single unwrapped snippet object", () => {
      const raw = JSON.stringify({
        content: "A passage from the source.",
        sourceId: "src-unwrapped",
        sourceTitle: "Unwrapped Source",
        sourceLocation: "Intro",
        relevance: "Matches the query.",
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(1);
      expect(result.data.snippets[0].sourceId).toBe("src-unwrapped");
      expect(result.data.snippets[0].content).toBe("A passage from the source.");
    });
  });

  // --- Truncation and limits ---

  describe("limits and truncation", () => {
    it("limits snippets to MAX_SNIPPETS (8)", () => {
      const snippets = Array.from({ length: 12 }, (_, i) => ({
        content: `Snippet ${i + 1} content.`,
        sourceId: `src-${String(i + 1).padStart(3, "0")}`,
        sourceTitle: `Source ${i + 1}`,
        sourceLocation: `Section ${i + 1}`,
        relevance: `Relevant passage ${i + 1}.`,
      }));

      const raw = JSON.stringify({ snippets, summary: "Many results.", noResults: false });
      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(8);
    });

    it("truncates raw response in error detail", () => {
      // Generate a very long non-JSON string
      const longText = "x".repeat(1000);
      const result = parseSnippetResponse(longText);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.rawResponse).toBeDefined();
      expect(result.error.rawResponse!.length).toBeLessThanOrEqual(500);
    });

    it("truncates very long snippet content to 10000 chars", () => {
      const longContent = "a".repeat(15000);
      const raw = JSON.stringify({
        snippets: [
          {
            content: longContent,
            sourceId: "src-long",
            sourceTitle: "Long Source",
            sourceLocation: "Full Text",
            relevance: "Contains relevant info.",
          },
        ],
        summary: "Long content.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets[0].content.length).toBe(10000);
    });
  });

  // --- Extra/unexpected fields ---

  describe("extra fields handling", () => {
    it("ignores extra fields at the top level", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Relevant text.",
            sourceId: "src-001",
            sourceTitle: "Source",
            sourceLocation: "Section 1",
            relevance: "Matches.",
          },
        ],
        summary: "One result.",
        noResults: false,
        confidence: 0.95,
        model: "gpt-4o",
        processingTime: 2340,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.snippets).toHaveLength(1);
      // Extra fields are silently ignored
    });

    it("ignores extra fields in snippet objects", () => {
      const raw = JSON.stringify({
        snippets: [
          {
            content: "Text here.",
            sourceId: "src-001",
            sourceTitle: "Source",
            sourceLocation: "Section 1",
            relevance: "Matches.",
            chunkIndex: 3,
            score: 0.92,
            tokenCount: 45,
          },
        ],
        summary: "Done.",
        noResults: false,
      });

      const result = parseSnippetResponse(raw);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const snippet = result.data.snippets[0];
      // Only the defined Snippet fields should be present
      expect(Object.keys(snippet)).toEqual([
        "content",
        "sourceId",
        "sourceTitle",
        "sourceLocation",
        "relevance",
      ]);
    });
  });
});
