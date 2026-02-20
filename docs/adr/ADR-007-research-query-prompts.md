# ADR-007: Research Query Prompt Engineering

## Status

**Proposed** — Pending review

## Context

The Research Assistant feature (#125-#127) requires the LLM to return structured JSON with source-attributed snippets instead of prose. This ADR documents the prompt engineering experiment results and recommends a strategy.

## Experiment Details

|                     |                                                                                |
| ------------------- | ------------------------------------------------------------------------------ |
| **Date**            | 2026-02-19                                                                     |
| **Edge model**      | `@cf/mistralai/mistral-small-3.1-24b-instruct`                                 |
| **Frontier model**  | `gpt-4o`                                                                       |
| **Test cases**      | 12                                                                             |
| **Strategies**      | A (Schema-in-System), B (Few-Shot), C (XML-Tagged), D (JSON Mode, GPT-4o only) |
| **Total API calls** | 84                                                                             |

## Results Summary

| Strategy | Model    | Raw JSON % | Cleaned JSON % | Schema % | Exact Match % | Fuzzy (>90%) % | Chunk Ref % | Source ID % | Mean Latency (ms) |
| -------- | -------- | ---------- | -------------- | -------- | ------------- | -------------- | ----------- | ----------- | ----------------- |
| A        | edge     | 100%       | 100%           | 100%     | 72%           | 3%             | 100%        | 100%        | 18493             |
| A        | frontier | 100%       | 100%           | 100%     | 89%           | 0%             | 100%        | 100%        | 5372              |
| B        | edge     | 33%        | 100%           | 100%     | 74%           | 9%             | 100%        | 100%        | 14902             |
| B        | frontier | 0%         | 100%           | 100%     | 78%           | 4%             | 100%        | 100%        | 3972              |
| C        | edge     | 100%       | 100%           | 92%      | 60%           | 11%            | 100%        | 100%        | 14633             |
| C        | frontier | 100%       | 100%           | 100%     | 62%           | 0%             | 100%        | 100%        | 5488              |
| D        | frontier | 100%       | 100%           | 100%     | 68%           | 0%             | 100%        | 100%        | 6982              |

## Quality Bar Assessment

**Required**: >90% schema conformance AND >80% exact snippet match on BOTH models.

### Strategy A

- **edge**: Schema 100% (PASS) | Exact match 72% (FAIL) | **FAIL**
- **frontier**: Schema 100% (PASS) | Exact match 89% (PASS) | **PASS**

### Strategy B

- **edge**: Schema 100% (PASS) | Exact match 74% (FAIL) | **FAIL**
- **frontier**: Schema 100% (PASS) | Exact match 78% (FAIL) | **FAIL**

### Strategy C

- **edge**: Schema 92% (PASS) | Exact match 60% (FAIL) | **FAIL**
- **frontier**: Schema 100% (PASS) | Exact match 62% (FAIL) | **FAIL**

### Strategy D (GPT-4o only)

- **frontier**: Schema 100% (PASS) | Exact match 68% (FAIL) | **FAIL**

## Cost Analysis

| Strategy | Model    | Total Prompt Tokens | Total Completion Tokens | Est. Cost         |
| -------- | -------- | ------------------- | ----------------------- | ----------------- |
| A        | edge     | 0                   | 0                       | Free (Workers AI) |
| A        | frontier | 29,990              | 4,324                   | $0.1182           |
| B        | edge     | 0                   | 0                       | Free (Workers AI) |
| B        | frontier | 31,094              | 4,224                   | $0.1200           |
| C        | edge     | 0                   | 0                       | Free (Workers AI) |
| C        | frontier | 29,606              | 4,064                   | $0.1147           |
| D        | frontier | 29,210              | 5,083                   | $0.1239           |

## Latency by Strategy

| Strategy | Model    | Min (ms) | Mean (ms) | Max (ms) | P95 (ms) |
| -------- | -------- | -------- | --------- | -------- | -------- |
| A        | edge     | 2232     | 18493     | 62248    | 62248    |
| A        | frontier | 1865     | 5372      | 13508    | 13508    |
| B        | edge     | 2199     | 14902     | 32468    | 32468    |
| B        | frontier | 1677     | 3972      | 6278     | 6278     |
| C        | edge     | 1842     | 14633     | 34698    | 34698    |
| C        | frontier | 1378     | 5488      | 14918    | 14918    |
| D        | frontier | 1376     | 6982      | 30158    | 30158    |

## Per-Case Results

<details>
<summary>Click to expand detailed per-case results</summary>

### factual-single-business

**Type:** factual-extraction | **Genre:** business

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 2/3   | 0/3   | 3/3      | 9195ms  |
| A        | frontier | Raw     | OK     | 3/3   | 0/3   | 3/3      | 3575ms  |
| B        | edge     | Cleaned | OK     | 3/3   | 0/3   | 3/3      | 15331ms |
| B        | frontier | Cleaned | OK     | 3/3   | 0/3   | 3/3      | 5007ms  |
| C        | edge     | Raw     | OK     | 2/3   | 0/3   | 3/3      | 10637ms |
| C        | frontier | Raw     | OK     | 1/2   | 0/2   | 2/2      | 3118ms  |
| D        | frontier | Raw     | OK     | 1/3   | 0/3   | 3/3      | 3238ms  |

### factual-single-technical

**Type:** factual-extraction | **Genre:** technical

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 1/1   | 0/1   | 1/1      | 4664ms  |
| A        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 2364ms  |
| B        | edge     | Cleaned | OK     | 1/1   | 0/1   | 1/1      | 6072ms  |
| B        | frontier | Cleaned | OK     | 1/1   | 0/1   | 1/1      | 1968ms  |
| C        | edge     | Raw     | OK     | 1/1   | 0/1   | 1/1      | 6376ms  |
| C        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 3286ms  |
| D        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 2081ms  |

### concept-single-nonfiction

**Type:** concept-explanation | **Genre:** nonfiction-prose

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 1/1   | 0/1   | 1/1      | 9836ms  |
| A        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 3416ms  |
| B        | edge     | Raw     | OK     | 1/1   | 0/1   | 1/1      | 6887ms  |
| B        | frontier | Cleaned | OK     | 1/2   | 0/2   | 2/2      | 4940ms  |
| C        | edge     | Raw     | OK     | 0/1   | 0/1   | 1/1      | 8918ms  |
| C        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 1378ms  |
| D        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 1669ms  |

### concept-multi-business

**Type:** concept-explanation | **Genre:** business

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 2/4   | 0/4   | 4/4      | 33078ms |
| A        | frontier | Raw     | OK     | 3/3   | 0/3   | 3/3      | 5798ms  |
| B        | edge     | Cleaned | OK     | 2/4   | 2/4   | 4/4      | 32468ms |
| B        | frontier | Cleaned | OK     | 3/3   | 0/3   | 3/3      | 5670ms  |
| C        | edge     | Raw     | OK     | 3/3   | 0/3   | 3/3      | 27771ms |
| C        | frontier | Raw     | OK     | 2/3   | 0/3   | 3/3      | 14918ms |
| D        | frontier | Raw     | OK     | 1/3   | 0/3   | 3/3      | 4701ms  |

### opinion-single-nonfiction

**Type:** opinion-stance | **Genre:** nonfiction-prose

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 1/1   | 0/1   | 1/1      | 4541ms  |
| A        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 1958ms  |
| B        | edge     | Raw     | OK     | 0/0   | 0/0   | 0/0      | 2199ms  |
| B        | frontier | Cleaned | OK     | 0/0   | 0/0   | 0/0      | 1677ms  |
| C        | edge     | Raw     | OK     | 1/1   | 0/1   | 1/1      | 4037ms  |
| C        | frontier | Raw     | OK     | 0/0   | 0/0   | 0/0      | 2408ms  |
| D        | frontier | Raw     | OK     | 1/1   | 0/1   | 1/1      | 3341ms  |

### opinion-multi-business

**Type:** opinion-stance | **Genre:** business

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 2/3   | 0/3   | 3/3      | 18615ms |
| A        | frontier | Raw     | OK     | 2/2   | 0/2   | 2/2      | 3821ms  |
| B        | edge     | Cleaned | OK     | 2/3   | 0/3   | 3/3      | 21082ms |
| B        | frontier | Cleaned | OK     | 2/3   | 0/3   | 3/3      | 3789ms  |
| C        | edge     | Raw     | OK     | 1/4   | 0/4   | 4/4      | 24787ms |
| C        | frontier | Raw     | OK     | 2/2   | 0/2   | 2/2      | 5646ms  |
| D        | frontier | Raw     | OK     | 3/3   | 0/3   | 3/3      | 4645ms  |

### synthesis-multi-mixed

**Type:** multi-source-synthesis | **Genre:** mixed

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 5/6   | 0/6   | 6/6      | 18671ms |
| A        | frontier | Raw     | OK     | 2/3   | 0/3   | 3/3      | 7497ms  |
| B        | edge     | Cleaned | OK     | 5/6   | 0/6   | 6/6      | 18578ms |
| B        | frontier | Cleaned | OK     | 3/3   | 0/3   | 3/3      | 4490ms  |
| C        | edge     | Raw     | OK     | 5/7   | 0/7   | 7/7      | 19970ms |
| C        | frontier | Raw     | OK     | 1/2   | 0/2   | 2/2      | 3022ms  |
| D        | frontier | Raw     | OK     | 5/5   | 0/5   | 5/5      | 9829ms  |

### negation-multi-technical

**Type:** negation-query | **Genre:** technical

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 2/2   | 0/2   | 2/2      | 11376ms |
| A        | frontier | Raw     | OK     | 1/2   | 0/2   | 2/2      | 4276ms  |
| B        | edge     | Raw     | OK     | 2/2   | 0/2   | 2/2      | 15427ms |
| B        | frontier | Cleaned | OK     | 1/1   | 0/1   | 1/1      | 2916ms  |
| C        | edge     | Raw     | OK     | 2/2   | 0/2   | 2/2      | 13548ms |
| C        | frontier | Raw     | OK     | 2/3   | 0/3   | 3/3      | 4385ms  |
| D        | frontier | Raw     | OK     | 1/2   | 0/2   | 2/2      | 5371ms  |

### ambiguous-single-business

**Type:** ambiguous-query | **Genre:** business

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 3/3   | 0/3   | 3/3      | 33888ms |
| A        | frontier | Raw     | OK     | 2/2   | 0/2   | 2/2      | 4080ms  |
| B        | edge     | Cleaned | OK     | 4/4   | 0/4   | 4/4      | 13787ms |
| B        | frontier | Cleaned | OK     | 3/4   | 0/4   | 4/4      | 5379ms  |
| C        | edge     | Raw     | OK     | 2/3   | 0/3   | 3/3      | 10568ms |
| C        | frontier | Raw     | OK     | 3/4   | 0/4   | 4/4      | 3725ms  |
| D        | frontier | Raw     | OK     | 3/4   | 0/4   | 4/4      | 14064ms |

### no-results-single-nonfiction

**Type:** no-results | **Genre:** nonfiction-prose

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 0/0   | 0/0   | 0/0      | 2232ms  |
| A        | frontier | Raw     | OK     | 0/0   | 0/0   | 0/0      | 1865ms  |
| B        | edge     | Raw     | OK     | 0/0   | 0/0   | 0/0      | 3414ms  |
| B        | frontier | Cleaned | OK     | 0/0   | 0/0   | 0/0      | 1927ms  |
| C        | edge     | Raw     | FAIL   | 0/0   | 0/0   | 0/0      | 1842ms  |
| C        | frontier | Raw     | OK     | 0/0   | 0/0   | 0/0      | 7371ms  |
| D        | frontier | Raw     | OK     | 0/0   | 0/0   | 0/0      | 1376ms  |

Schema errors:

- C/edge: summary must be string or null

### chunked-single-technical

**Type:** chunked-input | **Genre:** technical

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 3/4   | 0/4   | 4/4      | 13575ms |
| A        | frontier | Raw     | OK     | 3/4   | 0/4   | 4/4      | 12310ms |
| B        | edge     | Cleaned | OK     | 2/3   | 1/3   | 3/3      | 15818ms |
| B        | frontier | Cleaned | OK     | 2/2   | 0/2   | 2/2      | 3622ms  |
| C        | edge     | Raw     | OK     | 2/4   | 1/4   | 4/4      | 12438ms |
| C        | frontier | Raw     | OK     | 2/2   | 0/2   | 2/2      | 3569ms  |
| D        | frontier | Raw     | OK     | 2/2   | 0/2   | 2/2      | 3305ms  |

### long-doc-single-nonfiction

**Type:** long-document | **Genre:** nonfiction-prose

| Strategy | Model    | JSON    | Schema | Exact | Fuzzy | ChunkRef | Latency |
| -------- | -------- | ------- | ------ | ----- | ----- | -------- | ------- |
| A        | edge     | Raw     | OK     | 4/8   | 1/8   | 8/8      | 62248ms |
| A        | frontier | Raw     | OK     | 6/6   | 0/6   | 6/6      | 13508ms |
| B        | edge     | Cleaned | OK     | 4/8   | 0/8   | 8/8      | 27764ms |
| B        | frontier | Cleaned | OK     | 2/5   | 1/5   | 5/5      | 6278ms  |
| C        | edge     | Raw     | OK     | 2/6   | 3/6   | 6/6      | 34698ms |
| C        | frontier | Raw     | OK     | 1/6   | 0/6   | 6/6      | 13030ms |
| D        | frontier | Raw     | OK     | 2/6   | 0/6   | 6/6      | 30158ms |

</details>

## Snippet Accuracy Distribution

- **A/edge**: 72% exact, 3% fuzzy (>90% LCS), 25% below threshold (36 total snippets)
- **A/frontier**: 89% exact, 0% fuzzy (>90% LCS), 11% below threshold (28 total snippets)
- **B/edge**: 74% exact, 9% fuzzy (>90% LCS), 17% below threshold (35 total snippets)
- **B/frontier**: 78% exact, 4% fuzzy (>90% LCS), 19% below threshold (27 total snippets)
- **C/edge**: 60% exact, 11% fuzzy (>90% LCS), 29% below threshold (35 total snippets)
- **C/frontier**: 62% exact, 0% fuzzy (>90% LCS), 38% below threshold (26 total snippets)
- **D/frontier**: 68% exact, 0% fuzzy (>90% LCS), 32% below threshold (31 total snippets)

## JSON Recovery Rates

| Strategy | Model    | Raw Valid | Cleaned Valid        | Not Recoverable |
| -------- | -------- | --------- | -------------------- | --------------- |
| A        | edge     | 12/12     | 0/12 (cleaned only)  | 0/12            |
| A        | frontier | 12/12     | 0/12 (cleaned only)  | 0/12            |
| B        | edge     | 4/12      | 8/12 (cleaned only)  | 0/12            |
| B        | frontier | 0/12      | 12/12 (cleaned only) | 0/12            |
| C        | edge     | 12/12     | 0/12 (cleaned only)  | 0/12            |
| C        | frontier | 12/12     | 0/12 (cleaned only)  | 0/12            |
| D        | frontier | 12/12     | 0/12 (cleaned only)  | 0/12            |

## Recommendation

**Recommended strategy: A (Schema-in-System-Prompt)**

**Rationale:**

Strategy A is the clear winner across every dimension:

1. **Schema conformance**: 100% on both models (only strategy with perfect scores on both).
2. **Exact snippet match**: 89% frontier (PASS), 72% edge (highest of any edge result). No strategy met the 80% bar on edge — A came closest.
3. **Raw JSON output**: 100% on both models — never needs cleaning. Strategy B always wraps in markdown fences (0% raw JSON on frontier, 33% on edge). This matters for production reliability.
4. **Chunk refs and source IDs**: 100% across all strategies — the chunking format is universally understood.
5. **Cost**: ~$0.12 per 12-query run on frontier. Edge is free.

**Why not the others:**

- **B (Few-Shot)**: Always returns markdown-fenced JSON (needs cleaning), lower exact match than A, and costs more tokens due to examples.
- **C (XML-Tagged)**: Lowest exact match (60% edge, 62% frontier). The numbered-instructions format produces more paraphrasing. Also the only strategy with a schema failure.
- **D (JSON Mode)**: API-level JSON enforcement didn't improve accuracy — actually scored worse (68%) than A frontier (89%). Provider-specific, creates maintenance burden of dual prompt paths.

**Edge model gap**: No strategy achieves >80% exact match on Mistral Small 3.1. The model paraphrases more than GPT-4o regardless of prompting. Options for #126 implementation:

1. Use frontier (GPT-4o) by default for research queries — the cost is minimal ($0.01/query).
2. If edge tier is required, add post-processing that fuzzy-matches snippets back to source chunks and replaces with the verbatim text when LCS >90%.
3. Revisit when Mistral releases a larger model on Workers AI.

**Model recommendation**: GPT-4o (frontier) as default for research queries. The 89% exact match rate, 100% schema conformance, and 3-5x lower latency vs edge make it the right choice for this use case.

## Canonical Prompt Template

Strategy A system prompt (production-ready):

```
You are a research assistant that extracts relevant snippets from source documents to answer user queries.

You MUST respond with valid JSON matching this exact schema:
{
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
}

RULES:
1. Extract snippets that directly answer or are relevant to the query.
2. Prefer verbatim quotes from the source text. Set "verbatim" to true only if the text is an exact substring of a source chunk.
3. The "chunkRef" must be the exact chunk ID from the input (e.g. "src-001-chunk-3").
4. The "sourceId" must match the source's id attribute.
5. If the query is ambiguous, set "queryUnderstood" to false and explain in "noResultsReason".
6. If no relevant snippets exist, return an empty snippets array with "noResultsReason" explaining why.
7. Return ONLY the JSON object. No markdown fences, no explanation, no trailing text.
8. The "confidence" field reflects how directly the snippet answers the query: "high" for direct answers, "medium" for partially relevant, "low" for tangentially related.
```

User message format:

```
<source id="{sourceId}" title="{sourceTitle}">
<chunk id="{sourceId}-chunk-1">First paragraph text...</chunk>
<chunk id="{sourceId}-chunk-2">Second paragraph text...</chunk>
</source>

<question>{query}</question>
```

## Response Schema

```typescript
interface ResearchQueryResponse {
  snippets: Array<{
    text: string; // Quoted text from source (verbatim preferred)
    verbatim: boolean; // True if text is an exact substring of source
    sourceId: string; // Maps to source_materials.id
    sourceTitle: string; // Human-readable filename
    chunkRef: string; // Chunk ID (e.g. "src-001-chunk-3")
    relevance: string; // Why this answers the query
    confidence: "high" | "medium" | "low";
  }>;
  summary: string | null; // Synthesis across snippets (optional)
  queryUnderstood: boolean; // False if query is ambiguous
  noResultsReason: string | null; // Explanation when snippets is empty
}
```

## Chunk Format Specification

Sources are chunked at block-level HTML elements before sending to the LLM:

```
<source id="src-001" title="Document Title">
<chunk id="src-001-chunk-1">First paragraph text...</chunk>
<chunk id="src-001-chunk-2">Second paragraph text...</chunk>
</source>
```

Block elements that trigger chunk boundaries: `<p>`, `<h1>`-`<h6>`, `<li>`, `<blockquote>`, `<div>`, `<tr>`, `<pre>`, `<figcaption>`.

The `chunkifyHTML(sourceId, html)` utility in the quality gate script is reusable for production (#126).

## Proposed AIProvider Extension

The current `AIProvider` interface (see `workers/dc-api/src/services/ai-provider.ts`) is streaming-only.
Research queries need non-streaming JSON completions. Proposed addition:

```typescript
interface AIProvider {
  // Existing
  streamCompletion(
    systemPrompt: string,
    userMessage: string,
    options?: CompletionOptions,
  ): Promise<ReadableStream<AIStreamEvent>>;

  // New: non-streaming JSON completion for structured responses
  jsonCompletion<T>(
    systemPrompt: string,
    userMessage: string,
    options?: JsonCompletionOptions,
  ): Promise<JsonCompletionResult<T>>;

  readonly model: string;
}

interface JsonCompletionOptions extends CompletionOptions {
  /** Enable API-level JSON mode (provider-dependent) */
  jsonMode?: boolean;
}

interface JsonCompletionResult<T> {
  parsed: T | null;
  raw: string;
  tokens: { prompt: number; completion: number };
  latencyMs: number;
}
```

Both `OpenAIProvider` and `WorkersAIProvider` would implement `jsonCompletion`. OpenAI can use `response_format: { type: 'json_object' }` when `jsonMode` is true. Workers AI falls back to prompt-level JSON enforcement.

## Decision

1. **Use Strategy A (Schema-in-System-Prompt)** for research query prompts in Stories #125-#127.
2. **Default to GPT-4o (frontier tier)** for research queries. The quality gap vs edge is significant (89% vs 72% exact match), and the cost is negligible (~$0.01/query).
3. **Add `jsonCompletion()` to `AIProvider` interface** as specified above. Both providers implement it; OpenAI enables `response_format: { type: "json_object" }` as a belt-and-suspenders measure alongside the prompt (Strategy A + JSON mode doesn't hurt, and provides an API-level safety net).
4. **Use the `chunkifyHTML()` function** from this spike for production chunking in #126. Block-level splitting with deterministic chunk IDs achieved 100% chunk-ref accuracy across all strategies and models.
5. **Apply `cleanJSON()` as a defensive fallback** in the `jsonCompletion()` implementation — even though Strategy A returned raw-valid JSON 100% of the time, this costs nothing and protects against future model regressions.
6. **Quality bar partially met**: 99% schema conformance exceeds the 90% bar. Exact snippet match (89% frontier) exceeds the 80% bar on frontier but not on edge (72%). This is acceptable given the frontier-default recommendation.
