/**
 * Chunking spike worker — temporary test worker for evaluating
 * FTS5 keyword search (Strategy A) and Vectorize semantic search (Strategy B).
 *
 * This worker is deleted before PR merge.
 */

import { Hono } from "hono";

interface Env {
  DB: D1Database;
  AI: Ai;
  VECTORIZE?: VectorizeIndex;
}

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Workers AI embedding response shape (resolve the union type) */
interface EmbeddingResponse {
  shape?: number[];
  data?: number[][];
}

interface ChunkInput {
  id: string;
  sourceId: string;
  sourceTitle: string;
  headingChain: string[];
  text: string;
  wordCount: number;
}

interface SearchResult {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  headingChain: string[];
  text: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (c) => {
  return c.json({ status: "ok", worker: "dc-chunking-spike" });
});

// ---------------------------------------------------------------------------
// Strategy A: FTS5 — Create tables, index, and query
// ---------------------------------------------------------------------------

/** Create FTS5 virtual table + backing metadata table */
app.post("/fts5/setup", async (c) => {
  const db = c.env.DB;
  const startTime = Date.now();

  // Metadata table for chunk data
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS spike_chunks (chunk_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, source_title TEXT NOT NULL, heading_chain TEXT NOT NULL, text_content TEXT NOT NULL, word_count INTEGER NOT NULL)`,
  ).run();

  // FTS5 virtual table for full-text search
  await db.prepare(
    `CREATE VIRTUAL TABLE IF NOT EXISTS spike_chunks_fts USING fts5(chunk_id, source_id, source_title, heading_chain, content, tokenize='porter unicode61')`,
  ).run();

  const elapsed = Date.now() - startTime;
  return c.json({ status: "ok", elapsed_ms: elapsed });
});

/** Index chunks into FTS5 */
app.post("/fts5/index", async (c) => {
  const chunks: ChunkInput[] = await c.req.json();
  const db = c.env.DB;
  const startTime = Date.now();

  // Insert in batches (D1 batch limit)
  const batchSize = 50;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const stmts = batch.flatMap((chunk) => [
      db
        .prepare(
          `INSERT OR REPLACE INTO spike_chunks (chunk_id, source_id, source_title, heading_chain, text_content, word_count) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          chunk.id,
          chunk.sourceId,
          chunk.sourceTitle,
          JSON.stringify(chunk.headingChain),
          chunk.text,
          chunk.wordCount,
        ),
      db
        .prepare(
          `INSERT OR REPLACE INTO spike_chunks_fts (chunk_id, source_id, source_title, heading_chain, content) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          chunk.id,
          chunk.sourceId,
          chunk.sourceTitle,
          chunk.headingChain.join(" > "),
          chunk.text,
        ),
    ]);

    await db.batch(stmts);
  }

  const elapsed = Date.now() - startTime;
  return c.json({
    status: "ok",
    chunks_indexed: chunks.length,
    elapsed_ms: elapsed,
  });
});

/** Query FTS5 with BM25 ranking */
app.post("/fts5/query", async (c) => {
  const { query, limit = 5 } = await c.req.json<{ query: string; limit?: number }>();
  const db = c.env.DB;
  const startTime = Date.now();

  // FTS5 MATCH query with BM25 ranking
  // bm25() returns negative values (lower = better match)
  const results = await db
    .prepare(
      `SELECT
        f.chunk_id,
        f.source_id,
        f.source_title,
        f.heading_chain,
        f.content,
        bm25(spike_chunks_fts) as score
      FROM spike_chunks_fts f
      WHERE spike_chunks_fts MATCH ?
      ORDER BY bm25(spike_chunks_fts) ASC
      LIMIT ?`,
    )
    .bind(query, limit)
    .all<{
      chunk_id: string;
      source_id: string;
      source_title: string;
      heading_chain: string;
      content: string;
      score: number;
    }>();

  const elapsed = Date.now() - startTime;

  const searchResults: SearchResult[] = (results.results ?? []).map((r) => ({
    chunkId: r.chunk_id,
    sourceId: r.source_id,
    sourceTitle: r.source_title,
    headingChain: r.heading_chain.split(" > ").filter(Boolean),
    text: r.content,
    score: Math.abs(r.score), // Normalize to positive (higher = better)
  }));

  return c.json({
    query,
    results: searchResults,
    count: searchResults.length,
    elapsed_ms: elapsed,
  });
});

/** Tear down FTS5 tables */
app.post("/fts5/teardown", async (c) => {
  const db = c.env.DB;
  await db.prepare(`DROP TABLE IF EXISTS spike_chunks_fts`).run();
  await db.prepare(`DROP TABLE IF EXISTS spike_chunks`).run();
  return c.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Strategy B: Vectorize + Workers AI Embeddings
// ---------------------------------------------------------------------------

/** Benchmark Workers AI embedding throughput */
app.post("/embeddings/benchmark", async (c) => {
  const ai = c.env.AI;
  const { texts } = await c.req.json<{ texts: string[] }>();

  const results: { batchSize: number; elapsed_ms: number; perText_ms: number }[] = [];

  // Test different batch sizes
  const batchSizes = [1, 5, 10, 25, 50];

  for (const batchSize of batchSizes) {
    if (batchSize > texts.length) continue;

    const batch = texts.slice(0, batchSize);
    const startTime = Date.now();

    const response = (await ai.run("@cf/baai/bge-small-en-v1.5", {
      text: batch,
    })) as EmbeddingResponse;

    const elapsed = Date.now() - startTime;
    results.push({
      batchSize,
      elapsed_ms: elapsed,
      perText_ms: Math.round(elapsed / batchSize),
    });

    // Check embedding dimensions
    if (response.data && response.data.length > 0) {
      const dims = response.data[0].length;
      if (dims !== 384) {
        return c.json(
          {
            error: `Unexpected embedding dimensions: ${dims} (expected 384)`,
          },
          500,
        );
      }
    }
  }

  return c.json({ results });
});

/** Generate embeddings for chunks */
app.post("/embeddings/generate", async (c) => {
  const ai = c.env.AI;
  const { chunks } = await c.req.json<{ chunks: ChunkInput[] }>();
  const startTime = Date.now();

  // Batch into groups of 25 (Workers AI limit is generous but we'll be conservative)
  const batchSize = 25;
  const embeddings: { chunkId: string; values: number[] }[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => {
      // Prepend heading chain for better semantic context
      const prefix = c.headingChain.length > 0 ? c.headingChain.join(" > ") + ": " : "";
      return prefix + c.text;
    });

    const response = (await ai.run("@cf/baai/bge-small-en-v1.5", {
      text: texts,
    })) as EmbeddingResponse;

    if (response.data) {
      for (let j = 0; j < batch.length; j++) {
        embeddings.push({
          chunkId: batch[j].id,
          values: response.data[j],
        });
      }
    }
  }

  const elapsed = Date.now() - startTime;
  return c.json({
    status: "ok",
    chunks_embedded: embeddings.length,
    elapsed_ms: elapsed,
    embeddings,
  });
});

/** Upsert vectors into Vectorize */
app.post("/vectorize/upsert", async (c) => {
  const vectorize = c.env.VECTORIZE;
  if (!vectorize) {
    return c.json({ error: "Vectorize binding not configured" }, 400);
  }

  const {
    vectors,
  } = await c.req.json<{
    vectors: { id: string; values: number[]; metadata: Record<string, string> }[];
  }>();
  const startTime = Date.now();

  // Upsert in batches of 100 (Vectorize limit)
  const batchSize = 100;
  let totalUpserted = 0;

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await vectorize.upsert(
      batch.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata,
      })),
    );
    totalUpserted += batch.length;
  }

  const elapsed = Date.now() - startTime;
  return c.json({
    status: "ok",
    vectors_upserted: totalUpserted,
    elapsed_ms: elapsed,
  });
});

/** Query Vectorize for similar chunks */
app.post("/vectorize/query", async (c) => {
  const ai = c.env.AI;
  const vectorize = c.env.VECTORIZE;
  if (!vectorize) {
    return c.json({ error: "Vectorize binding not configured" }, 400);
  }

  const { query, limit = 5 } = await c.req.json<{ query: string; limit?: number }>();
  const startTime = Date.now();

  // Embed the query
  const embedStart = Date.now();
  const queryEmbedding = (await ai.run("@cf/baai/bge-small-en-v1.5", {
    text: [query],
  })) as EmbeddingResponse;
  const embedElapsed = Date.now() - embedStart;

  if (!queryEmbedding.data || queryEmbedding.data.length === 0) {
    return c.json({ error: "Failed to embed query" }, 500);
  }

  // Search Vectorize
  const searchStart = Date.now();
  const matches = await vectorize.query(queryEmbedding.data[0], {
    topK: limit,
    returnMetadata: "all",
    returnValues: false,
  });
  const searchElapsed = Date.now() - searchStart;

  const searchResults: SearchResult[] = matches.matches.map((m) => ({
    chunkId: m.id,
    sourceId: (m.metadata?.sourceId as string) || "",
    sourceTitle: (m.metadata?.sourceTitle as string) || "",
    headingChain: ((m.metadata?.headingChain as string) || "").split(" > ").filter(Boolean),
    text: (m.metadata?.text as string) || "",
    score: m.score,
  }));

  const totalElapsed = Date.now() - startTime;

  return c.json({
    query,
    results: searchResults,
    count: searchResults.length,
    elapsed_ms: totalElapsed,
    embed_ms: embedElapsed,
    search_ms: searchElapsed,
  });
});

// ---------------------------------------------------------------------------
// Strategy C: Hybrid (FTS5-first + semantic fallback)
// ---------------------------------------------------------------------------

/** Hybrid query: FTS5 first, fall back to Vectorize if BM25 scores are weak */
app.post("/hybrid/query", async (c) => {
  const ai = c.env.AI;
  const db = c.env.DB;
  const vectorize = c.env.VECTORIZE;
  const {
    query,
    limit = 5,
    bm25Threshold = 5.0,
  } = await c.req.json<{ query: string; limit?: number; bm25Threshold?: number }>();

  const startTime = Date.now();
  let strategy = "fts5";

  // Step 1: Try FTS5
  let fts5Results: SearchResult[] = [];
  let fts5Elapsed = 0;
  try {
    const fts5Start = Date.now();
    const results = await db
      .prepare(
        `SELECT
          f.chunk_id,
          f.source_id,
          f.source_title,
          f.heading_chain,
          f.content,
          bm25(spike_chunks_fts) as score
        FROM spike_chunks_fts f
        WHERE spike_chunks_fts MATCH ?
        ORDER BY bm25(spike_chunks_fts) ASC
        LIMIT ?`,
      )
      .bind(query, limit)
      .all<{
        chunk_id: string;
        source_id: string;
        source_title: string;
        heading_chain: string;
        content: string;
        score: number;
      }>();
    fts5Elapsed = Date.now() - fts5Start;

    fts5Results = (results.results ?? []).map((r) => ({
      chunkId: r.chunk_id,
      sourceId: r.source_id,
      sourceTitle: r.source_title,
      headingChain: r.heading_chain.split(" > ").filter(Boolean),
      text: r.content,
      score: Math.abs(r.score),
    }));
  } catch {
    // FTS5 MATCH can throw on certain query patterns; fall through to vectorize
  }

  // Step 2: Check if FTS5 results are strong enough
  const bestFts5Score = fts5Results.length > 0 ? fts5Results[0].score : 0;
  const needsFallback =
    fts5Results.length === 0 || bestFts5Score < bm25Threshold;

  let vectorizeResults: SearchResult[] = [];
  let vectorizeElapsed = 0;

  if (needsFallback && vectorize) {
    strategy = "vectorize";
    const vecStart = Date.now();

    const queryEmbedding = (await ai.run("@cf/baai/bge-small-en-v1.5", {
      text: [query],
    })) as EmbeddingResponse;

    if (queryEmbedding.data && queryEmbedding.data.length > 0) {
      const matches = await vectorize.query(
        queryEmbedding.data[0],
        {
          topK: limit,
          returnMetadata: "all",
          returnValues: false,
        },
      );

      vectorizeResults = matches.matches.map((m) => ({
        chunkId: m.id,
        sourceId: (m.metadata?.sourceId as string) || "",
        sourceTitle: (m.metadata?.sourceTitle as string) || "",
        headingChain: ((m.metadata?.headingChain as string) || "")
          .split(" > ")
          .filter(Boolean),
        text: (m.metadata?.text as string) || "",
        score: m.score,
      }));
    }
    vectorizeElapsed = Date.now() - vecStart;
  }

  const finalResults = needsFallback && vectorizeResults.length > 0
    ? vectorizeResults
    : fts5Results;

  const totalElapsed = Date.now() - startTime;

  return c.json({
    query,
    strategy,
    results: finalResults,
    count: finalResults.length,
    elapsed_ms: totalElapsed,
    fts5_elapsed_ms: fts5Elapsed,
    vectorize_elapsed_ms: vectorizeElapsed,
    fts5_best_score: bestFts5Score,
    fell_back: needsFallback && vectorize != null,
  });
});

// ---------------------------------------------------------------------------
// Context Assembly
// ---------------------------------------------------------------------------

app.post("/context/assemble", async (c) => {
  const {
    chunks,
    tokenBudget = 8000,
  } = await c.req.json<{ chunks: SearchResult[]; tokenBudget?: number }>();

  // Approximate: 1 token ≈ 0.75 words (conservative for English text)
  const wordBudget = Math.floor(tokenBudget * 0.75);

  // Deduplicate overlapping chunks (same source, adjacent positions)
  const seen = new Set<string>();
  const deduped = chunks.filter((c) => {
    if (seen.has(c.chunkId)) return false;
    seen.add(c.chunkId);
    return true;
  });

  // Sort by source, then by chunk index for reading order
  deduped.sort((a, b) => {
    if (a.sourceId !== b.sourceId) return a.sourceId.localeCompare(b.sourceId);
    const aIdx = parseInt(a.chunkId.split(":")[1] || "0");
    const bIdx = parseInt(b.chunkId.split(":")[1] || "0");
    return aIdx - bIdx;
  });

  // Assemble context within budget
  const contextParts: string[] = [];
  let totalWords = 0;

  for (const chunk of deduped) {
    const chunkWords = chunk.text.split(/\s+/).filter(Boolean).length;
    if (totalWords + chunkWords > wordBudget) break;

    const heading = chunk.headingChain.length > 0
      ? chunk.headingChain.join(" > ")
      : "General";

    contextParts.push(
      `[Source: "${chunk.sourceTitle}", Section: "${heading}"]\n${chunk.text}`,
    );
    totalWords += chunkWords;
  }

  const assembledContext = contextParts.join("\n\n---\n\n");

  return c.json({
    context: assembledContext,
    chunks_included: contextParts.length,
    chunks_total: deduped.length,
    estimated_words: totalWords,
    estimated_tokens: Math.ceil(totalWords / 0.75),
    within_budget: totalWords <= wordBudget,
  });
});

export default app;
