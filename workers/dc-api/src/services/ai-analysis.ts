/**
 * AI Analysis Service — Analyzes a source document with a user instruction.
 *
 * Uses raw streaming (same pattern as ai-rewrite.ts), NOT structured JSON
 * (unlike research-query.ts). The response is a free-form analysis, not
 * parsed snippets.
 *
 * Flow:
 * 1. Load source content from R2 (verify ownership)
 * 2. Chunk content using shared chunking service
 * 3. Build system prompt + user message (instruction + chunked source content)
 * 4. Stream via AIProvider.streamCompletion() → SSE events
 */

import type { AIProvider, AIStreamEvent } from "./ai-provider.js";
import { chunkHtml, htmlTypeFromMime, stripHtml, type Chunk } from "./chunking.js";
import { notFound, validationError } from "../middleware/error-handler.js";

// ── Types ──

export interface AnalysisInput {
  sourceId: string;
  instruction: string;
}

export interface AnalysisStreamResult {
  stream: ReadableStream<Uint8Array>;
}

// ── Constants ──

const MAX_INSTRUCTION_LENGTH = 2000;
/** Max total characters of source text to include in prompt */
const MAX_SOURCE_CHARS = 30000;

// ── Source Content Loading ──

interface LoadedSourceContent {
  html: string;
  title: string;
  mimeType: string;
}

/**
 * Load source content from R2 with ownership verification.
 * Reusable helper — could serve ai-analysis and future services.
 */
export async function loadSourceContent(
  db: D1Database,
  bucket: R2Bucket,
  userId: string,
  sourceId: string,
): Promise<LoadedSourceContent> {
  // Verify ownership and get metadata
  const row = await db
    .prepare(
      `SELECT sm.id, sm.title, sm.mime_type, sm.r2_key, sm.cached_at
       FROM source_materials sm
       JOIN projects p ON p.id = sm.project_id
       WHERE sm.id = ? AND p.user_id = ? AND sm.status = 'active'`,
    )
    .bind(sourceId, userId)
    .first<{
      id: string;
      title: string;
      mime_type: string;
      r2_key: string | null;
      cached_at: string | null;
    }>();

  if (!row) {
    notFound("Source not found");
  }

  if (!row.cached_at) {
    validationError("Source content has not been cached yet. Please view the source first.");
  }

  const r2Key = row.r2_key || `sources/${sourceId}/content.html`;
  const object = await bucket.get(r2Key);
  if (!object) {
    throw new Error("Source content not found in storage");
  }

  const html = await object.text();
  if (!html.trim()) {
    validationError("Source has no content to analyze");
  }

  return {
    html,
    title: row.title,
    mimeType: row.mime_type || "text/plain",
  };
}

// ── Prompt Building ──

const ANALYSIS_SYSTEM_PROMPT = `You are an analysis assistant for a nonfiction book author. Analyze the provided source material according to the author's instruction. Be specific, cite relevant passages, and organize your response with clear structure.

Rules:
- Focus on the source material provided. Do not introduce outside knowledge.
- Use markdown formatting for readability (headings, bullet points, bold for emphasis).
- When citing from the source, use direct quotes with context.
- Keep your response focused and actionable for a book author.`;

/**
 * Build the user message with source content chunks.
 */
export function buildAnalysisUserMessage(
  instruction: string,
  sourceTitle: string,
  chunks: Chunk[],
): string {
  const parts: string[] = [];

  parts.push(`## Source: "${sourceTitle}"\n`);

  // Concatenate chunk text up to max chars
  let totalChars = 0;
  for (const chunk of chunks) {
    const text = stripHtml(chunk.html);
    if (totalChars + text.length > MAX_SOURCE_CHARS) {
      // Include partial text to fill budget
      const remaining = MAX_SOURCE_CHARS - totalChars;
      if (remaining > 100) {
        parts.push(text.slice(0, remaining) + "...");
      }
      break;
    }
    if (chunk.headingChain.length > 0) {
      parts.push(`### ${chunk.headingChain.join(" > ")}\n`);
    }
    parts.push(text);
    parts.push("");
    totalChars += text.length;
  }

  parts.push(`\n## Instruction\n\n${instruction}`);

  return parts.join("\n");
}

// ── Service ──

export class AIAnalysisService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
    private readonly aiProvider: AIProvider,
  ) {}

  /**
   * Validate analysis input. Returns error message or null.
   */
  validateInput(input: AnalysisInput): string | null {
    if (!input.sourceId?.trim()) {
      return "sourceId is required";
    }
    if (!input.instruction?.trim()) {
      return "instruction is required";
    }
    if (input.instruction.length > MAX_INSTRUCTION_LENGTH) {
      return `instruction must be at most ${MAX_INSTRUCTION_LENGTH} characters`;
    }
    return null;
  }

  /**
   * Stream an analysis response via the AI provider.
   * Returns an SSE-compatible ReadableStream with normalized events.
   */
  async streamAnalysis(userId: string, input: AnalysisInput): Promise<AnalysisStreamResult> {
    // 1. Load and verify source content
    const source = await loadSourceContent(this.db, this.bucket, userId, input.sourceId);

    // 2. Chunk content
    const htmlType = htmlTypeFromMime(source.mimeType);
    const chunks = chunkHtml(input.sourceId, source.title, source.html, htmlType);

    if (chunks.length === 0) {
      validationError("Source has no analyzable content");
    }

    // 3. Build prompt
    const userMessage = buildAnalysisUserMessage(input.instruction, source.title, chunks);

    // 4. Stream via AIProvider
    const aiStream = await this.aiProvider.streamCompletion(ANALYSIS_SYSTEM_PROMPT, userMessage, {
      maxTokens: 4096,
    });

    // 5. Transform AIStreamEvents into SSE-formatted bytes
    const encoder = new TextEncoder();

    const sseTransform = new TransformStream<AIStreamEvent, Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`));
      },

      transform(event, controller) {
        switch (event.type) {
          case "token":
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text: event.text })}\n\n`),
            );
            break;
          case "done":
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            break;
          case "error":
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: event.message })}\n\n`,
              ),
            );
            break;
        }
      },
    });

    const stream = aiStream.pipeThrough(sseTransform);

    return { stream };
  }
}
