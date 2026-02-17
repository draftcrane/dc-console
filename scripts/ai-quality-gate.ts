/**
 * B0 Quality Gate — Edge vs Frontier AI Comparison
 *
 * Runs 10 test cases through both the edge (Workers AI) and frontier (OpenAI)
 * tiers using production prompts, then writes a blind A/B comparison to
 * docs/adr/ADR-006-quality-gate-results.md for human review.
 *
 * Usage:
 *   infisical run --path /dc -- npx tsx scripts/ai-quality-gate.ts
 *
 * Required env vars:
 *   CF_WORKERS_AI_TOKEN — Shared Workers AI tooling token (stored at /vc in Infisical)
 *   CF_ACCOUNT_ID      — Cloudflare account ID (ab6cc9362f7e51ba9a610aec1fc3a833)
 *   OPENAI_API_KEY     — OpenAI API key
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSystemPrompt,
  buildUserMessage,
  type RewriteInput,
} from "../workers/dc-api/src/services/ai-rewrite.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EDGE_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const FRONTIER_MODEL = "gpt-4o";
const INTER_CALL_DELAY_MS = 1_000;
const REQUEST_TIMEOUT_MS = 60_000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = resolve(__dirname, "fixtures/ai-quality-gate-cases.json");
const OUTPUT_PATH = resolve(__dirname, "../docs/adr/ADR-006-quality-gate-results.md");

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const CF_WORKERS_AI_TOKEN = process.env.CF_WORKERS_AI_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "ab6cc9362f7e51ba9a610aec1fc3a833";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!CF_WORKERS_AI_TOKEN) {
  console.error(
    "Missing CF_WORKERS_AI_TOKEN — shared tooling token stored at /vc in Infisical.\n" +
      "Ensure it's synced to /dc, then run: infisical run --path /dc -- npx tsx scripts/ai-quality-gate.ts",
  );
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY — set via Infisical or env");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestCase {
  id: string;
  rewriteType: string;
  genre: string;
  instruction: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  chapterTitle: string;
  projectDescription: string;
}

interface CaseResult {
  caseId: string;
  rewriteType: string;
  genre: string;
  instruction: string;
  selectedText: string;
  edgeOutput: string;
  frontierOutput: string;
  edgeLatencyMs: number;
  frontierLatencyMs: number;
  /** true = Version A is edge, false = Version A is frontier */
  edgeIsA: boolean;
}

// ---------------------------------------------------------------------------
// API callers
// ---------------------------------------------------------------------------

async function callWorkersAI(
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; latencyMs: number }> {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
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
      return callWorkersAI(systemPrompt, userMessage);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        text: `[ERROR: Workers AI ${response.status} — ${body.slice(0, 200)}]`,
        latencyMs: Date.now() - start,
      };
    }

    const json = (await response.json()) as {
      result?: { response?: string };
      errors?: Array<{ message: string }>;
    };
    const text =
      json.result?.response?.trim() ||
      (json.errors?.length ? `[ERROR: ${json.errors[0].message}]` : "[EMPTY RESPONSE]");

    return { text, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { text: `[ERROR: ${msg}]`, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; latencyMs: number }> {
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FRONTIER_MODEL,
        max_tokens: 4096,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "", 10) || 30;
      console.log(`    429 — retrying in ${retryAfter}s`);
      await sleep(retryAfter * 1000);
      return callOpenAI(systemPrompt, userMessage);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        text: `[ERROR: OpenAI ${response.status} — ${body.slice(0, 200)}]`,
        latencyMs: Date.now() - start,
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() || "[EMPTY RESPONSE]";

    return { text, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { text: `[ERROR: ${msg}]`, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toRewriteInput(tc: TestCase): RewriteInput {
  return {
    selectedText: tc.selectedText,
    instruction: tc.instruction,
    contextBefore: tc.contextBefore,
    contextAfter: tc.contextAfter,
    chapterTitle: tc.chapterTitle,
    projectDescription: tc.projectDescription,
    chapterId: "quality-gate",
  };
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

// ---------------------------------------------------------------------------
// Output generation
// ---------------------------------------------------------------------------

function generateResultsMarkdown(results: CaseResult[], dateStr: string): string {
  const lines: string[] = [];

  lines.push("# ADR-006 Quality Gate Results");
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| **Date** | ${dateStr} |`);
  lines.push(`| **Edge model** | \`${EDGE_MODEL}\` |`);
  lines.push(`| **Frontier model** | \`${FRONTIER_MODEL}\` |`);
  lines.push(`| **Cases** | ${results.length} |`);
  lines.push("");

  lines.push("## How to Evaluate");
  lines.push("");
  lines.push(
    "For each case below, read the original text and instruction, then compare Version A and Version B. Judge which output better follows the instruction while maintaining quality prose. Note any failures: hallucination, ignoring the instruction, wrong tone, adding preamble/explanation the prompt forbids.",
  );
  lines.push("");
  lines.push(
    "After evaluating all cases, check the **Reveal Key** at the bottom to see which tier produced which version.",
  );
  lines.push("");

  lines.push("---");
  lines.push("");

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const versionA = r.edgeIsA ? r.edgeOutput : r.frontierOutput;
    const versionB = r.edgeIsA ? r.frontierOutput : r.edgeOutput;

    lines.push(`## Case ${i + 1}: ${r.caseId}`);
    lines.push("");
    lines.push(`**Type:** ${r.rewriteType} | **Genre:** ${r.genre}`);
    lines.push("");
    lines.push(`**Instruction:** ${r.instruction}`);
    lines.push("");
    lines.push("### Original Text");
    lines.push("");
    lines.push(`> ${r.selectedText.replace(/\n/g, "\n> ")}`);
    lines.push("");
    lines.push("### Version A");
    lines.push("");
    lines.push(versionA);
    lines.push("");
    lines.push("### Version B");
    lines.push("");
    lines.push(versionB);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("## Latency");
  lines.push("");
  lines.push("| Case | Edge (ms) | Frontier (ms) |");
  lines.push("|------|-----------|---------------|");
  for (const r of results) {
    lines.push(`| ${r.caseId} | ${r.edgeLatencyMs} | ${r.frontierLatencyMs} |`);
  }

  const edgeLatencies = results.map((r) => r.edgeLatencyMs).sort((a, b) => a - b);
  const frontierLatencies = results.map((r) => r.frontierLatencyMs).sort((a, b) => a - b);
  const mean = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const p95 = (arr: number[]) => arr[Math.floor(arr.length * 0.95)] ?? arr[arr.length - 1];

  lines.push(`| **Mean** | **${mean(edgeLatencies)}** | **${mean(frontierLatencies)}** |`);
  lines.push(`| **P95** | **${p95(edgeLatencies)}** | **${p95(frontierLatencies)}** |`);
  lines.push("");

  lines.push("<details>");
  lines.push("<summary>Reveal Key (click after evaluating)</summary>");
  lines.push("");
  lines.push("| Case | Version A | Version B |");
  lines.push("|------|-----------|-----------|");
  for (const r of results) {
    const aLabel = r.edgeIsA ? "Edge" : "Frontier";
    const bLabel = r.edgeIsA ? "Frontier" : "Edge";
    lines.push(`| ${r.caseId} | ${aLabel} | ${bLabel} |`);
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("## Verdict");
  lines.push("");
  lines.push("**Result:** ___________________ (PASS / FAIL / CONDITIONAL)");
  lines.push("");
  lines.push("**Notes:**");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("B0 Quality Gate — Edge vs Frontier");
  console.log(`Edge:     ${EDGE_MODEL}`);
  console.log(`Frontier: ${FRONTIER_MODEL}`);
  console.log("");

  const raw = await readFile(FIXTURES_PATH, "utf-8");
  const cases: TestCase[] = JSON.parse(raw);

  const results: CaseResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const input = toRewriteInput(tc);
    const systemPrompt = buildSystemPrompt(input);
    const userMessage = buildUserMessage(input);
    const label = `[${pad(i + 1, 2)}/${cases.length}] ${tc.id}`;

    process.stdout.write(`${label.padEnd(35)} ... `);

    // Call edge
    const edge = await callWorkersAI(systemPrompt, userMessage);
    await sleep(INTER_CALL_DELAY_MS);

    // Call frontier
    const frontier = await callOpenAI(systemPrompt, userMessage);

    console.log(`edge ${edge.latencyMs}ms, frontier ${frontier.latencyMs}ms`);

    // Random A/B assignment
    const edgeIsA = Math.random() < 0.5;

    results.push({
      caseId: tc.id,
      rewriteType: tc.rewriteType,
      genre: tc.genre,
      instruction: tc.instruction,
      selectedText: tc.selectedText,
      edgeOutput: edge.text,
      frontierOutput: frontier.text,
      edgeLatencyMs: edge.latencyMs,
      frontierLatencyMs: frontier.latencyMs,
      edgeIsA,
    });

    if (i < cases.length - 1) {
      await sleep(INTER_CALL_DELAY_MS);
    }
  }

  // Write results
  const dateStr = new Date().toISOString().split("T")[0];
  const markdown = generateResultsMarkdown(results, dateStr);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, markdown, "utf-8");

  console.log("");
  console.log(`Results: docs/adr/ADR-006-quality-gate-results.md`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
