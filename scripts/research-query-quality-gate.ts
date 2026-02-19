/**
 * Research Query Quality Gate — Prompt Engineering Experiment
 *
 * Tests 4 prompt strategies x 2 models x 12 test cases for structured
 * JSON snippet extraction from source documents. Evaluates schema
 * conformance, snippet accuracy (exact + fuzzy LCS), chunk reference
 * validity, and latency/cost.
 *
 * Usage:
 *   infisical run --path /dc -- npx tsx scripts/research-query-quality-gate.ts
 *
 * Required env vars:
 *   CF_WORKERS_AI_TOKEN — Shared Workers AI tooling token (stored at /vc in Infisical)
 *   CF_ACCOUNT_ID      — Cloudflare account ID
 *   OPENAI_API_KEY     — OpenAI API key
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EDGE_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const FRONTIER_MODEL = "gpt-4o";
const INTER_CALL_DELAY_MS = 1_500;
const REQUEST_TIMEOUT_MS = 90_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = resolve(__dirname, "fixtures/research-query-cases.json");
const OUTPUT_PATH = resolve(__dirname, "../docs/adr/ADR-007-research-query-prompts.md");

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

let CF_WORKERS_AI_TOKEN: string | undefined;
let CF_ACCOUNT_ID: string;
let OPENAI_API_KEY: string | undefined;

function validateEnv(): void {
  CF_WORKERS_AI_TOKEN = process.env.CF_WORKERS_AI_TOKEN;
  CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "ab6cc9362f7e51ba9a610aec1fc3a833";
  OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!CF_WORKERS_AI_TOKEN) {
    console.error(
      "Missing CF_WORKERS_AI_TOKEN — shared tooling token stored at /vc in Infisical.\n" +
        "Ensure it's synced to /dc, then run:\n" +
        "  infisical run --path /dc -- npx tsx scripts/research-query-quality-gate.ts",
    );
    process.exit(1);
  }
  if (!OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY — set via Infisical or env");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceMaterial {
  id: string;
  title: string;
  htmlContent: string;
}

interface TestCase {
  id: string;
  queryType: string;
  genre: string;
  query: string;
  sources: SourceMaterial[];
  expectedBehavior: {
    snippetCount: string;
    shouldBeVerbatim: boolean;
    queryUnderstood: boolean;
    notes: string;
  };
}

interface Chunk {
  id: string;
  text: string;
}

interface ChunkedSource {
  sourceId: string;
  sourceTitle: string;
  chunks: Chunk[];
}

/** The canonical response schema the LLM must produce */
interface ResearchQueryResponse {
  snippets: Array<{
    text: string;
    verbatim: boolean;
    sourceId: string;
    sourceTitle: string;
    chunkRef: string;
    relevance: string;
    confidence: "high" | "medium" | "low";
  }>;
  summary: string | null;
  queryUnderstood: boolean;
  noResultsReason: string | null;
}

interface SnippetValidation {
  index: number;
  text: string;
  verbatimClaimed: boolean;
  actualExactMatch: boolean;
  lcsRatio: number;
  chunkRefValid: boolean;
  sourceIdValid: boolean;
}

interface ValidationResult {
  rawJsonValid: boolean;
  cleanedJsonValid: boolean;
  notRecoverable: boolean;
  schemaConformant: boolean;
  schemaErrors: string[];
  queryUnderstoodCorrect: boolean;
  snippetValidations: SnippetValidation[];
  exactMatchCount: number;
  fuzzyMatchCount: number;
  belowThresholdCount: number;
  chunkRefValidCount: number;
  sourceIdValidCount: number;
  totalSnippets: number;
}

interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface APICallResult {
  raw: string;
  latencyMs: number;
  tokens: TokenUsage;
}

type Strategy = "A" | "B" | "C" | "D";
type ModelTier = "edge" | "frontier";

interface ExperimentResult {
  caseId: string;
  queryType: string;
  genre: string;
  strategy: Strategy;
  model: ModelTier;
  modelName: string;
  latencyMs: number;
  tokens: TokenUsage;
  validation: ValidationResult;
  rawOutput: string;
}

// ---------------------------------------------------------------------------
// chunkifyHTML — Reusable for production (#126)
// ---------------------------------------------------------------------------

/**
 * Split HTML content at block-level elements into numbered chunks.
 * Each chunk gets a deterministic ID: `{sourceId}-chunk-{n}`.
 *
 * Block elements: p, h1-h6, li, blockquote, div, tr, pre, figcaption.
 * Inline-only text between blocks becomes its own chunk.
 */
export function chunkifyHTML(sourceId: string, html: string): Chunk[] {
  // Strip full HTML wrapper if present
  const body = html
    .replace(/<html[^>]*>|<\/html>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<body[^>]*>|<\/body>/gi, "");

  const chunks: Chunk[] = [];
  let chunkIndex = 1;

  // Split on block-level element boundaries
  const blockPattern = /<(p|h[1-6]|li|blockquote|div|tr|pre|figcaption)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(body)) !== null) {
    // Capture any text between the previous block and this one
    const gap = body.slice(lastIndex, match.index).trim();
    if (gap && stripHTML(gap).trim().length > 0) {
      chunks.push({
        id: `${sourceId}-chunk-${chunkIndex}`,
        text: stripHTML(gap).trim(),
      });
      chunkIndex++;
    }

    const text = stripHTML(match[0]).trim();
    if (text.length > 0) {
      chunks.push({
        id: `${sourceId}-chunk-${chunkIndex}`,
        text,
      });
      chunkIndex++;
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing content after last block
  const trailing = body.slice(lastIndex).trim();
  if (trailing && stripHTML(trailing).trim().length > 0) {
    chunks.push({
      id: `${sourceId}-chunk-${chunkIndex}`,
      text: stripHTML(trailing).trim(),
    });
  }

  // Fallback: if no blocks found, treat entire content as one chunk
  if (chunks.length === 0) {
    const text = stripHTML(body).trim();
    if (text.length > 0) {
      chunks.push({ id: `${sourceId}-chunk-1`, text });
    }
  }

  return chunks;
}

function stripHTML(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// cleanJSON — Strip markdown fences and trailing text
// ---------------------------------------------------------------------------

/**
 * Attempt to extract valid JSON from an LLM response that may include
 * markdown code fences, trailing explanation text, or leading prose.
 */
export function cleanJSON(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // If it doesn't start with { or [, try to find the first JSON object
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const jsonStart = cleaned.indexOf("{");
    if (jsonStart !== -1) {
      cleaned = cleaned.slice(jsonStart);
    }
  }

  // If it has trailing text after the closing brace, trim it
  if (cleaned.startsWith("{")) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          cleaned = cleaned.slice(0, i + 1);
          break;
        }
      }
    }
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// computeLCS — Longest Common Subsequence ratio
// ---------------------------------------------------------------------------

/**
 * Compute the LCS ratio between two strings.
 * Returns a value between 0 and 1, where 1 means identical.
 * Uses character-level LCS for accuracy.
 *
 * For very long strings (>2000 chars), falls back to word-level LCS
 * to avoid O(n*m) memory issues.
 */
export function computeLCS(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a === b) return 1;

  // Normalize whitespace for comparison
  const normA = a.replace(/\s+/g, " ").trim();
  const normB = b.replace(/\s+/g, " ").trim();

  if (normA.length > 2000 || normB.length > 2000) {
    return wordLevelLCS(normA, normB);
  }

  return charLevelLCS(normA, normB);
}

function charLevelLCS(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Space-optimized: only keep two rows
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  const lcsLength = prev[n];
  return (2 * lcsLength) / (m + n);
}

function wordLevelLCS(a: string, b: string): number {
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const m = wordsA.length;
  const n = wordsB.length;

  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  const lcsLength = prev[n];
  return (2 * lcsLength) / (m + n);
}

// ---------------------------------------------------------------------------
// Schema validation (manual — avoids adding Zod dependency)
// ---------------------------------------------------------------------------

function validateSchema(obj: unknown): {
  valid: boolean;
  errors: string[];
  parsed: ResearchQueryResponse | null;
} {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["Root is not an object"], parsed: null };
  }

  const root = obj as Record<string, unknown>;

  // snippets: required array
  if (!Array.isArray(root.snippets)) {
    errors.push("snippets is not an array");
  } else {
    for (let i = 0; i < root.snippets.length; i++) {
      const s = root.snippets[i] as Record<string, unknown>;
      if (typeof s !== "object" || s === null) {
        errors.push(`snippets[${i}] is not an object`);
        continue;
      }
      if (typeof s.text !== "string") errors.push(`snippets[${i}].text missing or not string`);
      if (typeof s.verbatim !== "boolean")
        errors.push(`snippets[${i}].verbatim missing or not boolean`);
      if (typeof s.sourceId !== "string")
        errors.push(`snippets[${i}].sourceId missing or not string`);
      if (typeof s.sourceTitle !== "string")
        errors.push(`snippets[${i}].sourceTitle missing or not string`);
      if (typeof s.chunkRef !== "string")
        errors.push(`snippets[${i}].chunkRef missing or not string`);
      if (typeof s.relevance !== "string")
        errors.push(`snippets[${i}].relevance missing or not string`);
      if (!["high", "medium", "low"].includes(s.confidence as string))
        errors.push(`snippets[${i}].confidence must be "high"|"medium"|"low"`);
    }
  }

  // summary: string | null
  if (root.summary !== null && typeof root.summary !== "string") {
    errors.push("summary must be string or null");
  }

  // queryUnderstood: boolean
  if (typeof root.queryUnderstood !== "boolean") {
    errors.push("queryUnderstood must be boolean");
  }

  // noResultsReason: string | null
  if (root.noResultsReason !== null && typeof root.noResultsReason !== "string") {
    errors.push("noResultsReason must be string or null");
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? (root as unknown as ResearchQueryResponse) : null,
  };
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA_TEXT = `{
  "snippets": [
    {
      "text": "Quoted text from source (verbatim preferred)",
      "verbatim": true,
      "sourceId": "src-001",
      "sourceTitle": "Document Title",
      "chunkRef": "src-001-chunk-3",
      "relevance": "Why this answers the query",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "summary": "Synthesis across snippets (optional, null if not needed)",
  "queryUnderstood": true,
  "noResultsReason": null
}`;

function formatChunkedSources(chunkedSources: ChunkedSource[]): string {
  return chunkedSources
    .map((src) => {
      const chunksText = src.chunks.map((c) => `<chunk id="${c.id}">${c.text}</chunk>`).join("\n");
      return `<source id="${src.sourceId}" title="${src.sourceTitle}">\n${chunksText}\n</source>`;
    })
    .join("\n\n");
}

/**
 * Strategy A: Schema-in-System-Prompt
 * System prompt includes JSON schema + rules. User message has sources + question.
 */
function buildPromptA(
  query: string,
  chunkedSources: ChunkedSource[],
): { system: string; user: string } {
  const system = `You are a research assistant that extracts relevant snippets from source documents to answer user queries.

You MUST respond with valid JSON matching this exact schema:
${RESPONSE_SCHEMA_TEXT}

RULES:
1. Extract snippets that directly answer or are relevant to the query.
2. Prefer verbatim quotes from the source text. Set "verbatim" to true only if the text is an exact substring of a source chunk.
3. The "chunkRef" must be the exact chunk ID from the input (e.g. "src-001-chunk-3").
4. The "sourceId" must match the source's id attribute.
5. If the query is ambiguous, set "queryUnderstood" to false and explain in "noResultsReason".
6. If no relevant snippets exist, return an empty snippets array with "noResultsReason" explaining why.
7. Return ONLY the JSON object. No markdown fences, no explanation, no trailing text.
8. The "confidence" field reflects how directly the snippet answers the query: "high" for direct answers, "medium" for partially relevant, "low" for tangentially related.`;

  const user = `${formatChunkedSources(chunkedSources)}

<question>${query}</question>`;

  return { system, user };
}

/**
 * Strategy B: Few-Shot (2 examples)
 * Two complete input/output examples before the real query.
 */
function buildPromptB(
  query: string,
  chunkedSources: ChunkedSource[],
): { system: string; user: string } {
  const system = `You are a research assistant that extracts relevant snippets from source documents. You respond with valid JSON only.`;

  const example1Input = `<source id="ex-001" title="Example Report">
<chunk id="ex-001-chunk-1">The global market for renewable energy reached $300 billion in 2023, driven primarily by solar and wind installations.</chunk>
<chunk id="ex-001-chunk-2">Solar panel costs have decreased by 89% since 2010, making residential installation economically viable for most homeowners.</chunk>
</source>

<question>How much has solar panel cost changed?</question>`;

  const example1Output = `{
  "snippets": [
    {
      "text": "Solar panel costs have decreased by 89% since 2010, making residential installation economically viable for most homeowners.",
      "verbatim": true,
      "sourceId": "ex-001",
      "sourceTitle": "Example Report",
      "chunkRef": "ex-001-chunk-2",
      "relevance": "Directly states the cost decrease percentage and timeframe",
      "confidence": "high"
    }
  ],
  "summary": null,
  "queryUnderstood": true,
  "noResultsReason": null
}`;

  const example2Input = `<source id="ex-002" title="Study A">
<chunk id="ex-002-chunk-1">Participants who exercised 30 minutes daily showed a 25% improvement in cognitive test scores.</chunk>
</source>

<source id="ex-003" title="Study B">
<chunk id="ex-003-chunk-1">Regular physical activity correlates with reduced risk of dementia in adults over 65.</chunk>
</source>

<question>What foods improve brain health?</question>`;

  const example2Output = `{
  "snippets": [],
  "summary": null,
  "queryUnderstood": true,
  "noResultsReason": "The provided sources discuss exercise and physical activity in relation to cognitive health, but do not contain information about foods that improve brain health."
}`;

  const user = `Example 1:

Input:
${example1Input}

Output:
${example1Output}

Example 2:

Input:
${example2Input}

Output:
${example2Output}

Now answer this query. Return ONLY valid JSON matching the same schema.

Input:
${formatChunkedSources(chunkedSources)}

<question>${query}</question>

Output:`;

  return { system, user };
}

/**
 * Strategy C: XML-Tagged Instructions
 * Sources in XML tags with explicit numbered instructions.
 * Matches existing pattern in ai-rewrite.ts.
 */
function buildPromptC(
  query: string,
  chunkedSources: ChunkedSource[],
): { system: string; user: string } {
  const system = `You are a research assistant. Follow the numbered instructions exactly.`;

  const user = `<instructions>
1. Read all source documents below carefully.
2. Find snippets that answer or are relevant to the question.
3. For each snippet, extract the text as close to verbatim as possible from the source chunks.
4. Set "verbatim" to true ONLY if your extracted text is an exact substring of the source chunk text.
5. Use the exact chunk ID from the input as "chunkRef" (e.g. "src-001-chunk-3").
6. Use the source's id attribute as "sourceId".
7. If the question is unclear or ambiguous, set "queryUnderstood" to false.
8. If no snippets are relevant, return an empty snippets array with a "noResultsReason".
9. Respond with ONLY a JSON object. No markdown, no explanation, no code fences.
</instructions>

<response-schema>
${RESPONSE_SCHEMA_TEXT}
</response-schema>

${formatChunkedSources(chunkedSources)}

<question>${query}</question>`;

  return { system, user };
}

/**
 * Strategy D: JSON Mode + Schema (GPT-4o only)
 * Uses response_format: { type: "json_object" } for API-level enforcement.
 * The prompt is otherwise similar to Strategy A.
 */
function buildPromptD(
  query: string,
  chunkedSources: ChunkedSource[],
): { system: string; user: string } {
  // Same as Strategy A but relies on API-level JSON enforcement
  const system = `You are a research assistant that extracts relevant snippets from source documents to answer user queries.

Respond with a JSON object matching this schema:
${RESPONSE_SCHEMA_TEXT}

RULES:
1. Extract snippets that directly answer or are relevant to the query.
2. Prefer verbatim quotes. Set "verbatim" to true only if text is an exact substring of a source chunk.
3. "chunkRef" must be the exact chunk ID from the input.
4. "sourceId" must match the source's id attribute.
5. If the query is ambiguous, set "queryUnderstood" to false.
6. If no relevant snippets exist, return empty snippets array with "noResultsReason".
7. "confidence": "high" for direct answers, "medium" for partial, "low" for tangential.`;

  const user = `${formatChunkedSources(chunkedSources)}

<question>${query}</question>`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// API callers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function callOpenAI(system: string, user: string, jsonMode = false): Promise<APICallResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      model: FRONTIER_MODEL,
      max_tokens: 4096,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "", 10) || 30;
      console.log(`    429 — retrying in ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return callOpenAI(system, user, jsonMode);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        raw: `[ERROR: OpenAI ${response.status} — ${errorBody.slice(0, 200)}]`,
        latencyMs: Date.now() - start,
        tokens: { prompt: 0, completion: 0, total: 0 },
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const raw = json.choices?.[0]?.message?.content?.trim() || "[EMPTY RESPONSE]";
    const tokens: TokenUsage = {
      prompt: json.usage?.prompt_tokens ?? 0,
      completion: json.usage?.completion_tokens ?? 0,
      total: json.usage?.total_tokens ?? 0,
    };

    return { raw, latencyMs: Date.now() - start, tokens };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      raw: `[ERROR: ${msg}]`,
      latencyMs: Date.now() - start,
      tokens: { prompt: 0, completion: 0, total: 0 },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callWorkersAI(system: string, user: string): Promise<APICallResult> {
  const start = Date.now();
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${EDGE_MODEL}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_WORKERS_AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 4096,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "", 10) || 30;
      console.log(`    429 — retrying in ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return callWorkersAI(system, user);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        raw: `[ERROR: Workers AI ${response.status} — ${errorBody.slice(0, 200)}]`,
        latencyMs: Date.now() - start,
        tokens: { prompt: 0, completion: 0, total: 0 },
      };
    }

    const json = (await response.json()) as {
      result?: { response?: string };
      errors?: Array<{ message: string }>;
    };

    const raw =
      json.result?.response?.trim() ||
      (json.errors?.length ? `[ERROR: ${json.errors[0].message}]` : "[EMPTY RESPONSE]");

    // Workers AI doesn't report token usage in the REST API response
    return {
      raw,
      latencyMs: Date.now() - start,
      tokens: { prompt: 0, completion: 0, total: 0 },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      raw: `[ERROR: ${msg}]`,
      latencyMs: Date.now() - start,
      tokens: { prompt: 0, completion: 0, total: 0 },
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateResponse(
  raw: string,
  testCase: TestCase,
  allChunks: Map<string, ChunkedSource>,
): ValidationResult {
  const result: ValidationResult = {
    rawJsonValid: false,
    cleanedJsonValid: false,
    notRecoverable: false,
    schemaConformant: false,
    schemaErrors: [],
    queryUnderstoodCorrect: false,
    snippetValidations: [],
    exactMatchCount: 0,
    fuzzyMatchCount: 0,
    belowThresholdCount: 0,
    chunkRefValidCount: 0,
    sourceIdValidCount: 0,
    totalSnippets: 0,
  };

  // Step 1: Try raw JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    result.rawJsonValid = true;
    result.cleanedJsonValid = true;
  } catch {
    // Step 2: Try cleaned JSON
    const cleaned = cleanJSON(raw);
    try {
      parsed = JSON.parse(cleaned);
      result.cleanedJsonValid = true;
    } catch {
      result.notRecoverable = true;
      return result;
    }
  }

  // Step 3: Schema validation
  const schemaResult = validateSchema(parsed);
  result.schemaConformant = schemaResult.valid;
  result.schemaErrors = schemaResult.errors;

  if (!schemaResult.parsed) return result;

  const response = schemaResult.parsed;

  // Step 4: queryUnderstood check
  result.queryUnderstoodCorrect =
    response.queryUnderstood === testCase.expectedBehavior.queryUnderstood;

  // Step 5: Validate each snippet
  const validSourceIds = new Set(testCase.sources.map((s) => s.id));
  const validChunkIds = new Set<string>();
  const chunkTextMap = new Map<string, string>();

  for (const [, src] of allChunks) {
    for (const chunk of src.chunks) {
      validChunkIds.add(chunk.id);
      chunkTextMap.set(chunk.id, chunk.text);
    }
  }

  // Build full source text for substring matching
  const fullSourceTexts = new Map<string, string>();
  for (const [sourceId, src] of allChunks) {
    fullSourceTexts.set(sourceId, src.chunks.map((c) => c.text).join(" "));
  }

  result.totalSnippets = response.snippets.length;

  for (let i = 0; i < response.snippets.length; i++) {
    const snippet = response.snippets[i];
    const sv: SnippetValidation = {
      index: i,
      text: snippet.text,
      verbatimClaimed: snippet.verbatim,
      actualExactMatch: false,
      lcsRatio: 0,
      chunkRefValid: validChunkIds.has(snippet.chunkRef),
      sourceIdValid: validSourceIds.has(snippet.sourceId),
    };

    // Check exact match: is snippet.text a substring of the referenced chunk or full source?
    const chunkText = chunkTextMap.get(snippet.chunkRef);
    const sourceText = fullSourceTexts.get(snippet.sourceId);

    const normalizedSnippet = snippet.text.replace(/\s+/g, " ").trim();

    if (chunkText) {
      const normalizedChunk = chunkText.replace(/\s+/g, " ").trim();
      if (normalizedChunk.includes(normalizedSnippet)) {
        sv.actualExactMatch = true;
      }
    }

    // Also check against full source text
    if (!sv.actualExactMatch && sourceText) {
      const normalizedSource = sourceText.replace(/\s+/g, " ").trim();
      if (normalizedSource.includes(normalizedSnippet)) {
        sv.actualExactMatch = true;
      }
    }

    // Compute LCS ratio against referenced chunk (or full source as fallback)
    const referenceText = chunkText || sourceText || "";
    if (referenceText) {
      sv.lcsRatio = computeLCS(normalizedSnippet, referenceText.replace(/\s+/g, " ").trim());
    }

    if (sv.actualExactMatch) {
      result.exactMatchCount++;
    } else if (sv.lcsRatio >= 0.9) {
      result.fuzzyMatchCount++;
    } else {
      result.belowThresholdCount++;
    }

    if (sv.chunkRefValid) result.chunkRefValidCount++;
    if (sv.sourceIdValid) result.sourceIdValidCount++;

    result.snippetValidations.push(sv);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateReport(results: ExperimentResult[], dateStr: string): string {
  const lines: string[] = [];

  lines.push("# ADR-007: Research Query Prompt Engineering");
  lines.push("");
  lines.push("## Status");
  lines.push("");
  lines.push("**Proposed** — Pending review");
  lines.push("");
  lines.push("## Context");
  lines.push("");
  lines.push(
    "The Research Assistant feature (#125-#127) requires the LLM to return structured JSON " +
      "with source-attributed snippets instead of prose. This ADR documents the prompt engineering " +
      "experiment results and recommends a strategy.",
  );
  lines.push("");

  lines.push("## Experiment Details");
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| **Date** | ${dateStr} |`);
  lines.push(`| **Edge model** | \`${EDGE_MODEL}\` |`);
  lines.push(`| **Frontier model** | \`${FRONTIER_MODEL}\` |`);
  lines.push(`| **Test cases** | 12 |`);
  lines.push(
    `| **Strategies** | A (Schema-in-System), B (Few-Shot), C (XML-Tagged), D (JSON Mode, GPT-4o only) |`,
  );
  lines.push(`| **Total API calls** | ${results.length} |`);
  lines.push("");

  // --- Aggregate results by strategy x model ---
  const strategies: Strategy[] = ["A", "B", "C", "D"];
  const models: ModelTier[] = ["edge", "frontier"];

  lines.push("## Results Summary");
  lines.push("");
  lines.push(
    "| Strategy | Model | Raw JSON % | Cleaned JSON % | Schema % | Exact Match % | Fuzzy (>90%) % | Chunk Ref % | Source ID % | Mean Latency (ms) |",
  );
  lines.push(
    "|----------|-------|-----------|----------------|----------|--------------|---------------|------------|------------|-------------------|",
  );

  for (const strategy of strategies) {
    for (const model of models) {
      if (strategy === "D" && model === "edge") continue; // D is GPT-4o only

      const subset = results.filter((r) => r.strategy === strategy && r.model === model);
      if (subset.length === 0) continue;

      const rawValid = subset.filter((r) => r.validation.rawJsonValid).length;
      const cleanedValid = subset.filter((r) => r.validation.cleanedJsonValid).length;
      const schemaValid = subset.filter((r) => r.validation.schemaConformant).length;

      const totalSnippets = subset.reduce((s, r) => s + r.validation.totalSnippets, 0);
      const exactMatches = subset.reduce((s, r) => s + r.validation.exactMatchCount, 0);
      const fuzzyMatches = subset.reduce((s, r) => s + r.validation.fuzzyMatchCount, 0);
      const chunkRefValid = subset.reduce((s, r) => s + r.validation.chunkRefValidCount, 0);
      const sourceIdValid = subset.reduce((s, r) => s + r.validation.sourceIdValidCount, 0);

      const meanLatency = Math.round(subset.reduce((s, r) => s + r.latencyMs, 0) / subset.length);

      const pct = (n: number, d: number) => (d === 0 ? "N/A" : `${Math.round((100 * n) / d)}%`);

      lines.push(
        `| ${strategy} | ${model} | ${pct(rawValid, subset.length)} | ${pct(cleanedValid, subset.length)} | ${pct(schemaValid, subset.length)} | ${pct(exactMatches, totalSnippets)} | ${pct(fuzzyMatches, totalSnippets)} | ${pct(chunkRefValid, totalSnippets)} | ${pct(sourceIdValid, totalSnippets)} | ${meanLatency} |`,
      );
    }
  }

  lines.push("");

  // --- Quality bar assessment ---
  lines.push("## Quality Bar Assessment");
  lines.push("");
  lines.push("**Required**: >90% schema conformance AND >80% exact snippet match on BOTH models.");
  lines.push("");

  for (const strategy of strategies) {
    if (strategy === "D") {
      lines.push(`### Strategy ${strategy} (GPT-4o only)`);
    } else {
      lines.push(`### Strategy ${strategy}`);
    }
    lines.push("");

    for (const model of models) {
      if (strategy === "D" && model === "edge") continue;

      const subset = results.filter((r) => r.strategy === strategy && r.model === model);
      if (subset.length === 0) continue;

      const schemaValid = subset.filter((r) => r.validation.schemaConformant).length;
      const schemaPct = Math.round((100 * schemaValid) / subset.length);

      const totalSnippets = subset.reduce((s, r) => s + r.validation.totalSnippets, 0);
      const exactMatches = subset.reduce((s, r) => s + r.validation.exactMatchCount, 0);
      const exactPct = totalSnippets === 0 ? 0 : Math.round((100 * exactMatches) / totalSnippets);

      const schemaPass = schemaPct >= 90 ? "PASS" : "FAIL";
      const exactPass = exactPct >= 80 ? "PASS" : "FAIL";
      const overall = schemaPass === "PASS" && exactPass === "PASS" ? "PASS" : "FAIL";

      lines.push(
        `- **${model}**: Schema ${schemaPct}% (${schemaPass}) | Exact match ${exactPct}% (${exactPass}) | **${overall}**`,
      );
    }
    lines.push("");
  }

  // --- Cost analysis ---
  lines.push("## Cost Analysis");
  lines.push("");
  lines.push("| Strategy | Model | Total Prompt Tokens | Total Completion Tokens | Est. Cost |");
  lines.push("|----------|-------|--------------------|-----------------------|-----------|");

  for (const strategy of strategies) {
    for (const model of models) {
      if (strategy === "D" && model === "edge") continue;

      const subset = results.filter((r) => r.strategy === strategy && r.model === model);
      if (subset.length === 0) continue;

      const promptTokens = subset.reduce((s, r) => s + r.tokens.prompt, 0);
      const completionTokens = subset.reduce((s, r) => s + r.tokens.completion, 0);

      let cost: string;
      if (model === "frontier") {
        // GPT-4o: $2.50/1M input, $10/1M output
        const inputCost = (promptTokens / 1_000_000) * 2.5;
        const outputCost = (completionTokens / 1_000_000) * 10;
        cost = `$${(inputCost + outputCost).toFixed(4)}`;
      } else {
        cost = "Free (Workers AI)";
      }

      lines.push(
        `| ${strategy} | ${model} | ${promptTokens.toLocaleString()} | ${completionTokens.toLocaleString()} | ${cost} |`,
      );
    }
  }
  lines.push("");

  // --- Latency comparison ---
  lines.push("## Latency by Strategy");
  lines.push("");
  lines.push("| Strategy | Model | Min (ms) | Mean (ms) | Max (ms) | P95 (ms) |");
  lines.push("|----------|-------|----------|-----------|----------|----------|");

  for (const strategy of strategies) {
    for (const model of models) {
      if (strategy === "D" && model === "edge") continue;

      const subset = results.filter((r) => r.strategy === strategy && r.model === model);
      if (subset.length === 0) continue;

      const latencies = subset.map((r) => r.latencyMs).sort((a, b) => a - b);
      const min = latencies[0];
      const max = latencies[latencies.length - 1];
      const mean = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? max;

      lines.push(`| ${strategy} | ${model} | ${min} | ${mean} | ${max} | ${p95} |`);
    }
  }
  lines.push("");

  // --- Per-case detail ---
  lines.push("## Per-Case Results");
  lines.push("");
  lines.push("<details>");
  lines.push("<summary>Click to expand detailed per-case results</summary>");
  lines.push("");

  const caseIds = [...new Set(results.map((r) => r.caseId))];

  for (const caseId of caseIds) {
    const caseResults = results.filter((r) => r.caseId === caseId);
    if (caseResults.length === 0) continue;

    const first = caseResults[0];
    lines.push(`### ${caseId}`);
    lines.push("");
    lines.push(`**Type:** ${first.queryType} | **Genre:** ${first.genre}`);
    lines.push("");
    lines.push("| Strategy | Model | JSON | Schema | Exact | Fuzzy | ChunkRef | Latency |");
    lines.push("|----------|-------|------|--------|-------|-------|----------|---------|");

    for (const r of caseResults) {
      const v = r.validation;
      const json = v.notRecoverable ? "FAIL" : v.rawJsonValid ? "Raw" : "Cleaned";
      const schema = v.schemaConformant ? "OK" : "FAIL";
      const exact = `${v.exactMatchCount}/${v.totalSnippets}`;
      const fuzzy = `${v.fuzzyMatchCount}/${v.totalSnippets}`;
      const chunk = `${v.chunkRefValidCount}/${v.totalSnippets}`;

      lines.push(
        `| ${r.strategy} | ${r.model} | ${json} | ${schema} | ${exact} | ${fuzzy} | ${chunk} | ${r.latencyMs}ms |`,
      );
    }
    lines.push("");

    // Show schema errors if any
    const errors = caseResults.filter((r) => r.validation.schemaErrors.length > 0);
    if (errors.length > 0) {
      lines.push("Schema errors:");
      for (const r of errors) {
        lines.push(`- ${r.strategy}/${r.model}: ${r.validation.schemaErrors.join("; ")}`);
      }
      lines.push("");
    }
  }

  lines.push("</details>");
  lines.push("");

  // --- Snippet accuracy distribution ---
  lines.push("## Snippet Accuracy Distribution");
  lines.push("");

  for (const strategy of strategies) {
    for (const model of models) {
      if (strategy === "D" && model === "edge") continue;

      const subset = results.filter((r) => r.strategy === strategy && r.model === model);
      if (subset.length === 0) continue;

      const totalSnippets = subset.reduce((s, r) => s + r.validation.totalSnippets, 0);
      const exact = subset.reduce((s, r) => s + r.validation.exactMatchCount, 0);
      const fuzzy = subset.reduce((s, r) => s + r.validation.fuzzyMatchCount, 0);
      const below = subset.reduce((s, r) => s + r.validation.belowThresholdCount, 0);

      const pct = (n: number) =>
        totalSnippets === 0 ? "0%" : `${Math.round((100 * n) / totalSnippets)}%`;

      lines.push(
        `- **${strategy}/${model}**: ${pct(exact)} exact, ${pct(fuzzy)} fuzzy (>90% LCS), ${pct(below)} below threshold (${totalSnippets} total snippets)`,
      );
    }
  }
  lines.push("");

  // --- JSON recovery rates ---
  lines.push("## JSON Recovery Rates");
  lines.push("");
  lines.push("| Strategy | Model | Raw Valid | Cleaned Valid | Not Recoverable |");
  lines.push("|----------|-------|-----------|--------------|-----------------|");

  for (const strategy of strategies) {
    for (const model of models) {
      if (strategy === "D" && model === "edge") continue;

      const subset = results.filter((r) => r.strategy === strategy && r.model === model);
      if (subset.length === 0) continue;

      const rawValid = subset.filter((r) => r.validation.rawJsonValid).length;
      const cleanedOnly = subset.filter(
        (r) => !r.validation.rawJsonValid && r.validation.cleanedJsonValid,
      ).length;
      const notRecoverable = subset.filter((r) => r.validation.notRecoverable).length;

      lines.push(
        `| ${strategy} | ${model} | ${rawValid}/${subset.length} | ${cleanedOnly}/${subset.length} (cleaned only) | ${notRecoverable}/${subset.length} |`,
      );
    }
  }
  lines.push("");

  // --- Recommendation placeholder ---
  lines.push("## Recommendation");
  lines.push("");
  lines.push("**Recommended strategy:** _______________ (fill after manual review)");
  lines.push("");
  lines.push("**Rationale:**");
  lines.push("");
  lines.push("_To be completed after reviewing the results above._");
  lines.push("");

  // --- Canonical prompt template placeholder ---
  lines.push("## Canonical Prompt Template");
  lines.push("");
  lines.push("_To be filled in with the winning strategy's prompt template after review._");
  lines.push("");

  // --- Response schema ---
  lines.push("## Response Schema");
  lines.push("");
  lines.push("```typescript");
  lines.push("interface ResearchQueryResponse {");
  lines.push("  snippets: Array<{");
  lines.push("    text: string;           // Quoted text from source (verbatim preferred)");
  lines.push("    verbatim: boolean;      // True if text is an exact substring of source");
  lines.push("    sourceId: string;       // Maps to source_materials.id");
  lines.push("    sourceTitle: string;    // Human-readable filename");
  lines.push('    chunkRef: string;       // Chunk ID (e.g. "src-001-chunk-3")');
  lines.push("    relevance: string;      // Why this answers the query");
  lines.push('    confidence: "high" | "medium" | "low";');
  lines.push("  }>;");
  lines.push("  summary: string | null;        // Synthesis across snippets (optional)");
  lines.push("  queryUnderstood: boolean;      // False if query is ambiguous");
  lines.push("  noResultsReason: string | null; // Explanation when snippets is empty");
  lines.push("}");
  lines.push("```");
  lines.push("");

  // --- Chunk format specification ---
  lines.push("## Chunk Format Specification");
  lines.push("");
  lines.push("Sources are chunked at block-level HTML elements before sending to the LLM:");
  lines.push("");
  lines.push("```");
  lines.push('<source id="src-001" title="Document Title">');
  lines.push('<chunk id="src-001-chunk-1">First paragraph text...</chunk>');
  lines.push('<chunk id="src-001-chunk-2">Second paragraph text...</chunk>');
  lines.push("</source>");
  lines.push("```");
  lines.push("");
  lines.push(
    "Block elements that trigger chunk boundaries: `<p>`, `<h1>`-`<h6>`, `<li>`, `<blockquote>`, `<div>`, `<tr>`, `<pre>`, `<figcaption>`.",
  );
  lines.push("");
  lines.push(
    "The `chunkifyHTML(sourceId, html)` utility in the quality gate script is reusable for production (#126).",
  );
  lines.push("");

  // --- AIProvider extension ---
  lines.push("## Proposed AIProvider Extension");
  lines.push("");
  lines.push(
    "The current `AIProvider` interface (see `workers/dc-api/src/services/ai-provider.ts`) is streaming-only.",
  );
  lines.push("Research queries need non-streaming JSON completions. Proposed addition:");
  lines.push("");
  lines.push("```typescript");
  lines.push("interface AIProvider {");
  lines.push("  // Existing");
  lines.push("  streamCompletion(");
  lines.push("    systemPrompt: string,");
  lines.push("    userMessage: string,");
  lines.push("    options?: CompletionOptions,");
  lines.push("  ): Promise<ReadableStream<AIStreamEvent>>;");
  lines.push("");
  lines.push("  // New: non-streaming JSON completion for structured responses");
  lines.push("  jsonCompletion<T>(");
  lines.push("    systemPrompt: string,");
  lines.push("    userMessage: string,");
  lines.push("    options?: JsonCompletionOptions,");
  lines.push("  ): Promise<JsonCompletionResult<T>>;");
  lines.push("");
  lines.push("  readonly model: string;");
  lines.push("}");
  lines.push("");
  lines.push("interface JsonCompletionOptions extends CompletionOptions {");
  lines.push("  /** Enable API-level JSON mode (provider-dependent) */");
  lines.push("  jsonMode?: boolean;");
  lines.push("}");
  lines.push("");
  lines.push("interface JsonCompletionResult<T> {");
  lines.push("  parsed: T | null;");
  lines.push("  raw: string;");
  lines.push("  tokens: { prompt: number; completion: number };");
  lines.push("  latencyMs: number;");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push(
    "Both `OpenAIProvider` and `WorkersAIProvider` would implement `jsonCompletion`. " +
      "OpenAI can use `response_format: { type: 'json_object' }` when `jsonMode` is true. " +
      "Workers AI falls back to prompt-level JSON enforcement.",
  );
  lines.push("");

  // --- Decision ---
  lines.push("## Decision");
  lines.push("");
  lines.push("_To be completed after manual review of the experiment results._");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  validateEnv();

  console.log("Research Query Quality Gate — Prompt Engineering Experiment");
  console.log(`Edge:     ${EDGE_MODEL}`);
  console.log(`Frontier: ${FRONTIER_MODEL}`);
  console.log("");

  // Load test cases
  const raw = await readFile(FIXTURES_PATH, "utf-8");
  const cases: TestCase[] = JSON.parse(raw);
  console.log(`Loaded ${cases.length} test cases`);
  console.log("");

  // Chunk all sources
  const caseChunks = new Map<string, Map<string, ChunkedSource>>();
  for (const tc of cases) {
    const chunksMap = new Map<string, ChunkedSource>();
    for (const source of tc.sources) {
      const chunks = chunkifyHTML(source.id, source.htmlContent);
      chunksMap.set(source.id, {
        sourceId: source.id,
        sourceTitle: source.title,
        chunks,
      });
    }
    caseChunks.set(tc.id, chunksMap);
  }

  const results: ExperimentResult[] = [];
  const strategies: Strategy[] = ["A", "B", "C", "D"];
  const totalCalls =
    cases.length * 3 * 2 + // A, B, C on both models
    cases.length * 1; // D on frontier only
  let callNum = 0;

  for (const tc of cases) {
    const chunksMap = caseChunks.get(tc.id)!;
    const chunkedSources = [...chunksMap.values()];

    for (const strategy of strategies) {
      const models: Array<{ tier: ModelTier; name: string }> =
        strategy === "D"
          ? [{ tier: "frontier", name: FRONTIER_MODEL }]
          : [
              { tier: "edge", name: EDGE_MODEL },
              { tier: "frontier", name: FRONTIER_MODEL },
            ];

      for (const { tier, name } of models) {
        callNum++;
        const label = `[${String(callNum).padStart(2)}/${totalCalls}] ${tc.id} ${strategy}/${tier}`;
        process.stdout.write(`${label.padEnd(55)} ... `);

        // Build prompt
        let prompt: { system: string; user: string };
        switch (strategy) {
          case "A":
            prompt = buildPromptA(tc.query, chunkedSources);
            break;
          case "B":
            prompt = buildPromptB(tc.query, chunkedSources);
            break;
          case "C":
            prompt = buildPromptC(tc.query, chunkedSources);
            break;
          case "D":
            prompt = buildPromptD(tc.query, chunkedSources);
            break;
        }

        // Call model
        let apiResult: APICallResult;
        if (tier === "frontier") {
          apiResult = await callOpenAI(
            prompt.system,
            prompt.user,
            strategy === "D", // JSON mode for strategy D
          );
        } else {
          apiResult = await callWorkersAI(prompt.system, prompt.user);
        }

        // Validate
        const validation = validateResponse(apiResult.raw, tc, chunksMap);

        const statusEmoji = validation.schemaConformant
          ? "OK"
          : validation.cleanedJsonValid
            ? "SCHEMA_ERR"
            : validation.notRecoverable
              ? "NO_JSON"
              : "CLEANED";

        console.log(
          `${apiResult.latencyMs}ms ${statusEmoji} (${validation.exactMatchCount}/${validation.totalSnippets} exact)`,
        );

        results.push({
          caseId: tc.id,
          queryType: tc.queryType,
          genre: tc.genre,
          strategy,
          model: tier,
          modelName: name,
          latencyMs: apiResult.latencyMs,
          tokens: apiResult.tokens,
          validation,
          rawOutput: apiResult.raw,
        });

        await sleep(INTER_CALL_DELAY_MS);
      }
    }
  }

  // Generate report
  const dateStr = new Date().toISOString().split("T")[0];
  const markdown = generateReport(results, dateStr);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, markdown, "utf-8");

  console.log("");
  console.log(`Results written to: docs/adr/ADR-007-research-query-prompts.md`);
  console.log("");

  // Print summary
  const schemaPass = results.filter((r) => r.validation.schemaConformant).length;
  const totalSnippets = results.reduce((s, r) => s + r.validation.totalSnippets, 0);
  const exactMatches = results.reduce((s, r) => s + r.validation.exactMatchCount, 0);

  console.log("=== SUMMARY ===");
  console.log(`Total API calls: ${results.length}`);
  console.log(
    `Schema conformant: ${schemaPass}/${results.length} (${Math.round((100 * schemaPass) / results.length)}%)`,
  );
  console.log(
    `Exact snippet matches: ${exactMatches}/${totalSnippets} (${totalSnippets > 0 ? Math.round((100 * exactMatches) / totalSnippets) : 0}%)`,
  );
}

// Only run main when executed directly (not when imported for testing)
const isDirectRun =
  process.argv[1]?.endsWith("research-query-quality-gate.ts") ||
  process.argv[1]?.includes("research-query-quality-gate");

if (isDirectRun) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
