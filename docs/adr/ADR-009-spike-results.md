# ADR-009 Spike Results: Content Chunking and Retrieval Strategy

**Date:** 2026-02-20
**Issue:** [#136](https://github.com/venturecrane/dc-console/issues/136)

## Summary

| Metric             | Value                                              |
| ------------------ | -------------------------------------------------- |
| Fixture sets       | 5                                                  |
| Total sources      | 44                                                 |
| Total words        | 257,443                                            |
| Total chunks       | 885 (eval subset: 60)                              |
| Evaluation queries | 24                                                 |
| Strategies tested  | FTS5 (full), Vectorize (partial — embeddings only) |

## Phase 1: Chunking Engine

All 132 checks pass across 5 fixture sets (41 structured + 3 flat sources).

| Criterion                 | Structured (DOCX/MD) | Flat (PDF) | Threshold   |
| ------------------------- | -------------------- | ---------- | ----------- |
| No mid-sentence splits    | ALL PASS             | ALL PASS   | 100%        |
| Heading context preserved | 100%                 | 100%       | >90% / >50% |
| Max word count            | 364                  | 358        | ≤400        |
| Min word count            | 100                  | 124        | ≥50         |
| Avg word count            | ~330                 | ~260       | 200-400     |
| Chunks > 400 words        | 0                    | 0          | 0           |
| Chunks < 50 words         | 0                    | 0          | 0           |

### Word Count Distribution (All 885 Chunks)

| Range        | Count | Percentage |
| ------------ | ----- | ---------- |
| < 50 words   | 0     | 0%         |
| 50-200 words | 20    | 2.3%       |
| 200-300      | 92    | 10.4%      |
| 300-400      | 773   | 87.3%      |
| > 400 words  | 0     | 0%         |

### Flat HTML Heading Detection

Heuristic heading detection (ALL CAPS lines, short lines without periods) correctly identified section boundaries in all 3 PDF-sourced fixtures. Each flat-HTML chunk carries its detected heading or positional context (`Section N of M`).

## Phase 2: Strategy A — FTS5 Keyword Search

### FTS5 on Remote D1

| Operation         | Result | Latency |
| ----------------- | ------ | ------- |
| Table creation    | PASS   | 201ms   |
| Index 60 chunks   | PASS   | 623ms   |
| Index 150 chunks  | PASS   | 898ms   |
| Query (per query) | PASS\* | 72-83ms |
| Table teardown    | PASS   | —       |

\*Two queries failed with 500 errors due to FTS5 MATCH syntax issues with hyphens and apostrophes (e.g., "eight-step", "Cohen's kappa"). FTS5 `porter unicode61` tokenizer strips these, causing malformed MATCH expressions. This is fixable with query sanitization.

### FTS5 Retrieval Quality (24 Queries)

| Query Type   | Count | P@1  | P@3  | P@5  | MRR  | Latency p50 | Latency p95 |
| ------------ | ----- | ---- | ---- | ---- | ---- | ----------- | ----------- |
| Keyword      | 6     | 0.33 | 0.44 | 0.47 | 0.45 | 75ms        | 78ms        |
| Paraphrase   | 6     | 0.00 | 0.00 | 0.00 | 0.00 | 73ms        | 75ms        |
| Multi-source | 6     | 0.33 | 0.33 | 0.33 | 0.33 | 74ms        | 77ms        |
| Negative     | 6     | 1.00 | 1.00 | 1.00 | —    | 77ms        | 83ms        |
| **Overall**  | 24    | 0.42 | 0.44 | 0.45 | 0.20 | 74ms        | 79ms        |

#### Key Observations

1. **Keyword queries**: P@3 = 0.44. Two queries errored (FTS5 syntax), two worked perfectly (kw-5, kw-6 at P@3=1.0). With query sanitization, effective P@3 would be ~0.67.
2. **Paraphrase queries**: P@3 = 0.00. Complete failure — FTS5 cannot handle conceptual queries where the user's words differ from the source text. This is the critical limitation.
3. **Multi-source queries**: P@3 = 0.33. FTS5 finds matches when query terms appear verbatim but misses conceptual connections.
4. **Negative queries**: 100% rejection. FTS5 returns no results for out-of-domain queries — perfect.
5. **Latency**: Excellent at 72-83ms per query on remote D1.

### Indexing Performance

| Corpus           | Words | Chunks | Index Time | Per Source |
| ---------------- | ----- | ------ | ---------- | ---------- |
| Eval set (9 src) | ~15K  | 60     | 623ms      | 69ms       |
| Medium (10 src)  | ~41K  | 150    | 898ms      | 90ms       |
| Large (25 src)\* | ~202K | 675    | ~2.5s est  | ~100ms     |

\*Large corpus indexing estimated from medium corpus linear extrapolation.

## Phase 3: Strategy B — Embeddings + Vectorize

### Workers AI Embedding Throughput

Model: `@cf/baai/bge-small-en-v1.5` (384 dimensions)

| Batch Size | Total Latency | Per Text | Notes                  |
| ---------- | ------------- | -------- | ---------------------- |
| 1          | 175ms         | 175ms    | Cold start overhead    |
| 5          | 128ms         | 26ms     |                        |
| 10         | 155ms         | 16ms     |                        |
| 25         | 197ms         | 8ms      | **Optimal throughput** |
| 50         | 608ms         | 12ms     | Throughput degrades    |

**Optimal batch size: 25 texts per call** at 8ms per embedding.

### Embedding Generation

| Metric          | Value   |
| --------------- | ------- |
| Chunks embedded | 60      |
| Total time      | 2,641ms |
| Round-trip time | 2,845ms |
| Dimensions      | 384     |
| Dimension check | PASS    |

At batch-25 optimal throughput:

- 5K word source (~7 chunks): ~200ms embedding time
- 50K word corpus (~150 chunks): ~1.2s embedding time
- 200K word corpus (~675 chunks): ~5.4s embedding time

### Vectorize

**Not tested.** The automation API token (`CLOUDFLARE_API_TOKEN`) lacks Vectorize scope. The `wrangler vectorize create` command fails with authentication error. The worker code for Vectorize upsert and query is complete and ready; provisioning requires an API token update or interactive `wrangler login`.

## Phase 4: Hybrid Routing Analysis

Based on FTS5 query-by-query analysis, here's how FTS5-first + semantic fallback would route:

| Query Type       | FTS5 Returns Results | FTS5 High Confidence | Would Fall Back |
| ---------------- | -------------------- | -------------------- | --------------- |
| Keyword (6)      | 4/6 (2 errors)       | 2/4                  | 2-4/6           |
| Paraphrase (6)   | 0/6                  | 0/0                  | 6/6             |
| Multi-source (6) | 2/6                  | 2/2                  | 4/6             |
| Negative (6)     | 0/6                  | 0/0                  | 6/6             |

**Predicted hybrid routing**: 12-16 of 24 queries would fall back to Vectorize. Without Vectorize data, we cannot measure the actual hybrid precision improvement. However, the routing signal is clear: any query that returns zero FTS5 results should fall back to semantic search.

## Phase 5: Context Assembly

The context assembler (implemented in spike worker) performs:

1. **Deduplication** by chunk ID
2. **Source ordering** — chunks sorted by source, then by original document position
3. **Attribution formatting**: `[Source: "Title", Section: "Heading"]`
4. **Token budget enforcement** — 8K token budget (~6K words) with graceful truncation

No performance issues observed.

## Pass/Fail Summary

| Criterion                              | Result   | Value    | Threshold  |
| -------------------------------------- | -------- | -------- | ---------- |
| Chunking: no mid-sentence splits       | **PASS** | 100%     | 100%       |
| Chunking: heading context (structured) | **PASS** | 100%     | >90%       |
| Chunking: heading context (flat/PDF)   | **PASS** | 100%     | >50%       |
| Chunking: zero over-400-word chunks    | **PASS** | 0        | 0          |
| FTS5 keyword P@3 (structured)          | **FAIL** | 44%      | >80%       |
| FTS5 keyword P@3 (flat/PDF)            | N/A\*    | —        | >70%       |
| Semantic retrieval P@3                 | N/A†     | —        | >60%       |
| Negative query rejection               | **PASS** | 100%     | >80%       |
| FTS5 on remote D1                      | **PASS** | Works    | Pass       |
| Single-source index time (5K words)    | **PASS** | ~69ms    | <3s        |
| Full corpus index time (50K words)     | **PASS** | 898ms    | <30s       |
| Query latency                          | **PASS** | 74ms     | <500ms     |
| Workers AI embedding dims = 384        | **PASS** | 384      | 384        |
| Embedding batch throughput             | **PASS** | 8ms/text | Documented |

\*FTS5 keyword P@3 on flat/PDF not separately measurable with current query set.
†Vectorize not provisioned — API token lacks scope.
