/**
 * Snippet response parser for Research Board queries.
 *
 * Parses LLM responses (JSON) into structured snippet objects with source
 * attribution. Designed for the non-streaming JSON mode flow described in
 * ADR-010 (GPT-4o + response_format: json_object).
 *
 * The parser enforces schema compliance and handles malformed responses
 * gracefully, returning partial results when possible.
 */

/** A single snippet extracted from source materials */
export interface Snippet {
  /** Verbatim text extracted from the source chunk */
  content: string;
  /** Source material ID (from chunk metadata) */
  sourceId: string;
  /** Human-readable source name */
  sourceTitle: string;
  /** Section/heading location in source (e.g., "Chapter 3 > Methodology") */
  sourceLocation: string;
  /** Relevance explanation: why this snippet answers the query */
  relevance: string;
}

/** Full parsed result from an LLM research query response */
export interface ResearchQueryResult {
  /** Extracted snippets with source attribution */
  snippets: Snippet[];
  /** Brief synthesis (2-4 sentences) across all snippets */
  summary: string;
  /** True if no relevant information found in sources */
  noResults: boolean;
}

/** Error detail for parse failures */
export interface SnippetParseError {
  /** Human-readable error message */
  message: string;
  /** The raw response that failed to parse (truncated for logging) */
  rawResponse?: string;
}

/** Result of a parse attempt - either success or failure with partial data */
export type SnippetParseResult =
  | { ok: true; data: ResearchQueryResult }
  | { ok: false; error: SnippetParseError; partial: ResearchQueryResult | null };

/** Maximum number of snippets to accept from a single response */
const MAX_SNIPPETS = 8;

/** Maximum length for snippet content (characters) */
const MAX_CONTENT_LENGTH = 10_000;

/** Maximum length for raw response to include in error details */
const MAX_RAW_RESPONSE_LOG = 500;

/**
 * Parse a raw LLM response string into a structured ResearchQueryResult.
 *
 * Handles:
 * - Valid JSON matching the expected schema
 * - JSON wrapped in markdown code fences (```json ... ```)
 * - Partial schema compliance (missing optional fields, extra fields)
 * - Completely malformed responses (not JSON at all)
 * - Empty or whitespace-only responses
 */
export function parseSnippetResponse(raw: string): SnippetParseResult {
  if (!raw || !raw.trim()) {
    return {
      ok: false,
      error: { message: "Empty response from LLM" },
      partial: null,
    };
  }

  // Strip markdown code fences if present (model sometimes wraps in ```json...```)
  const cleaned = stripMarkdownFences(raw);

  // Attempt JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      error: {
        message: "LLM response is not valid JSON",
        rawResponse: raw.slice(0, MAX_RAW_RESPONSE_LOG),
      },
      partial: null,
    };
  }

  // Validate the parsed object
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      error: {
        message: "LLM response is not a JSON object",
        rawResponse: raw.slice(0, MAX_RAW_RESPONSE_LOG),
      },
      partial: null,
    };
  }

  return validateAndExtract(parsed as Record<string, unknown>, raw);
}

/**
 * Validate a parsed JSON object against the ResearchQueryResult schema.
 * Returns validated data, coercing missing optional fields to defaults.
 */
function validateAndExtract(obj: Record<string, unknown>, raw: string): SnippetParseResult {
  const warnings: string[] = [];

  // Track whether the response had any recognizable schema structure
  let hasSnippetsField = false;
  let hasNoResultsField = false;

  // Extract and validate snippets array
  const rawSnippets = obj.snippets;
  let snippets: Snippet[] = [];

  if (!Array.isArray(rawSnippets)) {
    // If no snippets array, check if the whole object looks like a single snippet
    if (typeof obj.content === "string" && typeof obj.sourceId === "string") {
      const single = validateSnippet(obj);
      if (single) {
        snippets = [single];
        hasSnippetsField = true; // Treat unwrapped snippet as a recognized structure
        warnings.push("Response was a single snippet object instead of wrapped in snippets array");
      }
    }

    if (snippets.length === 0) {
      warnings.push("Missing or invalid snippets array");
    }
  } else {
    hasSnippetsField = true;
    for (const item of rawSnippets.slice(0, MAX_SNIPPETS)) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        warnings.push("Skipped non-object item in snippets array");
        continue;
      }
      const snippet = validateSnippet(item as Record<string, unknown>);
      if (snippet) {
        snippets.push(snippet);
      } else {
        warnings.push("Skipped snippet with missing required fields (content or sourceId)");
      }
    }

    if (rawSnippets.length > MAX_SNIPPETS) {
      warnings.push(`Truncated snippets from ${rawSnippets.length} to ${MAX_SNIPPETS}`);
    }
  }

  // Extract summary
  const summary = typeof obj.summary === "string" ? obj.summary : "";

  // Extract noResults flag
  hasNoResultsField = typeof obj.noResults === "boolean" || typeof obj.no_results === "boolean";

  const noResults =
    typeof obj.noResults === "boolean"
      ? obj.noResults
      : typeof obj.no_results === "boolean"
        ? obj.no_results
        : snippets.length === 0;

  const result: ResearchQueryResult = {
    snippets,
    summary,
    noResults,
  };

  // Determine if this is a full success or partial
  if (warnings.length === 0) {
    return { ok: true, data: result };
  }

  // If we got valid snippets, treat as success with the data we have
  if (snippets.length > 0) {
    return { ok: true, data: result };
  }

  // If the response had a recognized snippets field (even empty) or explicit noResults,
  // treat as a valid "no results" response
  if (hasSnippetsField || hasNoResultsField) {
    return { ok: true, data: result };
  }

  // No recognizable structure at all - this is a schema failure
  return {
    ok: false,
    error: {
      message: `Schema validation failed: ${warnings.join("; ")}`,
      rawResponse: raw.slice(0, MAX_RAW_RESPONSE_LOG),
    },
    partial: result.summary ? result : null,
  };
}

/**
 * Validate and extract a single snippet from a parsed object.
 * Returns null if required fields are missing.
 */
function validateSnippet(obj: Record<string, unknown>): Snippet | null {
  // content is required
  const content = typeof obj.content === "string" ? obj.content : null;
  if (!content || !content.trim()) {
    return null;
  }

  // sourceId is required (support both camelCase and snake_case)
  const sourceId =
    typeof obj.sourceId === "string"
      ? obj.sourceId
      : typeof obj.source_id === "string"
        ? obj.source_id
        : null;
  if (!sourceId || !sourceId.trim()) {
    return null;
  }

  // sourceTitle: optional, default to empty string
  const sourceTitle =
    typeof obj.sourceTitle === "string"
      ? obj.sourceTitle
      : typeof obj.source_title === "string"
        ? obj.source_title
        : "";

  // sourceLocation: optional, default to empty string
  const sourceLocation =
    typeof obj.sourceLocation === "string"
      ? obj.sourceLocation
      : typeof obj.source_location === "string"
        ? obj.source_location
        : typeof obj.location_in_source === "string"
          ? obj.location_in_source
          : "";

  // relevance: optional, default to empty string
  const relevance = typeof obj.relevance === "string" ? obj.relevance : "";

  return {
    content: content.slice(0, MAX_CONTENT_LENGTH),
    sourceId,
    sourceTitle,
    sourceLocation,
    relevance,
  };
}

/**
 * Strip markdown code fences from a string.
 * Handles ```json, ```, and leading/trailing whitespace.
 */
function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();

  // Match ```json or ``` at start, ``` at end
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = cleaned.match(fencePattern);
  if (match) {
    cleaned = match[1].trim();
  }

  return cleaned;
}
