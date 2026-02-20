/**
 * ResearchQueryService — Handles natural language queries against project source materials.
 *
 * Flow:
 * 1. Collect source content from R2 (plain text cached versions)
 * 2. Chunk content using shared chunking service (sentence-boundary, overlap, heading-chain)
 * 3. Distribute chunks across sources with round-robin selection
 * 4. Send chunks + query to LLM (OpenAI GPT-4o with json_object mode per ADR-010)
 * 5. Parse response with shared snippet parser
 * 6. Return results for SSE streaming or JSON response
 *
 * Per ADR-010: Uses non-streaming OpenAI call with response_format: { type: "json_object" }
 * then re-emits results as SSE events to the client.
 *
 * AI responses are ephemeral (not stored in D1). Only query metadata is stored
 * in the research_queries table.
 */

import { ulid } from "ulidx";
import { chunkHtml, htmlTypeFromMime, type Chunk } from "./chunking.js";
import { parseSnippetResponse, type Snippet, type SnippetParseResult } from "./snippet-parser.js";

// ── Types ──

export interface ResearchQueryInput {
  query: string;
  sourceIds?: string[];
}

export interface ResearchSnippet {
  content: string;
  sourceId: string;
  sourceTitle: string;
  sourceLocation: string | null;
  relevance: string;
}

export interface ResearchQueryResult {
  snippets: ResearchSnippet[];
  summary: string;
  noResults: boolean;
}

export interface ResearchQueryStreamResult {
  stream: ReadableStream<Uint8Array>;
  queryId: string;
}

export interface ResearchQueryJsonResult {
  results: ResearchSnippet[];
  summary: string;
  processingTimeMs: number;
}

// ── Source content with metadata ──

interface SourceContent {
  sourceId: string;
  sourceTitle: string;
  mimeType: string;
  content: string;
}

// ── Chunk adapter: maps shared Chunk to the shape the prompt builder needs ──

interface PromptChunk {
  sourceId: string;
  sourceTitle: string;
  headingChain: string;
  text: string;
}

/** Convert a shared Chunk into the shape used by buildResearchUserMessage */
function toPromptChunk(chunk: Chunk): PromptChunk {
  return {
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    headingChain: chunk.headingChain.length > 0 ? chunk.headingChain.join(" > ") : "Full document",
    text: chunk.text,
  };
}

// ── Constants ──

const MAX_QUERY_LENGTH = 1000;
const MAX_SNIPPETS = 8;
const MAX_CHUNKS_PER_QUERY = 8;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// ── Prompt Templates (from ADR-010) ──

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
- Maximum snippets: Extract at most ${MAX_SNIPPETS} snippets. Prioritize the most relevant and information-dense passages.

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

/**
 * Build user message with source chunks following ADR-010 template.
 */
export function buildResearchUserMessage(query: string, chunks: PromptChunk[]): string {
  const parts: string[] = [];
  parts.push(`## Research Query\n\n${query}\n`);
  parts.push(
    `## Source Materials\n\nThe following are chunks from the author's source materials. Extract verbatim passages that answer the research query above.\n`,
  );

  for (const chunk of chunks) {
    parts.push(
      `[Source: "${chunk.sourceTitle}" (id: ${chunk.sourceId}), Section: "${chunk.headingChain}"]`,
    );
    parts.push(chunk.text);
    parts.push("\n---\n");
  }

  return parts.join("\n");
}

// ── Round-robin chunk distribution across sources ──

/**
 * Distribute a chunk budget across sources using round-robin selection,
 * so every source gets representation in multi-source projects.
 *
 * For example: 3 sources, budget of 8 -> approx 3, 3, 2 chunks.
 */
function distributeChunksAcrossSources(
  chunksBySource: Map<string, Chunk[]>,
  budget: number,
): Chunk[] {
  const sourceIds = [...chunksBySource.keys()];
  if (sourceIds.length === 0) return [];

  const selected: Chunk[] = [];
  const indices = new Map<string, number>();

  // Initialize position tracker for each source
  for (const id of sourceIds) {
    indices.set(id, 0);
  }

  let round = 0;
  while (selected.length < budget) {
    let addedInRound = false;
    for (const sourceId of sourceIds) {
      if (selected.length >= budget) break;
      const chunks = chunksBySource.get(sourceId)!;
      const idx = indices.get(sourceId)!;
      if (idx < chunks.length) {
        selected.push(chunks[idx]);
        indices.set(sourceId, idx + 1);
        addedInRound = true;
      }
    }
    if (!addedInRound) break; // All sources exhausted
    round++;
  }

  return selected;
}

// ── Snippet adapter: maps shared Snippet to ResearchSnippet ──

function toResearchSnippet(snippet: Snippet): ResearchSnippet {
  return {
    content: snippet.content,
    sourceId: snippet.sourceId,
    sourceTitle: snippet.sourceTitle,
    sourceLocation: snippet.sourceLocation || null,
    relevance: snippet.relevance,
  };
}

// ── Service ──

export class ResearchQueryService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o",
  ) {}

  /**
   * Validate query input. Returns error message or null.
   */
  validateInput(input: ResearchQueryInput): string | null {
    if (!input.query?.trim()) {
      return "Query is required";
    }
    if (input.query.length > MAX_QUERY_LENGTH) {
      return `Query must be at most ${MAX_QUERY_LENGTH} characters`;
    }
    if (input.sourceIds && !Array.isArray(input.sourceIds)) {
      return "sourceIds must be an array";
    }
    return null;
  }

  /**
   * Collect source content from R2 for the given project.
   * Returns sources with cached content. Optionally filtered by sourceIds.
   */
  async collectSourceContent(
    userId: string,
    projectId: string,
    sourceIds?: string[],
  ): Promise<SourceContent[]> {
    // Build query to get active sources with cached content
    let sql = `SELECT sm.id, sm.title, sm.mime_type, sm.r2_key
      FROM source_materials sm
      JOIN projects p ON p.id = sm.project_id
      WHERE sm.project_id = ? AND p.user_id = ? AND sm.status = 'active' AND sm.cached_at IS NOT NULL`;

    const params: (string | null)[] = [projectId, userId];

    if (sourceIds && sourceIds.length > 0) {
      const placeholders = sourceIds.map(() => "?").join(",");
      sql += ` AND sm.id IN (${placeholders})`;
      params.push(...sourceIds);
    }

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all<{ id: string; title: string; mime_type: string; r2_key: string | null }>();

    const rows = result.results ?? [];

    // Fetch content from R2 for each source
    const contents: SourceContent[] = [];
    for (const row of rows) {
      const r2Key = row.r2_key || `sources/${row.id}/content.html`;
      const object = await this.bucket.get(r2Key);
      if (object) {
        const text = await object.text();
        if (text.trim()) {
          contents.push({
            sourceId: row.id,
            sourceTitle: row.title,
            mimeType: row.mime_type || "text/plain",
            content: text,
          });
        }
      }
    }

    return contents;
  }

  /**
   * Execute the research query: chunk sources, call LLM, parse response.
   * Returns structured result for either SSE or JSON delivery.
   */
  async executeQuery(
    userId: string,
    projectId: string,
    input: ResearchQueryInput,
  ): Promise<{ result: ResearchQueryResult; queryId: string; latencyMs: number }> {
    const queryId = ulid();
    const startTime = Date.now();

    // Record query start
    await this.db
      .prepare(
        `INSERT INTO research_queries (id, user_id, project_id, query, model, tier, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'frontier', 'pending', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
      )
      .bind(queryId, userId, projectId, input.query.slice(0, MAX_QUERY_LENGTH), this.model)
      .run();

    try {
      // 1. Collect source content
      const sources = await this.collectSourceContent(userId, projectId, input.sourceIds);

      if (sources.length === 0) {
        await this.updateQueryRecord(queryId, {
          status: "error",
          errorMessage: "No sources with cached content",
        });
        throw new NoSourcesError();
      }

      // 2. Chunk all source content using shared chunking service
      const chunksBySource = new Map<string, Chunk[]>();
      for (const source of sources) {
        const htmlType = htmlTypeFromMime(source.mimeType);
        const chunks = chunkHtml(source.sourceId, source.sourceTitle, source.content, htmlType);
        if (chunks.length > 0) {
          chunksBySource.set(source.sourceId, chunks);
        }
      }

      // 3. Distribute chunks across sources with round-robin selection
      const topChunks = distributeChunksAcrossSources(chunksBySource, MAX_CHUNKS_PER_QUERY);

      // Convert to prompt format
      const promptChunks = topChunks.map(toPromptChunk);

      // 4. Build prompt and call LLM (non-streaming, per ADR-010)
      const userMessage = buildResearchUserMessage(input.query, promptChunks);

      const llmResponse = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: RESEARCH_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text().catch(() => "Unknown error");
        console.error("OpenAI API error:", llmResponse.status, errorBody);
        await this.updateQueryRecord(queryId, {
          status: "error",
          errorMessage: `AI provider error: ${llmResponse.status}`,
        });
        throw new AIUnavailableError();
      }

      const data = (await llmResponse.json()) as {
        choices: Array<{
          message: { content: string };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        await this.updateQueryRecord(queryId, {
          status: "error",
          errorMessage: "Empty response from AI provider",
        });
        throw new AIUnavailableError();
      }

      // 5. Parse response using shared snippet parser
      const parseResult: SnippetParseResult = parseSnippetResponse(rawContent);

      let result: ResearchQueryResult;
      if (parseResult.ok) {
        result = {
          snippets: parseResult.data.snippets.map(toResearchSnippet),
          summary: parseResult.data.summary,
          noResults: parseResult.data.noResults,
        };
      } else {
        // Shared parser returned an error — try to use partial data if available
        if (parseResult.partial) {
          result = {
            snippets: parseResult.partial.snippets.map(toResearchSnippet),
            summary: parseResult.partial.summary,
            noResults: parseResult.partial.noResults,
          };
        } else {
          await this.updateQueryRecord(queryId, {
            status: "error",
            errorMessage: `Failed to parse AI response: ${parseResult.error.message}`,
          });
          throw new QueryFailedError("Failed to parse AI response");
        }
      }

      const latencyMs = Date.now() - startTime;

      // 6. Update query record with results
      await this.updateQueryRecord(queryId, {
        status: "completed",
        sourceCount: sources.length,
        resultCount: result.snippets.length,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        latencyMs,
      });

      return { result, queryId, latencyMs };
    } catch (error) {
      if (
        error instanceof NoSourcesError ||
        error instanceof AIUnavailableError ||
        error instanceof QueryFailedError
      ) {
        throw error;
      }
      const latencyMs = Date.now() - startTime;
      await this.updateQueryRecord(queryId, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        latencyMs,
      });
      throw new QueryFailedError(
        error instanceof Error ? error.message : "Query processing failed",
      );
    }
  }

  /**
   * Build an SSE stream from query results.
   */
  buildSSEStream(
    result: ResearchQueryResult,
    queryId: string,
    latencyMs: number,
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      start(controller) {
        // Emit each snippet as an SSE "result" event
        for (const snippet of result.snippets) {
          const data = JSON.stringify({
            content: snippet.content,
            sourceId: snippet.sourceId,
            sourceTitle: snippet.sourceTitle,
            sourceLocation: snippet.sourceLocation,
            relevance: snippet.relevance,
          });
          controller.enqueue(encoder.encode(`event: result\ndata: ${data}\n\n`));
        }

        // Emit done event
        const doneData = JSON.stringify({
          resultCount: result.snippets.length,
          summary: result.summary,
          processingTimeMs: latencyMs,
          queryId,
        });
        controller.enqueue(encoder.encode(`event: done\ndata: ${doneData}\n\n`));

        controller.close();
      },
    });
  }

  /**
   * Build a JSON response from query results.
   */
  buildJsonResponse(result: ResearchQueryResult, latencyMs: number): ResearchQueryJsonResult {
    return {
      results: result.snippets,
      summary: result.summary,
      processingTimeMs: latencyMs,
    };
  }

  /**
   * Update the research query record with final stats.
   */
  private async updateQueryRecord(
    queryId: string,
    data: {
      status: string;
      sourceCount?: number;
      resultCount?: number;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      await this.db
        .prepare(
          `UPDATE research_queries
           SET status = ?,
               source_count = COALESCE(?, source_count),
               result_count = COALESCE(?, result_count),
               input_tokens = COALESCE(?, input_tokens),
               output_tokens = COALESCE(?, output_tokens),
               latency_ms = COALESCE(?, latency_ms),
               error_message = ?
           WHERE id = ?`,
        )
        .bind(
          data.status,
          data.sourceCount ?? null,
          data.resultCount ?? null,
          data.inputTokens ?? null,
          data.outputTokens ?? null,
          data.latencyMs ?? null,
          data.errorMessage ?? null,
          queryId,
        )
        .run();
    } catch (err) {
      console.error("Failed to update research_queries record:", err);
    }
  }
}

// ── Error classes ──

export class NoSourcesError extends Error {
  constructor() {
    super("Project has no sources with cached content");
    this.name = "NoSourcesError";
  }
}

export class AIUnavailableError extends Error {
  constructor() {
    super("AI service unavailable");
    this.name = "AIUnavailableError";
  }
}

export class QueryFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryFailedError";
  }
}

// ── Exports for testing ──

export { RESEARCH_SYSTEM_PROMPT as _RESEARCH_SYSTEM_PROMPT };
export { distributeChunksAcrossSources as _distributeChunksAcrossSources };
export type { SourceContent as _SourceContent, PromptChunk as _PromptChunk };
