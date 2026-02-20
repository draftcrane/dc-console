/**
 * ResearchQueryService — Handles natural language queries against project source materials.
 *
 * Flow:
 * 1. Collect source content from R2 (plain text cached versions)
 * 2. Chunk content for context window management
 * 3. Send chunks + query to LLM (OpenAI GPT-4o with json_object mode per ADR-010)
 * 4. Parse response into structured snippets
 * 5. Return results for SSE streaming or JSON response
 *
 * Per ADR-010: Uses non-streaming OpenAI call with response_format: { type: "json_object" }
 * then re-emits results as SSE events to the client.
 *
 * AI responses are ephemeral (not stored in D1). Only query metadata is stored
 * in the research_queries table.
 */

import { ulid } from "ulidx";

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
  content: string;
}

// ── Chunking types (inline, pending PR #204 merge) ──

interface SourceChunk {
  sourceId: string;
  sourceTitle: string;
  headingChain: string;
  text: string;
}

// ── Constants ──

const MAX_QUERY_LENGTH = 1000;
const MAX_SNIPPETS = 8;
const MAX_CHUNKS_PER_QUERY = 8;
const MAX_CHUNK_SIZE = 3000; // characters per chunk
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
export function buildResearchUserMessage(query: string, chunks: SourceChunk[]): string {
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

// ── Inline chunking (pending PR #204 merge) ──

/**
 * Split source content into chunks suitable for LLM context window.
 * Simple paragraph-based chunking: split on double newlines, merge small
 * paragraphs, split large ones. Each chunk carries source attribution.
 *
 * This is an inline implementation pending the chunking service from PR #204.
 */
function chunkSourceContent(source: SourceContent): SourceChunk[] {
  const { content, sourceId, sourceTitle } = source;

  // Split HTML into paragraphs first (by block-level tags), then strip tags
  // This preserves paragraph boundaries that HTML encodes
  const paragraphs = content
    // Replace block-level closing tags with double newlines
    .replace(/<\/(p|div|h[1-6]|li|blockquote|br\s*\/?)>/gi, "\n\n")
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Normalize runs of whitespace within lines (but preserve \n)
    .replace(/[^\S\n]+/g, " ")
    // Split on double newlines
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return [];

  const chunks: SourceChunk[] = [];
  let currentText = "";
  let sectionIndex = 1;

  const flushChunk = () => {
    if (currentText) {
      chunks.push({
        sourceId,
        sourceTitle,
        headingChain: `Section ${sectionIndex} of document`,
        text: currentText,
      });
      sectionIndex++;
      currentText = "";
    }
  };

  for (const paragraph of paragraphs) {
    // If a single paragraph exceeds max chunk size, split it at sentence boundaries
    if (paragraph.length > MAX_CHUNK_SIZE) {
      flushChunk();
      const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];
      for (const sentence of sentences) {
        if (currentText && currentText.length + sentence.length > MAX_CHUNK_SIZE) {
          flushChunk();
        }
        currentText = currentText ? currentText + sentence : sentence;
      }
      continue;
    }

    // If adding this paragraph would exceed max chunk size, flush current
    if (currentText && currentText.length + paragraph.length + 2 > MAX_CHUNK_SIZE) {
      flushChunk();
      currentText = paragraph;
    } else {
      currentText = currentText ? `${currentText}\n\n${paragraph}` : paragraph;
    }
  }

  // Flush remaining
  flushChunk();

  return chunks;
}

// ── Inline snippet parser (pending PR #203 merge) ──

/**
 * Parse LLM JSON response into structured snippets.
 * Handles valid JSON, markdown fences, missing optional fields.
 */
function parseSnippetResponse(raw: string): ResearchQueryResult {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  const noResults = parsed.noResults === true || parsed.no_results === true;
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";

  if (!Array.isArray(parsed.snippets)) {
    return { snippets: [], summary, noResults: true };
  }

  const snippets: ResearchSnippet[] = [];
  for (const item of parsed.snippets.slice(0, MAX_SNIPPETS)) {
    if (!item || typeof item !== "object") continue;

    const content = typeof item.content === "string" ? item.content : "";
    const sourceId =
      typeof (item.sourceId ?? item.source_id) === "string"
        ? (item.sourceId ?? item.source_id)
        : "";
    const sourceTitle =
      typeof (item.sourceTitle ?? item.source_title) === "string"
        ? (item.sourceTitle ?? item.source_title)
        : "";
    const sourceLocation =
      typeof (item.sourceLocation ?? item.source_location ?? item.location_in_source) === "string"
        ? (item.sourceLocation ?? item.source_location ?? item.location_in_source)
        : null;

    if (!content || !sourceId) continue;

    snippets.push({ content, sourceId, sourceTitle, sourceLocation });
  }

  return { snippets, summary, noResults: noResults && snippets.length === 0 };
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
    let sql = `SELECT sm.id, sm.title, sm.r2_key
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
      .all<{ id: string; title: string; r2_key: string | null }>();

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

      // 2. Chunk all source content
      const allChunks: SourceChunk[] = [];
      for (const source of sources) {
        const chunks = chunkSourceContent(source);
        allChunks.push(...chunks);
      }

      // Limit to top chunks to stay within context window
      const topChunks = allChunks.slice(0, MAX_CHUNKS_PER_QUERY);

      // 3. Build prompt and call LLM (non-streaming, per ADR-010)
      const userMessage = buildResearchUserMessage(input.query, topChunks);

      const llmResponse = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
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

      // 4. Parse response
      let result: ResearchQueryResult;
      try {
        result = parseSnippetResponse(rawContent);
      } catch {
        await this.updateQueryRecord(queryId, {
          status: "error",
          errorMessage: "Failed to parse AI response",
        });
        throw new QueryFailedError("Failed to parse AI response");
      }

      const latencyMs = Date.now() - startTime;

      // 5. Update query record with results
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

export {
  chunkSourceContent as _chunkSourceContent,
  parseSnippetResponse as _parseSnippetResponse,
  RESEARCH_SYSTEM_PROMPT as _RESEARCH_SYSTEM_PROMPT,
};
export type { SourceChunk as _SourceChunk, SourceContent as _SourceContent };
