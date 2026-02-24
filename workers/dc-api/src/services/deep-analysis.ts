/**
 * Deep Analysis Service — Async map-reduce pipeline for large source corpora.
 *
 * When the total token estimate exceeds the inline budget, the analyze endpoint
 * creates a job in D1 and processes it asynchronously via `waitUntil()`.
 *
 * Flow:
 * 1. Estimate tokens from D1 word_count metadata (no R2 reads)
 * 2. If over threshold → create job, return jobId, process via waitUntil
 * 3. Partition sources into batches (~80K tokens each)
 * 4. Map: concurrent batch processing (max 3 at a time)
 * 5. Reduce: synthesize intermediate summaries into final result
 * 6. Store result in D1, frontend polls for completion
 */

import { ulid } from "ulidx";
import type { AIProvider } from "./ai-provider.js";
import { chunkHtml, htmlTypeFromMime, stripHtml } from "./chunking.js";
import type { Env } from "../types/index.js";

// ── Constants ──

const DEFAULT_TOKEN_THRESHOLD = 40_000;
const BATCH_TOKEN_BUDGET = 80_000;
const MAX_CONCURRENT_BATCHES = 3;
const BATCH_MAX_RETRIES = 3;

// ── Prompts ──

const MAP_SYSTEM_PROMPT = `You are an analysis assistant for a nonfiction book author. Analyze the provided source material according to the author's instruction. Produce a thorough intermediate summary capturing all key findings, relevant passages with citations, and structured insights. This summary will be synthesized with summaries from other document batches. Note which source each finding comes from.`;

const REDUCE_SYSTEM_PROMPT = `You are an analysis assistant for a nonfiction book author. Synthesize the following intermediate summaries into a single coherent analysis responding to the author's original instruction. Merge overlapping findings, maintain source attribution, organize by theme not by batch, and use markdown formatting.`;

// ── Types ──

export interface JobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalBatches: number;
  completedBatches: number;
  resultText: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SourceTokenInfo {
  id: string;
  wordCount: number;
}

interface JobRow {
  id: string;
  project_id: string;
  user_id: string;
  instruction: string;
  source_ids: string;
  status: string;
  total_batches: number;
  completed_batches: number;
  result_text: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  expires_at: string;
}

// ── Service ──

export class DeepAnalysisService {
  /**
   * Estimate total tokens from D1 metadata (no R2 reads).
   * Returns total estimated tokens and whether any source has unknown size.
   */
  static async estimateSourceTokens(
    db: D1Database,
    userId: string,
    projectId: string,
    sourceIds: string[],
  ): Promise<{ total: number; hasUnknown: boolean }> {
    const placeholders = sourceIds.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT sm.id, sm.word_count
         FROM source_materials sm
         JOIN projects p ON p.id = sm.project_id
         WHERE sm.id IN (${placeholders})
           AND p.id = ?
           AND p.user_id = ?
           AND sm.status = 'active'`,
      )
      .bind(...sourceIds, projectId, userId)
      .all<{ id: string; word_count: number }>();

    let total = 0;
    let hasUnknown = false;

    for (const row of rows.results) {
      if (row.word_count === 0) {
        hasUnknown = true;
      }
      // Estimate: 1 word ≈ 1.33 tokens
      total += Math.ceil(row.word_count * 1.33);
    }

    return { total, hasUnknown };
  }

  /**
   * Determine whether to use the async deep analysis path.
   */
  static shouldUseDeepAnalysis(
    totalTokens: number,
    hasUnknown: boolean,
    threshold: number,
  ): boolean {
    if (hasUnknown) return true;
    return totalTokens >= threshold;
  }

  /**
   * Get the configured threshold from env or use default.
   */
  static getThreshold(env: Env): number {
    const configured = parseInt(env.DEEP_ANALYSIS_TOKEN_THRESHOLD ?? "", 10);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TOKEN_THRESHOLD;
  }

  /**
   * Create a job record in D1. Returns the job ID.
   */
  static async createJob(
    db: D1Database,
    userId: string,
    projectId: string,
    sourceIds: string[],
    instruction: string,
  ): Promise<string> {
    const id = ulid();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO analysis_jobs (id, project_id, user_id, instruction, source_ids, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(id, projectId, userId, instruction, JSON.stringify(sourceIds), now, now)
      .run();

    return id;
  }

  /**
   * Process a job end-to-end (runs inside waitUntil).
   */
  static async processJob(env: Env, jobId: string): Promise<void> {
    const db = env.DB;
    const bucket = env.EXPORTS_BUCKET;

    try {
      // 1. Read job
      const job = await db
        .prepare(`SELECT * FROM analysis_jobs WHERE id = ?`)
        .bind(jobId)
        .first<JobRow>();

      if (!job) {
        console.error(`Deep analysis job ${jobId} not found`);
        return;
      }

      const sourceIds = JSON.parse(job.source_ids) as string[];
      const instruction = job.instruction;
      const userId = job.user_id;

      // 2. Load source metadata for batching
      const placeholders = sourceIds.map(() => "?").join(",");
      const sourceRows = await db
        .prepare(
          `SELECT id, word_count FROM source_materials WHERE id IN (${placeholders}) AND status = 'active'`,
        )
        .bind(...sourceIds)
        .all<{ id: string; word_count: number }>();

      const sourceInfos: SourceTokenInfo[] = sourceRows.results.map((r) => ({
        id: r.id,
        wordCount: r.word_count,
      }));

      // 3. Partition into batches
      const batches = DeepAnalysisService.partitionSources(sourceInfos);

      // 4. Update job status
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE analysis_jobs SET status = 'processing', total_batches = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(batches.length, now, jobId)
        .run();

      // 5. Create AI provider
      const defaultTier = (env.AI_DEFAULT_TIER as "edge" | "frontier") || "frontier";
      const { OpenAIProvider, WorkersAIProvider } = await import("./ai-provider.js");
      const provider: AIProvider =
        defaultTier === "edge"
          ? new WorkersAIProvider(env.AI)
          : new OpenAIProvider(env.AI_API_KEY, env.AI_MODEL);

      // 6. Process batches with concurrency limit
      const intermediates: string[] = [];
      let completedBatches = 0;

      // Process in groups of MAX_CONCURRENT_BATCHES
      for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
        const group = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
        const results = await Promise.all(
          group.map((batchSourceIds) =>
            DeepAnalysisService.processMapBatch(
              db,
              bucket,
              provider,
              userId,
              batchSourceIds,
              instruction,
            ),
          ),
        );
        intermediates.push(...results);
        completedBatches += group.length;

        // Update progress
        await db
          .prepare(`UPDATE analysis_jobs SET completed_batches = ?, updated_at = ? WHERE id = ?`)
          .bind(completedBatches, new Date().toISOString(), jobId)
          .run();
      }

      // 7. Reduce
      const finalResult = await DeepAnalysisService.processReduce(
        provider,
        intermediates,
        instruction,
      );

      // 8. Store result
      const completedAt = new Date().toISOString();
      await db
        .prepare(
          `UPDATE analysis_jobs
           SET status = 'completed', result_text = ?, completed_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(finalResult, completedAt, completedAt, jobId)
        .run();
    } catch (err) {
      console.error(`Deep analysis job ${jobId} failed:`, err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await db
        .prepare(
          `UPDATE analysis_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(errorMessage, new Date().toISOString(), jobId)
        .run();
    }
  }

  /**
   * Get job status. If jobId is provided, get that specific job.
   * Runs lazy cleanup of expired jobs before querying.
   */
  static async getJobStatus(
    db: D1Database,
    userId: string,
    projectId: string,
    jobId: string,
  ): Promise<JobStatus | null> {
    // Lazy cleanup
    await db.prepare(`DELETE FROM analysis_jobs WHERE expires_at < datetime('now')`).run();

    const row = await db
      .prepare(`SELECT * FROM analysis_jobs WHERE id = ? AND user_id = ? AND project_id = ?`)
      .bind(jobId, userId, projectId)
      .first<JobRow>();

    if (!row) return null;
    return rowToJobStatus(row);
  }

  /**
   * Get the most recent job for a project.
   */
  static async getLatestJob(
    db: D1Database,
    userId: string,
    projectId: string,
  ): Promise<JobStatus | null> {
    // Lazy cleanup
    await db.prepare(`DELETE FROM analysis_jobs WHERE expires_at < datetime('now')`).run();

    const row = await db
      .prepare(
        `SELECT * FROM analysis_jobs
         WHERE project_id = ? AND user_id = ? AND expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(projectId, userId)
      .first<JobRow>();

    if (!row) return null;
    return rowToJobStatus(row);
  }

  /**
   * Partition sources into batches that fit within the token budget.
   * Greedy bin-packing: fill each batch until adding another source would exceed budget.
   */
  static partitionSources(
    sources: SourceTokenInfo[],
    batchTokenBudget = BATCH_TOKEN_BUDGET,
  ): string[][] {
    if (sources.length === 0) return [];

    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentTokens = 0;

    for (const source of sources) {
      const tokens = Math.ceil(source.wordCount * 1.33);

      if (currentBatch.length > 0 && currentTokens + tokens > batchTokenBudget) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTokens = 0;
      }

      currentBatch.push(source.id);
      currentTokens += tokens;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Process a single map batch: load sources, build prompt, call LLM.
   * Retries up to BATCH_MAX_RETRIES times on failure.
   */
  private static async processMapBatch(
    db: D1Database,
    bucket: R2Bucket,
    provider: AIProvider,
    userId: string,
    batchSourceIds: string[],
    instruction: string,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < BATCH_MAX_RETRIES; attempt++) {
      try {
        // Load source contents for this batch
        const parts: string[] = [];

        for (const sourceId of batchSourceIds) {
          const content = await loadSourceContentDirect(db, bucket, sourceId);
          if (!content) continue;

          parts.push(`## Source: "${content.title}"\n`);

          const htmlType = htmlTypeFromMime(content.mimeType);
          const chunks = chunkHtml(sourceId, content.title, content.html, htmlType);
          for (const chunk of chunks) {
            const text = stripHtml(chunk.html);
            if (chunk.headingChain.length > 0) {
              parts.push(`### ${chunk.headingChain.join(" > ")}\n`);
            }
            parts.push(text);
            parts.push("");
          }
        }

        const userMessage = parts.join("\n") + `\n\n## Instruction\n\n${instruction}`;

        return await provider.completion(MAP_SYSTEM_PROMPT, userMessage, {
          maxTokens: 4096,
        });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `Map batch attempt ${attempt + 1}/${BATCH_MAX_RETRIES} failed:`,
          lastError.message,
        );
        // Brief delay before retry
        if (attempt < BATCH_MAX_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error("Map batch processing failed");
  }

  /**
   * Reduce: synthesize intermediate batch summaries into a final result.
   */
  private static async processReduce(
    provider: AIProvider,
    intermediates: string[],
    instruction: string,
  ): Promise<string> {
    const numberedSummaries = intermediates
      .map((text, i) => `### Batch ${i + 1} Summary\n\n${text}`)
      .join("\n\n---\n\n");

    const userMessage = `## Original Instruction\n\n${instruction}\n\n## Intermediate Summaries\n\n${numberedSummaries}`;

    return await provider.completion(REDUCE_SYSTEM_PROMPT, userMessage, {
      maxTokens: 8192,
    });
  }
}

// ── Helpers ──

/**
 * Load source content from R2 without ownership check.
 * Ownership was already verified at job creation time.
 */
async function loadSourceContentDirect(
  db: D1Database,
  bucket: R2Bucket,
  sourceId: string,
): Promise<{ html: string; title: string; mimeType: string } | null> {
  const row = await db
    .prepare(
      `SELECT id, title, mime_type, r2_key, cached_at
       FROM source_materials
       WHERE id = ? AND status = 'active'`,
    )
    .bind(sourceId)
    .first<{
      id: string;
      title: string;
      mime_type: string;
      r2_key: string | null;
      cached_at: string | null;
    }>();

  if (!row || !row.cached_at) return null;

  const r2Key = row.r2_key || `sources/${sourceId}/content.html`;
  const object = await bucket.get(r2Key);
  if (!object) return null;

  const html = await object.text();
  if (!html.trim()) return null;

  return {
    html,
    title: row.title,
    mimeType: row.mime_type || "text/plain",
  };
}

function rowToJobStatus(row: JobRow): JobStatus {
  return {
    jobId: row.id,
    status: row.status as JobStatus["status"],
    totalBatches: row.total_batches,
    completedBatches: row.completed_batches,
    resultText: row.result_text,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
