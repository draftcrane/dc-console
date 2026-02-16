import { ulid } from "ulid";

/**
 * AIRewriteService - Handles AI rewrite requests via Anthropic Claude
 *
 * Per PRD Section 8 (AI: US-017):
 * - Sends selected text + instruction + 500 chars surrounding context + chapter title + project description
 * - Streams response via SSE
 * - Logs interaction metadata to D1 ai_interactions table (NO user content stored)
 * - Rate limit: 10 req/min/user
 *
 * Per PRD: No voice/style context in Phase 0
 */

export interface RewriteInput {
  /** The selected text to rewrite */
  selectedText: string;
  /** Freeform instruction or chip label */
  instruction: string;
  /** Up to 500 chars before the selection */
  contextBefore: string;
  /** Up to 500 chars after the selection */
  contextAfter: string;
  /** Chapter title for context */
  chapterTitle: string;
  /** Project description for context */
  projectDescription: string;
  /** Chapter ID for logging */
  chapterId: string;
}

export interface RewriteStreamResult {
  stream: ReadableStream<Uint8Array>;
  interactionId: string;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_SELECTED_TEXT_CHARS = 10000;
const MAX_CONTEXT_CHARS = 500;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

export class AIRewriteService {
  constructor(
    private readonly db: D1Database,
    private readonly cache: KVNamespace,
    private readonly anthropicApiKey: string,
  ) {}

  /**
   * Check rate limit for a user (10 req/min)
   * Uses KV for atomic counters with TTL
   */
  async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = `ratelimit:ai-rewrite:${userId}`;
    const current = await this.cache.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }

    // Increment counter with TTL
    await this.cache.put(key, String(count + 1), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
    });

    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - count - 1 };
  }

  /**
   * Validate rewrite input
   */
  validateInput(input: RewriteInput): string | null {
    if (!input.selectedText?.trim()) {
      return "Selected text is required";
    }

    if (input.selectedText.length > MAX_SELECTED_TEXT_CHARS) {
      return `Selected text must be at most ${MAX_SELECTED_TEXT_CHARS} characters`;
    }

    if (!input.instruction?.trim()) {
      return "Instruction is required";
    }

    if (input.instruction.length > 500) {
      return "Instruction must be at most 500 characters";
    }

    if (!input.chapterId?.trim()) {
      return "Chapter ID is required";
    }

    return null;
  }

  /**
   * Build the system prompt for the rewrite
   */
  private buildSystemPrompt(input: RewriteInput): string {
    const parts = [
      "You are a professional writing assistant helping an author rewrite selected text from their book.",
      "Rewrite ONLY the selected text according to the author's instruction.",
      "Maintain the original meaning and tone unless the instruction specifically asks to change it.",
      "Return ONLY the rewritten text with no preamble, explanation, or quotes.",
      "Match the original formatting style (paragraphs, line breaks).",
    ];

    if (input.projectDescription?.trim()) {
      parts.push(`\nBook description: ${input.projectDescription.trim()}`);
    }

    if (input.chapterTitle?.trim()) {
      parts.push(`Chapter: ${input.chapterTitle.trim()}`);
    }

    return parts.join("\n");
  }

  /**
   * Build the user message with context
   */
  private buildUserMessage(input: RewriteInput): string {
    const parts: string[] = [];

    const contextBefore = input.contextBefore?.slice(-MAX_CONTEXT_CHARS) || "";
    const contextAfter = input.contextAfter?.slice(0, MAX_CONTEXT_CHARS) || "";

    if (contextBefore) {
      parts.push(`[Text before selection]\n${contextBefore}\n`);
    }

    parts.push(`[Selected text to rewrite]\n${input.selectedText}\n`);

    if (contextAfter) {
      parts.push(`[Text after selection]\n${contextAfter}\n`);
    }

    parts.push(`[Instruction]\n${input.instruction}`);

    return parts.join("\n");
  }

  /**
   * Stream a rewrite response via Anthropic API
   * Returns an SSE-compatible ReadableStream
   */
  async streamRewrite(userId: string, input: RewriteInput): Promise<RewriteStreamResult> {
    const interactionId = ulid();
    const startTime = Date.now();

    // Record the interaction start (output_chars and latency_ms will be updated)
    await this.db
      .prepare(
        `INSERT INTO ai_interactions (id, user_id, chapter_id, action, instruction, input_chars, output_chars, model, latency_ms, attempt_number, created_at)
         VALUES (?, ?, ?, 'rewrite', ?, ?, 0, ?, 0, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
      )
      .bind(
        interactionId,
        userId,
        input.chapterId,
        input.instruction.slice(0, 200), // Truncate instruction for logging (not user content)
        input.selectedText.length,
        MODEL,
      )
      .run();

    // Call Anthropic API with streaming
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        stream: true,
        system: this.buildSystemPrompt(input),
        messages: [
          {
            role: "user",
            content: this.buildUserMessage(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      console.error("Anthropic API error:", response.status, errorBody);

      // Update interaction with error
      await this.db
        .prepare(`UPDATE ai_interactions SET latency_ms = ? WHERE id = ?`)
        .bind(Date.now() - startTime, interactionId)
        .run();

      throw new Error(`AI provider error: ${response.status}`);
    }

    const anthropicStream = response.body;
    if (!anthropicStream) {
      throw new Error("No response body from AI provider");
    }

    // Transform Anthropic SSE stream into our SSE format
    let outputChars = 0;
    const db = this.db;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done", interactionId })}\n\n`),
              );
              continue;
            }

            try {
              const event = JSON.parse(data);

              // Handle content_block_delta events (text tokens)
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                const token = event.delta.text;
                outputChars += token.length;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`),
                );
              }

              // Handle message_stop - final event
              if (event.type === "message_stop") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "done", interactionId })}\n\n`),
                );
              }

              // Handle errors from the API
              if (event.type === "error") {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "error", message: "AI processing error" })}\n\n`,
                  ),
                );
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      },

      async flush() {
        // Update the interaction record with final stats
        const latencyMs = Date.now() - startTime;
        try {
          await db
            .prepare(`UPDATE ai_interactions SET output_chars = ?, latency_ms = ? WHERE id = ?`)
            .bind(outputChars, latencyMs, interactionId)
            .run();
        } catch (err) {
          console.error("Failed to update ai_interaction record:", err);
        }
      },
    });

    const stream = anthropicStream.pipeThrough(transformStream);

    return { stream, interactionId };
  }
}
