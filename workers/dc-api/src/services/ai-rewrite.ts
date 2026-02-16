import { ulid } from "ulid";
import type { AIProvider, AIStreamEvent } from "./ai-provider.js";

/**
 * AIRewriteService - Handles AI rewrite requests via provider-agnostic AIProvider
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
  /** Parent interaction ID for retry chains (links retries to original request) */
  parentInteractionId?: string;
}

export interface RewriteStreamResult {
  stream: ReadableStream<Uint8Array>;
  interactionId: string;
}

const MAX_SELECTED_TEXT_CHARS = 10000;
const MAX_CONTEXT_CHARS = 500;

export class AIRewriteService {
  constructor(
    private readonly db: D1Database,
    private readonly aiProvider: AIProvider,
  ) {}

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
   * Stream a rewrite response via the AI provider.
   * Returns an SSE-compatible ReadableStream with normalized events.
   */
  async streamRewrite(userId: string, input: RewriteInput): Promise<RewriteStreamResult> {
    const interactionId = ulid();
    const startTime = Date.now();

    // Compute attempt number: if this is a retry, count prior attempts in the chain
    let attemptNumber = 1;
    const parentId = input.parentInteractionId ?? null;
    if (parentId) {
      const row = await this.db
        .prepare(
          `SELECT COUNT(*) as count FROM ai_interactions
           WHERE (id = ? OR parent_interaction_id = ?) AND user_id = ?`,
        )
        .bind(parentId, parentId, userId)
        .first<{ count: number }>();
      attemptNumber = (row?.count ?? 0) + 1;
    }

    // Record the interaction start (output_chars and latency_ms will be updated)
    await this.db
      .prepare(
        `INSERT INTO ai_interactions (id, user_id, chapter_id, action, instruction, input_chars, output_chars, model, latency_ms, attempt_number, parent_interaction_id, created_at)
         VALUES (?, ?, ?, 'rewrite', ?, ?, 0, ?, 0, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
      )
      .bind(
        interactionId,
        userId,
        input.chapterId,
        input.instruction.slice(0, 500),
        input.selectedText.length,
        this.aiProvider.model,
        attemptNumber,
        parentId,
      )
      .run();

    // Get the normalized AI stream
    const aiStream = await this.aiProvider.streamCompletion(
      this.buildSystemPrompt(input),
      this.buildUserMessage(input),
      { maxTokens: 4096 },
    );

    // Transform AIStreamEvents into SSE-formatted bytes for the client
    let outputChars = 0;
    const db = this.db;
    const encoder = new TextEncoder();

    const sseTransform = new TransformStream<AIStreamEvent, Uint8Array>({
      transform(event, controller) {
        switch (event.type) {
          case "token":
            outputChars += event.text.length;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text: event.text })}\n\n`),
            );
            break;
          case "done":
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done", interactionId })}\n\n`),
            );
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

    const stream = aiStream.pipeThrough(sseTransform);

    return { stream, interactionId };
  }
}
