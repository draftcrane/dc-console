/**
 * Snippet Prompt Spike (#134) — Prompt Templates + Multi-Model Evaluation Harness
 *
 * Core prompt templates for the Research Board "Ask" tab. Given pre-retrieved
 * source chunks (from ADR-009's hybrid retrieval), the LLM must:
 *   1. Extract verbatim snippets that answer the user's query
 *   2. Preserve source attribution (sourceId, sourceTitle, sourceLocation)
 *   3. Return valid, schema-compliant JSON every time
 *   4. Produce a brief synthesis/summary across all results
 *   5. Handle negative queries (no relevant sources) gracefully
 *
 * Three prompt strategies tested:
 *   A: Schema-in-system-prompt only (baseline)
 *   B: JSON mode + schema prompt (json_object)
 *   C: Strict JSON schema enforcement (json_schema)
 *
 * Usage:
 *   npx tsx scripts/snippet-prompt-spike.ts
 *
 * Or imported by snippet-eval.ts for programmatic use.
 */

import type { Chunk } from "./chunking-spike.js";

// ---------------------------------------------------------------------------
// Response Schema
// ---------------------------------------------------------------------------

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

export interface ResearchQueryResult {
  snippets: SnippetResult[];
  /** Brief synthesis across all snippets */
  summary: string;
  /** True if no relevant information found in sources */
  noResults: boolean;
}

// ---------------------------------------------------------------------------
// JSON Schema (for OpenAI/Workers AI response_format parameter)
// ---------------------------------------------------------------------------

export const RESPONSE_JSON_SCHEMA = {
  name: "research_query_result",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      snippets: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            content: {
              type: "string" as const,
              description:
                "Verbatim text extracted from the source chunk. Must appear exactly in the source material.",
            },
            sourceId: {
              type: "string" as const,
              description: "Source material ID from the chunk metadata.",
            },
            sourceTitle: {
              type: "string" as const,
              description: "Human-readable source name from the chunk metadata.",
            },
            sourceLocation: {
              type: "string" as const,
              description:
                "Section or heading location from the source (e.g., 'Chapter 3 > Methodology').",
            },
            relevance: {
              type: "string" as const,
              description: "One sentence explaining why this snippet answers the query.",
            },
          },
          required: ["content", "sourceId", "sourceTitle", "sourceLocation", "relevance"],
          additionalProperties: false,
        },
        description: "Array of verbatim snippets extracted from source chunks.",
      },
      summary: {
        type: "string" as const,
        description:
          "Brief synthesis (2-4 sentences) across all extracted snippets. Summarize the key findings.",
      },
      noResults: {
        type: "boolean" as const,
        description:
          "True if no source material is relevant to the query. When true, snippets array must be empty and summary should explain that no relevant information was found.",
      },
    },
    required: ["snippets", "summary", "noResults"],
    additionalProperties: false,
  },
} as const;

// ---------------------------------------------------------------------------
// System Prompt Template
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a research extraction assistant for a nonfiction book writing tool. Your job is to find and extract relevant passages from the author's source materials that answer their research query.

## Your Task

Given a user's research query and a set of source material chunks, you must:

1. **Identify** which chunks contain information relevant to the query
2. **Extract** verbatim passages from relevant chunks — NEVER paraphrase or reword
3. **Attribute** each extracted passage to its source with the exact sourceId and sourceTitle from the chunk metadata
4. **Synthesize** a brief summary across all extracted passages

## Extraction Rules

- **VERBATIM ONLY**: Every snippet's \`content\` field must contain text that appears EXACTLY in the source chunk. Do not rephrase, summarize, or combine text from different chunks into a single snippet.
- **One snippet per relevant passage**: If a chunk contains multiple relevant passages, extract each as a separate snippet.
- **Source attribution must match metadata**: The \`sourceId\` and \`sourceTitle\` in each snippet must exactly match the values from the source chunk header.
- **sourceLocation**: Use the heading/section information from the chunk header (e.g., "Chapter 3 > Methodology"). If the chunk header shows "Section N of M", use that.
- **relevance**: One sentence explaining why this specific passage answers the query.
- **summary**: 2-4 sentences synthesizing the key findings across all extracted snippets.
- **Maximum snippets**: Extract at most 8 snippets. Prioritize the most relevant and information-dense passages.

## No Results

If NONE of the provided source chunks contain information relevant to the query:
- Set \`noResults\` to \`true\`
- Return an empty \`snippets\` array
- Set \`summary\` to a brief explanation that the source materials do not contain relevant information

## Response Format

Respond with a JSON object matching this schema:

\`\`\`json
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
\`\`\`

Respond ONLY with valid JSON. No markdown fences, no explanation, no preamble.`;

// ---------------------------------------------------------------------------
// User Message Template
// ---------------------------------------------------------------------------

/**
 * Format source chunks into the ADR-009 context assembly format for the user message.
 *
 * Format:
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
 * Build the user message containing the query and source chunks.
 */
export function buildUserMessage(query: string, chunks: Chunk[]): string {
  const formattedChunks = formatChunksForPrompt(chunks);

  return `## Research Query

${query}

## Source Materials

The following are chunks from the author's source materials. Extract verbatim passages that answer the research query above.

${formattedChunks}`;
}

// ---------------------------------------------------------------------------
// Prompt Strategy Configurations
// ---------------------------------------------------------------------------

export type PromptStrategy = "A" | "B" | "C";

export interface PromptStrategyConfig {
  name: string;
  description: string;
  /** System prompt content */
  systemPrompt: string;
  /** OpenAI-format response_format parameter (null = no constraint) */
  responseFormat:
    | null
    | { type: "json_object" }
    | {
        type: "json_schema";
        json_schema: typeof RESPONSE_JSON_SCHEMA;
      };
}

export const PROMPT_STRATEGIES: Record<PromptStrategy, PromptStrategyConfig> = {
  A: {
    name: "Schema-in-prompt (baseline)",
    description:
      "System prompt defines role + JSON schema + extraction rules. No API-level JSON enforcement.",
    systemPrompt: SYSTEM_PROMPT,
    responseFormat: null,
  },
  B: {
    name: "JSON mode + schema prompt",
    description:
      "Same prompt as A, plus response_format: json_object. API guarantees valid JSON; prompt guides the schema.",
    systemPrompt: SYSTEM_PROMPT,
    responseFormat: { type: "json_object" },
  },
  C: {
    name: "Strict JSON schema",
    description:
      "Uses response_format: json_schema with full schema definition. API guarantees both valid JSON AND schema compliance.",
    systemPrompt: SYSTEM_PROMPT,
    responseFormat: {
      type: "json_schema",
      json_schema: RESPONSE_JSON_SCHEMA,
    },
  },
};

// ---------------------------------------------------------------------------
// Model Configurations
// ---------------------------------------------------------------------------

export interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "workers-ai" | "anthropic";
  model: string;
  /** Which prompt strategies this model supports */
  supportedStrategies: PromptStrategy[];
  /** Cost per 1M input tokens (USD) */
  costInputPerMillion: number;
  /** Cost per 1M output tokens (USD) */
  costOutputPerMillion: number;
  /** Context window size */
  contextWindow: number;
}

export const MODELS: ModelConfig[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    supportedStrategies: ["A", "B", "C"],
    costInputPerMillion: 2.5,
    costOutputPerMillion: 10.0,
    contextWindow: 128_000,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    model: "gpt-4o-mini",
    supportedStrategies: ["A", "B", "C"],
    costInputPerMillion: 0.15,
    costOutputPerMillion: 0.6,
    contextWindow: 128_000,
  },
  {
    id: "mistral-small-3.1",
    name: "Mistral Small 3.1 24B",
    provider: "workers-ai",
    model: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    supportedStrategies: ["A", "B"],
    costInputPerMillion: 0, // Included in Workers plan
    costOutputPerMillion: 0,
    contextWindow: 128_000,
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    supportedStrategies: ["A", "B", "C"],
    costInputPerMillion: 3.0,
    costOutputPerMillion: 15.0,
    contextWindow: 200_000,
  },
];

// ---------------------------------------------------------------------------
// API Callers
// ---------------------------------------------------------------------------

export interface ModelResponse {
  raw: string;
  parsed: ResearchQueryResult | null;
  parseError: string | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Call OpenAI Chat Completions API (non-streaming, with optional response_format).
 */
export async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  responseFormat: PromptStrategyConfig["responseFormat"],
): Promise<ModelResponse> {
  const start = Date.now();

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  const raw = data.choices[0]?.message?.content ?? "";
  const { parsed, parseError } = tryParseResult(raw);

  return {
    raw,
    parsed,
    parseError,
    latencyMs,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model: data.model,
  };
}

/**
 * Call Workers AI via Cloudflare REST API (non-streaming, with optional response_format).
 */
export async function callWorkersAI(
  accountId: string,
  apiToken: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  responseFormat: PromptStrategyConfig["responseFormat"],
): Promise<ModelResponse> {
  const start = Date.now();

  const body: Record<string, unknown> = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 4096,
  };

  // Workers AI uses OpenAI-compatible response_format for json_object
  if (responseFormat?.type === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
    },
  );

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`Workers AI API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as {
    result: { response: string };
    success: boolean;
  };

  const raw = data.result?.response ?? "";
  const { parsed, parseError } = tryParseResult(raw);

  return {
    raw,
    parsed,
    parseError,
    latencyMs,
    inputTokens: 0, // Workers AI REST doesn't return token counts
    outputTokens: 0,
    model,
  };
}

/**
 * Call Anthropic Messages API (non-streaming, with optional JSON schema via tool_use).
 *
 * Anthropic doesn't have a `response_format` param like OpenAI. For strategies B/C,
 * we use the tool_use pattern: define a single tool with the JSON schema, force the
 * model to call it, and extract the structured result from the tool call arguments.
 * For strategy A, we rely on the system prompt alone.
 */
export async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  strategy: PromptStrategy,
): Promise<ModelResponse> {
  const start = Date.now();

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };

  // For strategies B and C, use tool_use to enforce JSON schema
  if (strategy === "B" || strategy === "C") {
    body.tools = [
      {
        name: "research_result",
        description: "Return the structured research query result with verbatim snippets.",
        input_schema: RESPONSE_JSON_SCHEMA.schema,
      },
    ];
    body.tool_choice = { type: "tool", name: "research_result" };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as {
    content: Array<
      { type: "text"; text: string } | { type: "tool_use"; name: string; input: unknown }
    >;
    usage: { input_tokens: number; output_tokens: number };
    model: string;
  };

  let raw: string;
  let parsed: ResearchQueryResult | null = null;
  let parseError: string | null = null;

  if (strategy === "B" || strategy === "C") {
    // Extract from tool_use block
    const toolBlock = data.content.find((b) => b.type === "tool_use");
    if (toolBlock && toolBlock.type === "tool_use") {
      raw = JSON.stringify(toolBlock.input);
      const result = tryParseResult(raw);
      parsed = result.parsed;
      parseError = result.parseError;
    } else {
      // Fallback to text block
      const textBlock = data.content.find((b) => b.type === "text");
      raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
      const result = tryParseResult(raw);
      parsed = result.parsed;
      parseError = result.parseError;
    }
  } else {
    const textBlock = data.content.find((b) => b.type === "text");
    raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
    const result = tryParseResult(raw);
    parsed = result.parsed;
    parseError = result.parseError;
  }

  return {
    raw,
    parsed,
    parseError,
    latencyMs,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    model: data.model,
  };
}

// ---------------------------------------------------------------------------
// JSON Parsing Helpers
// ---------------------------------------------------------------------------

function tryParseResult(raw: string): {
  parsed: ResearchQueryResult | null;
  parseError: string | null;
} {
  try {
    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();

    const obj = JSON.parse(cleaned);
    const error = validateSchema(obj);
    if (error) {
      return { parsed: null, parseError: `Schema validation: ${error}` };
    }
    return { parsed: obj as ResearchQueryResult, parseError: null };
  } catch (e) {
    return {
      parsed: null,
      parseError: `JSON parse failed: ${(e as Error).message}`,
    };
  }
}

function validateSchema(obj: unknown): string | null {
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

// ---------------------------------------------------------------------------
// Evaluation Metrics
// ---------------------------------------------------------------------------

export interface EvalMetrics {
  jsonParseSuccess: boolean;
  schemaCompliant: boolean;
  schemaError: string | null;
  snippetCount: number;
  verbatimRate: number;
  attributionAccuracy: number;
  negativeQueryCorrect: boolean | null; // null if not a negative query
  summaryPresent: boolean;
  summaryWordCount: number;
}

/**
 * Evaluate a model response against the source chunks and query metadata.
 */
export function evaluateResponse(
  response: ModelResponse,
  chunks: Chunk[],
  queryType: string,
  expectedSourceIds: string[],
): EvalMetrics {
  const isNegative = queryType === "negative";

  if (!response.parsed) {
    return {
      jsonParseSuccess: false,
      schemaCompliant: false,
      schemaError: response.parseError,
      snippetCount: 0,
      verbatimRate: 0,
      attributionAccuracy: 0,
      negativeQueryCorrect: isNegative ? false : null,
      summaryPresent: false,
      summaryWordCount: 0,
    };
  }

  const result = response.parsed;

  // Negative query handling
  if (isNegative) {
    return {
      jsonParseSuccess: true,
      schemaCompliant: true,
      schemaError: null,
      snippetCount: result.snippets.length,
      verbatimRate: 0,
      attributionAccuracy: 0,
      negativeQueryCorrect: result.noResults === true && result.snippets.length === 0,
      summaryPresent: result.summary.trim().length > 0,
      summaryWordCount: result.summary.split(/\s+/).filter(Boolean).length,
    };
  }

  // Build a map of chunk texts by sourceId for verbatim checking
  const chunkTextBySource = new Map<string, string[]>();
  for (const chunk of chunks) {
    if (!chunkTextBySource.has(chunk.sourceId)) {
      chunkTextBySource.set(chunk.sourceId, []);
    }
    chunkTextBySource.get(chunk.sourceId)!.push(chunk.text);
  }

  // All chunk texts concatenated for broader verbatim search
  const allChunkTexts = chunks.map((c) => c.text);

  let verbatimCount = 0;
  let attributionCorrect = 0;

  for (const snippet of result.snippets) {
    // Verbatim check: does the snippet content appear in any chunk text?
    const isVerbatim = allChunkTexts.some((text) =>
      normalizeForComparison(text).includes(normalizeForComparison(snippet.content)),
    );
    if (isVerbatim) verbatimCount++;

    // Attribution check: does the sourceId match a chunk we provided?
    const sourceChunks = chunkTextBySource.get(snippet.sourceId);
    if (sourceChunks) {
      // Check that the content actually comes from this source
      const fromCorrectSource = sourceChunks.some((text) =>
        normalizeForComparison(text).includes(normalizeForComparison(snippet.content)),
      );
      if (fromCorrectSource) attributionCorrect++;
    }
  }

  const snippetCount = result.snippets.length;

  return {
    jsonParseSuccess: true,
    schemaCompliant: true,
    schemaError: null,
    snippetCount,
    verbatimRate: snippetCount > 0 ? verbatimCount / snippetCount : 0,
    attributionAccuracy: snippetCount > 0 ? attributionCorrect / snippetCount : 0,
    negativeQueryCorrect: null,
    summaryPresent: result.summary.trim().length > 0,
    summaryWordCount: result.summary.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Normalize text for verbatim comparison: collapse whitespace, lowercase.
 * We're generous here — minor whitespace differences shouldn't count as paraphrasing.
 */
function normalizeForComparison(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Self-test: Print prompt templates for visual review
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Snippet Prompt Spike (#134) — Prompt Templates ===\n");

  console.log("--- System Prompt ---");
  console.log(SYSTEM_PROMPT);
  console.log(`\n(${SYSTEM_PROMPT.split(/\s+/).length} words)\n`);

  // Demo: build a user message from a sample chunk
  const sampleChunks: Chunk[] = [
    {
      id: "small-leadership:0",
      sourceId: "small-leadership",
      sourceTitle: "Leadership Fundamentals for Practitioners",
      headingChain: ["Emotional Intelligence in Leadership"],
      text: "Emotional intelligence has emerged as a critical factor in leadership effectiveness. Research by Goleman (1998) identified that star performers in senior leadership positions demonstrated significantly higher emotional intelligence competencies than average performers. The five components — self-awareness, self-regulation, motivation, empathy, and social skill — together predicted 85% of the variance in leadership performance across studied organizations.",
      html: "<p>Emotional intelligence has emerged...</p>",
      wordCount: 55,
      startOffset: 0,
      endOffset: 350,
    },
    {
      id: "docx-teams:2",
      sourceId: "docx-teams",
      sourceTitle: "Team Effectiveness Research Summary",
      headingChain: ["Psychological Safety", "Key Findings"],
      text: "Edmondson's (1999) seminal study on psychological safety found that teams with higher psychological safety demonstrated significantly better learning behaviors and performance outcomes. Members of psychologically safe teams were more likely to admit errors, ask questions, and propose innovative solutions without fear of punishment or ridicule. Google's Project Aristotle later confirmed psychological safety as the strongest predictor of team effectiveness.",
      html: "<p>Edmondson's (1999) seminal study...</p>",
      wordCount: 57,
      startOffset: 0,
      endOffset: 380,
    },
  ];

  const sampleQuery = "how does emotional intelligence relate to team effectiveness";
  const userMessage = buildUserMessage(sampleQuery, sampleChunks);

  console.log("--- User Message (sample) ---");
  console.log(userMessage);
  console.log(`\n(${userMessage.split(/\s+/).length} words)\n`);

  console.log("--- JSON Schema (for response_format) ---");
  console.log(JSON.stringify(RESPONSE_JSON_SCHEMA, null, 2));

  console.log("\n--- Prompt Strategies ---");
  for (const [key, config] of Object.entries(PROMPT_STRATEGIES)) {
    console.log(`  Strategy ${key}: ${config.name}`);
    console.log(`    ${config.description}`);
    console.log(
      `    response_format: ${config.responseFormat ? JSON.stringify(config.responseFormat.type) : "none"}`,
    );
  }

  console.log("\n--- Models ---");
  for (const model of MODELS) {
    console.log(
      `  ${model.id}: ${model.name} (${model.provider}) — strategies: ${model.supportedStrategies.join(", ")}`,
    );
    console.log(
      `    Cost: $${model.costInputPerMillion}/M in, $${model.costOutputPerMillion}/M out`,
    );
  }

  console.log("\nPrompt templates ready. Run snippet-eval.ts to execute evaluations.");
}

// Only run when executed directly (not imported)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("snippet-prompt-spike.ts");

if (isMainModule) {
  main().catch((err) => {
    console.error("Prompt spike failed:", err);
    process.exit(1);
  });
}
