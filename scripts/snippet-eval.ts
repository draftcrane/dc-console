/**
 * Snippet Evaluation Runner (#134)
 *
 * Runs 24 ground-truth queries × 4 models × up to 3 prompt strategies.
 * Evaluates: JSON parse success, schema compliance, verbatim extraction,
 * source attribution accuracy, negative query handling, latency.
 *
 * Usage:
 *   infisical run --path /dc -- npx tsx scripts/snippet-eval.ts
 *
 * Environment variables required:
 *   OPENAI_API_KEY         — OpenAI API key
 *   CLOUDFLARE_API_TOKEN   — Cloudflare API token (for Workers AI)
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID
 *   ANTHROPIC_API_KEY      — Anthropic API key
 *
 * Options:
 *   --model=<id>         Run only one model (gpt-4o, gpt-4o-mini, mistral-small-3.1, claude-sonnet-4-5)
 *   --strategy=<A|B|C>   Run only one strategy
 *   --query=<id>         Run only one query
 *   --skip-model=<id>    Skip a model (can be repeated)
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chunkHtml, type Chunk } from "./chunking-spike.js";
import {
  MODELS,
  PROMPT_STRATEGIES,
  buildUserMessage,
  callOpenAI,
  callWorkersAI,
  callAnthropic,
  evaluateResponse,
  type ModelConfig,
  type PromptStrategy,
  type ModelResponse,
  type EvalMetrics,
} from "./snippet-prompt-spike.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures/chunking-spike");
const OUTPUT_DIR = resolve(__dirname, "fixtures/snippet-spike");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Query {
  id: string;
  query: string;
  type: string;
  expectedSourceIds: string[];
  expectedPhrases: string[];
}

interface SourceMeta {
  id: string;
  title: string;
  htmlType: string;
  wordCount: number;
  file: string;
}

interface FixtureManifest {
  name: string;
  sources: SourceMeta[];
  totalWordCount: number;
}

interface EvalRun {
  queryId: string;
  queryType: string;
  query: string;
  modelId: string;
  strategy: PromptStrategy;
  chunksProvided: number;
  response: {
    raw: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
  metrics: EvalMetrics;
}

interface EvalSummary {
  timestamp: string;
  totalRuns: number;
  totalQueries: number;
  models: string[];
  strategies: string[];
  perModelStrategy: Array<{
    modelId: string;
    strategy: string;
    runs: number;
    jsonParseRate: number;
    schemaComplianceRate: number;
    avgVerbatimRate: number;
    avgAttributionAccuracy: number;
    negativeQueryAccuracy: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    avgSnippetCount: number;
  }>;
  runs: EvalRun[];
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): {
  onlyModel: string | null;
  onlyStrategy: PromptStrategy | null;
  onlyQuery: string | null;
  skipModels: Set<string>;
} {
  const args = process.argv.slice(2);
  let onlyModel: string | null = null;
  let onlyStrategy: PromptStrategy | null = null;
  let onlyQuery: string | null = null;
  const skipModels = new Set<string>();

  for (const arg of args) {
    if (arg.startsWith("--model=")) onlyModel = arg.split("=")[1];
    if (arg.startsWith("--strategy=")) onlyStrategy = arg.split("=")[1] as PromptStrategy;
    if (arg.startsWith("--query=")) onlyQuery = arg.split("=")[1];
    if (arg.startsWith("--skip-model=")) skipModels.add(arg.split("=")[1]);
  }

  return { onlyModel, onlyStrategy, onlyQuery, skipModels };
}

// ---------------------------------------------------------------------------
// Fixture Loading
// ---------------------------------------------------------------------------

async function loadAllChunks(): Promise<Map<string, Chunk[]>> {
  const chunksBySource = new Map<string, Chunk[]>();
  const fixtureDirs = await readdir(FIXTURES_DIR);

  for (const dir of fixtureDirs.filter((d) => d.startsWith("fixture-")).sort()) {
    const manifestPath = resolve(FIXTURES_DIR, dir, "manifest.json");
    let manifest: FixtureManifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    } catch {
      continue;
    }

    for (const source of manifest.sources) {
      const html = await readFile(resolve(FIXTURES_DIR, dir, source.file), "utf-8");
      const chunks = chunkHtml(
        source.id,
        source.title,
        html,
        source.htmlType as "structured" | "flat",
      );
      chunksBySource.set(source.id, chunks);
    }
  }

  return chunksBySource;
}

/**
 * Select chunks relevant to a query for LLM evaluation.
 *
 * For positive queries (keyword, paraphrase, multi-source):
 *   - Select chunks from expected sources that contain any expected phrase
 *   - If no phrase-matched chunks, take first 2 chunks from each expected source
 *   - Add 2 distractor chunks from non-expected sources for realism
 *
 * For negative queries:
 *   - Select 4 random chunks from various sources (none are expected to match)
 */
function selectChunksForQuery(query: Query, chunksBySource: Map<string, Chunk[]>): Chunk[] {
  if (query.type === "negative") {
    // For negative queries, pick chunks that are clearly off-topic
    const allChunks: Chunk[] = [];
    for (const chunks of chunksBySource.values()) {
      allChunks.push(...chunks);
    }
    // Take 4 diverse chunks
    const step = Math.floor(allChunks.length / 4);
    return [allChunks[0], allChunks[step], allChunks[step * 2], allChunks[step * 3]].filter(
      Boolean,
    );
  }

  const selectedChunks: Chunk[] = [];

  // Get chunks from expected sources
  for (const sourceId of query.expectedSourceIds) {
    const sourceChunks = chunksBySource.get(sourceId);
    if (!sourceChunks) continue;

    // Find chunks that contain expected phrases
    const phraseMatched = sourceChunks.filter((chunk) =>
      query.expectedPhrases.some((phrase) =>
        chunk.text.toLowerCase().includes(phrase.toLowerCase()),
      ),
    );

    if (phraseMatched.length > 0) {
      selectedChunks.push(...phraseMatched.slice(0, 3));
    } else {
      // Fallback: take first 2 chunks
      selectedChunks.push(...sourceChunks.slice(0, 2));
    }
  }

  // Add 2 distractor chunks from other sources
  const expectedSet = new Set(query.expectedSourceIds);
  const distractors: Chunk[] = [];
  for (const [sourceId, chunks] of chunksBySource) {
    if (expectedSet.has(sourceId)) continue;
    if (distractors.length >= 2) break;
    if (chunks.length > 0) distractors.push(chunks[0]);
  }
  selectedChunks.push(...distractors);

  return selectedChunks;
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit = message.includes("429") || message.includes("rate_limit");
      if (!isRateLimit || attempt === maxRetries) throw err;
      const backoff = Math.min(2000 * Math.pow(2, attempt), 30000);
      process.stdout.write(`(retry in ${(backoff / 1000).toFixed(0)}s) `);
      await sleep(backoff);
    }
  }
  throw new Error("Unreachable");
}

// ---------------------------------------------------------------------------
// Model Dispatcher
// ---------------------------------------------------------------------------

async function callModel(
  model: ModelConfig,
  strategy: PromptStrategy,
  systemPrompt: string,
  userMessage: string,
): Promise<ModelResponse> {
  const config = PROMPT_STRATEGIES[strategy];

  switch (model.provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set");
      return withRetry(() =>
        callOpenAI(apiKey, model.model, systemPrompt, userMessage, config.responseFormat),
      );
    }
    case "workers-ai": {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      if (!accountId || !apiToken)
        throw new Error("CLOUDFLARE_ACCOUNT_ID/CF_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not set");
      return withRetry(() =>
        callWorkersAI(
          accountId,
          apiToken,
          model.model,
          systemPrompt,
          userMessage,
          config.responseFormat,
        ),
      );
    }
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
      return withRetry(() =>
        callAnthropic(apiKey, model.model, systemPrompt, userMessage, strategy),
      );
    }
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Main Evaluation Loop
// ---------------------------------------------------------------------------

async function main() {
  const { onlyModel, onlyStrategy, onlyQuery, skipModels } = parseArgs();

  console.log("=== Snippet Evaluation Runner (#134) ===\n");

  // Validate environment
  const envChecks = [
    ["OPENAI_API_KEY", !!process.env.OPENAI_API_KEY],
    ["CLOUDFLARE_API_TOKEN", !!process.env.CLOUDFLARE_API_TOKEN],
    ["CLOUDFLARE_ACCOUNT_ID", !!(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID)],
    ["ANTHROPIC_API_KEY", !!process.env.ANTHROPIC_API_KEY],
  ] as const;

  console.log("Environment:");
  for (const [name, present] of envChecks) {
    console.log(`  ${present ? "+" : "-"} ${name}`);
  }

  // Load fixtures and queries
  console.log("\nLoading fixtures...");
  const chunksBySource = await loadAllChunks();
  let totalChunks = 0;
  for (const chunks of chunksBySource.values()) totalChunks += chunks.length;
  console.log(`  ${chunksBySource.size} sources, ${totalChunks} total chunks`);

  const queries: Query[] = JSON.parse(
    await readFile(resolve(FIXTURES_DIR, "queries.json"), "utf-8"),
  );
  console.log(`  ${queries.length} queries loaded\n`);

  // Filter models and strategies
  const models = MODELS.filter((m) => {
    if (skipModels.has(m.id)) return false;
    if (onlyModel && m.id !== onlyModel) return false;
    // Skip models missing required env vars
    if (m.provider === "openai" && !process.env.OPENAI_API_KEY) return false;
    if (
      m.provider === "workers-ai" &&
      (!process.env.CLOUDFLARE_API_TOKEN ||
        !(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID))
    )
      return false;
    if (m.provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) return false;
    return true;
  });

  const strategies: PromptStrategy[] = (["A", "B", "C"] as PromptStrategy[]).filter(
    (s) => !onlyStrategy || s === onlyStrategy,
  );

  const filteredQueries = queries.filter((q) => !onlyQuery || q.id === onlyQuery);

  // Count total runs
  let totalRuns = 0;
  for (const model of models) {
    for (const strategy of strategies) {
      if (!model.supportedStrategies.includes(strategy)) continue;
      totalRuns += filteredQueries.length;
    }
  }

  console.log(
    `Running ${totalRuns} evaluations (${models.length} models × ${strategies.length} strategies × ${filteredQueries.length} queries)\n`,
  );

  const runs: EvalRun[] = [];
  let completed = 0;

  for (const model of models) {
    for (const strategy of strategies) {
      if (!model.supportedStrategies.includes(strategy)) continue;

      console.log(
        `\n--- ${model.name} / Strategy ${strategy} (${PROMPT_STRATEGIES[strategy].name}) ---`,
      );

      for (const query of filteredQueries) {
        completed++;
        const progress = `[${completed}/${totalRuns}]`;

        // Select chunks for this query
        const chunks = selectChunksForQuery(query, chunksBySource);
        const systemPrompt = PROMPT_STRATEGIES[strategy].systemPrompt;
        const userMessage = buildUserMessage(query.query, chunks);

        process.stdout.write(`  ${progress} ${query.id} (${query.type})... `);

        try {
          const response = await callModel(model, strategy, systemPrompt, userMessage);

          const metrics = evaluateResponse(response, chunks, query.type, query.expectedSourceIds);

          // Print compact result
          const flags: string[] = [];
          if (!metrics.jsonParseSuccess) flags.push("JSON_FAIL");
          if (!metrics.schemaCompliant) flags.push("SCHEMA_FAIL");
          if (metrics.verbatimRate < 0.5 && query.type !== "negative")
            flags.push(`VER:${(metrics.verbatimRate * 100).toFixed(0)}%`);
          if (metrics.attributionAccuracy < 0.5 && query.type !== "negative")
            flags.push(`ATT:${(metrics.attributionAccuracy * 100).toFixed(0)}%`);
          if (metrics.negativeQueryCorrect === false) flags.push("NEG_FAIL");

          const status =
            flags.length === 0
              ? `OK (${response.latencyMs}ms, ${metrics.snippetCount} snippets)`
              : `ISSUES: ${flags.join(", ")} (${response.latencyMs}ms)`;

          console.log(status);

          runs.push({
            queryId: query.id,
            queryType: query.type,
            query: query.query,
            modelId: model.id,
            strategy,
            chunksProvided: chunks.length,
            response: {
              raw: response.raw,
              latencyMs: response.latencyMs,
              inputTokens: response.inputTokens,
              outputTokens: response.outputTokens,
              model: response.model,
            },
            metrics,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.log(`ERROR: ${message}`);

          runs.push({
            queryId: query.id,
            queryType: query.type,
            query: query.query,
            modelId: model.id,
            strategy,
            chunksProvided: chunks.length,
            response: {
              raw: "",
              latencyMs: 0,
              inputTokens: 0,
              outputTokens: 0,
              model: model.model,
            },
            metrics: {
              jsonParseSuccess: false,
              schemaCompliant: false,
              schemaError: `API error: ${message}`,
              snippetCount: 0,
              verbatimRate: 0,
              attributionAccuracy: 0,
              negativeQueryCorrect: query.type === "negative" ? false : null,
              summaryPresent: false,
              summaryWordCount: 0,
            },
          });
        }

        // Delay between API calls to stay within rate limits (30K TPM for OpenAI)
        const delayMs = model.provider === "openai" ? 3000 : 1000;
        await sleep(delayMs);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Aggregate results
  // ---------------------------------------------------------------------------

  console.log("\n\n=== AGGREGATE RESULTS ===\n");

  const perModelStrategy: EvalSummary["perModelStrategy"] = [];

  const groupKeys = new Set(runs.map((r) => `${r.modelId}|${r.strategy}`));

  for (const key of [...groupKeys].sort()) {
    const [modelId, strategy] = key.split("|");
    const group = runs.filter((r) => r.modelId === modelId && r.strategy === strategy);

    const positiveRuns = group.filter((r) => r.queryType !== "negative");
    const negativeRuns = group.filter((r) => r.queryType === "negative");

    const jsonParseRate = avg(group.map((r) => (r.metrics.jsonParseSuccess ? 1 : 0)));
    const schemaComplianceRate = avg(group.map((r) => (r.metrics.schemaCompliant ? 1 : 0)));
    const avgVerbatimRate = avg(positiveRuns.map((r) => r.metrics.verbatimRate));
    const avgAttribution = avg(positiveRuns.map((r) => r.metrics.attributionAccuracy));
    const negativeAccuracy = avg(negativeRuns.map((r) => (r.metrics.negativeQueryCorrect ? 1 : 0)));
    const latencies = group.map((r) => r.response.latencyMs);

    const entry = {
      modelId,
      strategy,
      runs: group.length,
      jsonParseRate,
      schemaComplianceRate,
      avgVerbatimRate,
      avgAttributionAccuracy: avgAttribution,
      negativeQueryAccuracy: negativeAccuracy,
      avgLatencyMs: Math.round(avg(latencies)),
      p50LatencyMs: Math.round(percentile(latencies, 50)),
      p95LatencyMs: Math.round(percentile(latencies, 95)),
      avgInputTokens: Math.round(avg(group.map((r) => r.response.inputTokens))),
      avgOutputTokens: Math.round(avg(group.map((r) => r.response.outputTokens))),
      avgSnippetCount: parseFloat(avg(positiveRuns.map((r) => r.metrics.snippetCount)).toFixed(1)),
    };

    perModelStrategy.push(entry);

    // Print table row
    console.log(`${modelId} / Strategy ${strategy}:`);
    console.log(`  JSON parse:    ${(entry.jsonParseRate * 100).toFixed(0)}%`);
    console.log(`  Schema:        ${(entry.schemaComplianceRate * 100).toFixed(0)}%`);
    console.log(`  Verbatim:      ${(entry.avgVerbatimRate * 100).toFixed(0)}%`);
    console.log(`  Attribution:   ${(entry.avgAttributionAccuracy * 100).toFixed(0)}%`);
    console.log(`  Negative:      ${(entry.negativeQueryAccuracy * 100).toFixed(0)}%`);
    console.log(`  Latency:       p50=${entry.p50LatencyMs}ms  p95=${entry.p95LatencyMs}ms`);
    console.log(`  Tokens:        in=${entry.avgInputTokens}  out=${entry.avgOutputTokens}`);
    console.log(`  Avg snippets:  ${entry.avgSnippetCount}`);
    console.log();
  }

  // Pass/fail summary
  console.log("=== PASS/FAIL THRESHOLDS ===\n");

  const thresholds = [
    {
      name: "JSON parse (100%)",
      check: (e: (typeof perModelStrategy)[0]) => e.jsonParseRate >= 1.0,
    },
    {
      name: "Schema (>95%)",
      check: (e: (typeof perModelStrategy)[0]) => e.schemaComplianceRate >= 0.95,
    },
    {
      name: "Verbatim (>80%)",
      check: (e: (typeof perModelStrategy)[0]) => e.avgVerbatimRate >= 0.8,
    },
    {
      name: "Attribution (>95%)",
      check: (e: (typeof perModelStrategy)[0]) => e.avgAttributionAccuracy >= 0.95,
    },
    {
      name: "Negative (>90%)",
      check: (e: (typeof perModelStrategy)[0]) => e.negativeQueryAccuracy >= 0.9,
    },
    {
      name: "Latency p50 (<5s)",
      check: (e: (typeof perModelStrategy)[0]) => e.p50LatencyMs < 5000,
    },
    {
      name: "Latency p95 (<10s)",
      check: (e: (typeof perModelStrategy)[0]) => e.p95LatencyMs < 10000,
    },
  ];

  for (const entry of perModelStrategy) {
    const results = thresholds.map((t) => ({
      name: t.name,
      pass: t.check(entry),
    }));
    const allPass = results.every((r) => r.pass);
    const passCount = results.filter((r) => r.pass).length;

    console.log(
      `${entry.modelId} / ${entry.strategy}: ${allPass ? "ALL PASS" : `${passCount}/${results.length}`} — ${results.map((r) => `${r.pass ? "PASS" : "FAIL"} ${r.name}`).join(" | ")}`,
    );
  }

  // Cost analysis
  console.log("\n=== COST ANALYSIS ===\n");
  console.log("Estimated cost per query (based on avg tokens):\n");

  for (const entry of perModelStrategy) {
    const model = MODELS.find((m) => m.id === entry.modelId);
    if (!model || model.costInputPerMillion === 0) {
      console.log(`  ${entry.modelId} / ${entry.strategy}: Included in plan (Workers AI)`);
      continue;
    }
    const inputCost = (entry.avgInputTokens / 1_000_000) * model.costInputPerMillion;
    const outputCost = (entry.avgOutputTokens / 1_000_000) * model.costOutputPerMillion;
    const totalCost = inputCost + outputCost;
    console.log(
      `  ${entry.modelId} / ${entry.strategy}: $${totalCost.toFixed(5)}/query ($${(totalCost * 20 * 30 * 10).toFixed(2)}/mo at 20 queries/day × 10 users)`,
    );
  }

  // Write results
  const summary: EvalSummary = {
    timestamp: new Date().toISOString(),
    totalRuns: runs.length,
    totalQueries: filteredQueries.length,
    models: models.map((m) => m.id),
    strategies,
    perModelStrategy,
    runs,
  };

  const outputPath = resolve(OUTPUT_DIR, "eval-results.json");
  await writeFile(outputPath, JSON.stringify(summary, null, 2));
  console.log(`\nResults written to ${outputPath}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
