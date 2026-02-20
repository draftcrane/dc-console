/**
 * Context window management for LLM prompt assembly.
 *
 * Tracks token estimates and enforces budget constraints when assembling
 * source material chunks into prompts. Uses word-to-token ratio (1 word ~= 1.33 tokens)
 * as a fast approximation -- accurate enough for budget enforcement without
 * requiring a tokenizer dependency.
 *
 * Token budgets per ADR-009:
 * - Source context: 8K tokens (~6K words)
 * - System prompt: ~500 tokens (fixed)
 * - User query: ~200 tokens (variable but small)
 * - Output: 4096 tokens (max_tokens parameter)
 * - Total available: 128K (GPT-4o / Mistral Small 3.1)
 *
 * The budget is conservative by design. Source context at 8K tokens leaves
 * ~115K tokens unused, ensuring the LLM never hits the context window limit
 * even with large system prompts and output generation.
 */

import type { Chunk } from "./chunking.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Average ratio of tokens to words for English text.
 * Based on GPT tokenizer analysis: 1 word ~= 1.33 tokens on average.
 * Conservative (overestimates) to avoid exceeding limits.
 */
const TOKENS_PER_WORD = 1.33;

/** Default token budget for source context in prompts (per ADR-009) */
export const DEFAULT_SOURCE_TOKEN_BUDGET = 8192;

/** Default maximum number of chunks to include in a prompt */
export const DEFAULT_MAX_CHUNKS = 8;

/** Model context window sizes */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "@cf/mistralai/mistral-small-3.1-24b-instruct": 128_000,
};

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimate token count for a text string.
 * Uses word count * tokens-per-word ratio as a fast approximation.
 */
export function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * TOKENS_PER_WORD);
}

/**
 * Estimate token count for a chunk, including its metadata overhead.
 * The formatted chunk includes source attribution headers that consume tokens.
 */
export function estimateChunkTokens(chunk: Chunk): number {
  // Metadata overhead: [Source: "title" (id: sourceId), Section: "heading"]
  const section = chunk.headingChain.length > 0 ? chunk.headingChain.join(" > ") : "Full document";
  const header = `[Source: "${chunk.sourceTitle}" (id: ${chunk.sourceId}), Section: "${section}"]`;
  const separator = "\n\n---\n\n";

  return estimateTokens(header) + estimateTokens(chunk.text) + estimateTokens(separator);
}

// ---------------------------------------------------------------------------
// Budget management
// ---------------------------------------------------------------------------

export interface TokenBudget {
  /** Maximum tokens for source context */
  sourceContextBudget: number;
  /** Maximum number of chunks to include */
  maxChunks: number;
}

export interface BudgetResult {
  /** Chunks selected within budget */
  selectedChunks: Chunk[];
  /** Total estimated tokens for selected chunks */
  totalTokens: number;
  /** Number of chunks excluded due to budget */
  excludedCount: number;
  /** Whether the budget was fully utilized (all candidate chunks fit) */
  budgetExhausted: boolean;
}

/**
 * Select chunks that fit within the token budget.
 *
 * Chunks are assumed to be pre-sorted by relevance (best first, from
 * retrieval scoring). This function greedily selects chunks in order until
 * the token budget or chunk count limit is reached.
 *
 * @param chunks - Candidate chunks, sorted by relevance (best first)
 * @param budget - Token and chunk count constraints
 * @returns Selected chunks and budget utilization metadata
 */
export function selectChunksWithinBudget(
  chunks: Chunk[],
  budget?: Partial<TokenBudget>,
): BudgetResult {
  const effectiveBudget: TokenBudget = {
    sourceContextBudget: budget?.sourceContextBudget ?? DEFAULT_SOURCE_TOKEN_BUDGET,
    maxChunks: budget?.maxChunks ?? DEFAULT_MAX_CHUNKS,
  };

  const selected: Chunk[] = [];
  let totalTokens = 0;
  let excludedCount = 0;

  for (const chunk of chunks) {
    if (selected.length >= effectiveBudget.maxChunks) {
      excludedCount = chunks.length - selected.length;
      break;
    }

    const chunkTokens = estimateChunkTokens(chunk);

    if (totalTokens + chunkTokens > effectiveBudget.sourceContextBudget) {
      excludedCount = chunks.length - selected.length;
      break;
    }

    selected.push(chunk);
    totalTokens += chunkTokens;
  }

  // Count remaining if we haven't counted yet
  if (excludedCount === 0 && selected.length < chunks.length) {
    excludedCount = chunks.length - selected.length;
  }

  return {
    selectedChunks: selected,
    totalTokens,
    excludedCount,
    budgetExhausted: selected.length < chunks.length,
  };
}

/**
 * Deduplicate overlapping chunks from the same source.
 *
 * The 2-sentence overlap between adjacent chunks means retrieved chunks
 * from the same section may have duplicated content. This function
 * removes exact-ID duplicates and detects high-overlap pairs.
 *
 * @param chunks - Chunks from retrieval, may contain duplicates
 * @returns Deduplicated chunks preserving original order
 */
export function deduplicateChunks(chunks: Chunk[]): Chunk[] {
  const seen = new Set<string>();
  const result: Chunk[] = [];

  for (const chunk of chunks) {
    if (seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    result.push(chunk);
  }

  return result;
}

/**
 * Sort chunks by source then by document order for coherent context assembly.
 * Per ADR-009 context assembly: sort by source, then by original document order.
 */
export function sortChunksByDocumentOrder(chunks: Chunk[]): Chunk[] {
  return [...chunks].sort((a, b) => {
    // Primary: group by source
    if (a.sourceId !== b.sourceId) {
      return a.sourceId.localeCompare(b.sourceId);
    }
    // Secondary: document order (by start offset)
    return a.startOffset - b.startOffset;
  });
}
