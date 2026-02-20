/**
 * Prompt builder for DraftCrane Research Board queries.
 *
 * Combines user queries with retrieved source chunks into well-structured
 * LLM prompts. Implements the production prompt templates from ADR-010
 * and the context assembly format from ADR-009.
 *
 * Two prompt types:
 * 1. Research query prompts (Research Board "Ask" tab) - non-streaming JSON
 * 2. Source-aware rewrite prompts (AI rewrite with source context) - streaming
 *
 * This module is responsible for prompt assembly only. It does not make API
 * calls -- that is handled by the route handlers and AI provider services.
 */

import type { Chunk } from "./chunking.js";
import {
  selectChunksWithinBudget,
  deduplicateChunks,
  sortChunksByDocumentOrder,
  estimateTokens,
  type TokenBudget,
  type BudgetResult,
} from "./context-window.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of building a research query prompt */
export interface ResearchPrompt {
  /** System prompt for the LLM */
  systemPrompt: string;
  /** User message containing query and source chunks */
  userMessage: string;
  /** Estimated total input tokens (system + user) */
  estimatedInputTokens: number;
  /** Metadata about chunk selection */
  chunkSelection: BudgetResult;
}

/** Snippet result from LLM research query (matches ADR-010 schema) */
export interface SnippetResult {
  /** Verbatim text extracted from source chunk */
  content: string;
  /** Source material ID (from chunk metadata) */
  sourceId: string;
  /** Human-readable source name */
  sourceTitle: string;
  /** Section/heading location in source */
  sourceLocation: string;
  /** Relevance: why this snippet answers the query */
  relevance: string;
}

/** Full research query result from LLM (matches ADR-010 schema) */
export interface ResearchQueryResult {
  snippets: SnippetResult[];
  /** Brief synthesis (2-4 sentences) across all snippets */
  summary: string;
  /** True if no relevant information found in sources */
  noResults: boolean;
}

// ---------------------------------------------------------------------------
// System prompt (from ADR-010 production template)
// ---------------------------------------------------------------------------

const RESEARCH_SYSTEM_PROMPT = `You are a research extraction assistant for a nonfiction book writing tool. Your job is to find and extract relevant passages from the author's source materials that answer their research query.

## Your Task

Given a user's research query and a set of source material chunks, you must:

1. Identify which chunks contain information relevant to the query
2. Extract verbatim passages from relevant chunks — NEVER paraphrase or reword
3. Attribute each extracted passage to its source with the exact sourceId and sourceTitle from the chunk metadata
4. Synthesize a brief summary across all extracted passages

## Extraction Rules

- VERBATIM ONLY: Every snippet's \`content\` field must contain text that appears EXACTLY in the source chunk. Do not rephrase, summarize, or combine text from different chunks into a single snippet.
- One snippet per relevant passage: If a chunk contains multiple relevant passages, extract each as a separate snippet.
- Source attribution must match metadata: The \`sourceId\` and \`sourceTitle\` in each snippet must exactly match the values from the source chunk header.
- sourceLocation: Use the heading/section information from the chunk header (e.g., "Chapter 3 > Methodology"). If the chunk header shows "Section N of M", use that.
- relevance: One sentence explaining why this specific passage answers the query.
- summary: 2-4 sentences synthesizing the key findings across all extracted snippets.
- Maximum snippets: Extract at most 8 snippets. Prioritize the most relevant and information-dense passages.

## No Results

If NONE of the provided source chunks contain information relevant to the query:
- Set \`noResults\` to \`true\`
- Return an empty \`snippets\` array
- Set \`summary\` to a brief explanation that the source materials do not contain relevant information

## Response Format

Respond with a JSON object matching this schema:

{
  "snippets": [
    {
      "content": "Exact verbatim text from the source chunk",
      "sourceId": "source-id-from-metadata",
      "sourceTitle": "Source Title from Metadata",
      "sourceLocation": "Heading Chain from chunk header",
      "relevance": "Why this passage answers the query"
    }
  ],
  "summary": "Brief synthesis across all snippets",
  "noResults": false
}

Respond ONLY with valid JSON. No markdown fences, no explanation, no preamble.`;

// ---------------------------------------------------------------------------
// Chunk formatting (ADR-009 context assembly format)
// ---------------------------------------------------------------------------

/**
 * Format source chunks into the ADR-009 context assembly format.
 *
 * Each chunk is rendered with source attribution headers:
 * ```
 * [Source: "Title" (id: sourceId), Section: "Heading Chain"]
 * <chunk text>
 *
 * ---
 * ```
 */
export function formatChunksForPrompt(chunks: Chunk[]): string {
  return chunks
    .map((chunk) => {
      const section =
        chunk.headingChain.length > 0 ? chunk.headingChain.join(" > ") : "Full document";
      return `[Source: "${chunk.sourceTitle}" (id: ${chunk.sourceId}), Section: "${section}"]\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Build the user message containing the query and formatted source chunks.
 */
export function buildResearchUserMessage(query: string, chunks: Chunk[]): string {
  const formattedChunks = formatChunksForPrompt(chunks);

  return `## Research Query

${query}

## Source Materials

The following are chunks from the author's source materials. Extract verbatim passages that answer the research query above.

${formattedChunks}`;
}

// ---------------------------------------------------------------------------
// Research query prompt builder (main entry point)
// ---------------------------------------------------------------------------

/**
 * Build a complete research query prompt from user query and candidate chunks.
 *
 * This is the main entry point for Research Board "Ask" tab queries.
 * It handles the full pipeline:
 * 1. Deduplicate chunks (overlap between adjacent chunks)
 * 2. Select chunks within token budget
 * 3. Sort selected chunks by document order for coherent context
 * 4. Format into system + user message pair
 *
 * @param query - User's natural language research query
 * @param chunks - Candidate chunks from hybrid retrieval, sorted by relevance
 * @param budget - Optional token budget overrides
 * @returns Complete prompt ready for LLM API call
 */
export function buildResearchPrompt(
  query: string,
  chunks: Chunk[],
  budget?: Partial<TokenBudget>,
): ResearchPrompt {
  // Step 1: Deduplicate
  const deduped = deduplicateChunks(chunks);

  // Step 2: Select within budget (preserving relevance order for selection)
  const chunkSelection = selectChunksWithinBudget(deduped, budget);

  // Step 3: Sort selected chunks by document order for coherent reading
  const orderedChunks = sortChunksByDocumentOrder(chunkSelection.selectedChunks);

  // Step 4: Build prompt components
  const systemPrompt = RESEARCH_SYSTEM_PROMPT;
  const userMessage = buildResearchUserMessage(query, orderedChunks);

  // Estimate total input tokens
  const estimatedInputTokens = estimateTokens(systemPrompt) + estimateTokens(userMessage);

  return {
    systemPrompt,
    userMessage,
    estimatedInputTokens,
    chunkSelection,
  };
}

// ---------------------------------------------------------------------------
// Source-aware rewrite prompt builder
// ---------------------------------------------------------------------------

/**
 * Build source context for injection into AI rewrite prompts.
 *
 * This is used by the existing AI rewrite flow (POST /ai/rewrite) to add
 * source material context alongside the selected text and instruction.
 * Per ADR-009: the `buildSystemPrompt()` function in ai-rewrite.ts gains
 * a source context section.
 *
 * @param chunks - Retrieved source chunks relevant to the rewrite instruction
 * @param budget - Optional token budget overrides
 * @returns Formatted source context string, or null if no chunks available
 */
export function buildSourceContextForRewrite(
  chunks: Chunk[],
  budget?: Partial<TokenBudget>,
): string | null {
  if (!chunks.length) return null;

  const deduped = deduplicateChunks(chunks);
  const { selectedChunks } = selectChunksWithinBudget(deduped, budget);

  if (!selectedChunks.length) return null;

  const ordered = sortChunksByDocumentOrder(selectedChunks);
  return formatChunksForPrompt(ordered);
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

/**
 * Validate that an LLM response conforms to the ResearchQueryResult schema.
 * Returns null if valid, or an error message describing the first validation failure.
 */
export function validateResearchResponse(obj: unknown): string | null {
  if (typeof obj !== "object" || obj === null) {
    return "Response is not an object";
  }

  const r = obj as Record<string, unknown>;

  if (!Array.isArray(r.snippets)) {
    return "Missing or invalid 'snippets' array";
  }

  if (typeof r.summary !== "string") {
    return "Missing or invalid 'summary' string";
  }

  if (typeof r.noResults !== "boolean") {
    return "Missing or invalid 'noResults' boolean";
  }

  for (let i = 0; i < r.snippets.length; i++) {
    const s = r.snippets[i] as Record<string, unknown>;
    if (typeof s.content !== "string") {
      return `snippets[${i}]: missing or invalid 'content' string`;
    }
    if (typeof s.sourceId !== "string") {
      return `snippets[${i}]: missing or invalid 'sourceId' string`;
    }
    if (typeof s.sourceTitle !== "string") {
      return `snippets[${i}]: missing or invalid 'sourceTitle' string`;
    }
    if (typeof s.sourceLocation !== "string") {
      return `snippets[${i}]: missing or invalid 'sourceLocation' string`;
    }
    if (typeof s.relevance !== "string") {
      return `snippets[${i}]: missing or invalid 'relevance' string`;
    }
  }

  return null;
}

/**
 * Parse and validate a raw LLM response string into a ResearchQueryResult.
 * Handles markdown fence stripping and JSON parsing.
 *
 * @param raw - Raw string from LLM response
 * @returns Parsed result and any parse/validation errors
 */
export function parseResearchResponse(raw: string): {
  result: ResearchQueryResult | null;
  error: string | null;
} {
  try {
    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();

    const obj = JSON.parse(cleaned);
    const validationError = validateResearchResponse(obj);

    if (validationError) {
      return { result: null, error: `Schema validation: ${validationError}` };
    }

    return { result: obj as ResearchQueryResult, error: null };
  } catch (e) {
    return {
      result: null,
      error: `JSON parse failed: ${(e as Error).message}`,
    };
  }
}
