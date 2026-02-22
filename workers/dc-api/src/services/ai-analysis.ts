import { ulid } from "ulidx";
import type { AIProvider, AIStreamEvent } from "./ai-provider.js";
import { DriveService } from "./drive.js";
import type { Env } from "../types/index.js";

export interface AnalysisInput {
  connectionId: string;
  fileId: string;
  instruction: string;
  tier: "edge" | "frontier";
}

export interface AnalysisStreamResult {
  stream: ReadableStream<Uint8Array>;
  interactionId: string;
}

export class AIAnalysisService {
  private readonly drive: DriveService;

  constructor(
    private readonly db: D1Database,
    private readonly provider: AIProvider,
    env: Env,
  ) {
    this.drive = new DriveService(env);
  }

  validateInput(input: AnalysisInput): string | null {
    if (!input.connectionId || !input.fileId) {
      return "connectionId and fileId are required.";
    }
    if (!input.instruction || input.instruction.length < 5) {
      return "Instruction must be at least 5 characters.";
    }
    if (input.instruction.length > 1000) {
      return "Instruction must be less than 1000 characters.";
    }
    return null;
  }

  async streamAnalysis(userId: string, input: AnalysisInput): Promise<AnalysisStreamResult> {
    const { connectionId, fileId, instruction, tier } = input;
    const interactionId = ulid();
    const startTime = Date.now();

    // 1. Get file content from Drive
    const tokens = await this.drive.tokenService.getValidTokensByConnection(connectionId);
    if (!tokens) {
      throw new Error("Drive connection not found or invalid");
    }
    const { content: fileContent } = await this.drive.getFileContent(tokens.accessToken, fileId);

    // 2. Record the interaction start
    await this.db
      .prepare(
        `INSERT INTO ai_interactions (id, user_id, chapter_id, action, instruction, input_chars, output_chars, model, latency_ms, attempt_number, parent_interaction_id, tier, created_at)
         VALUES (?, ?, NULL, 'analysis', ?, ?, 0, ?, 0, 1, NULL, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
      )
      .bind(
        interactionId,
        userId,
        instruction.slice(0, 1000),
        fileContent.length,
        this.provider.model,
        tier,
      )
      .run();

    // 3. Build prompts
    const systemPrompt = [
      "You are an expert research analyst helping an author analyze source material for their book.",
      "Follow the author's instruction carefully.",
      "Provide clear, well-structured analysis.",
      "Use markdown formatting for headings and lists when appropriate.",
      "Focus on actionable insights the author can use in their writing.",
    ].join("\n");

    const userMessage = `<instruction>\n${instruction}\n</instruction>\n\n<document>\n${fileContent}\n</document>\n\nAnalyze the document according to the instruction above.`;

    // 4. Get the normalized AI stream
    const aiStream = await this.provider.streamCompletion(systemPrompt, userMessage, {
      maxTokens: 4096,
    });

    // 5. Transform AIStreamEvents into SSE-formatted bytes for the client
    let outputChars = 0;
    const db = this.db;
    const encoder = new TextEncoder();

    const sseTransform = new TransformStream<AIStreamEvent, Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "start", interactionId, attemptNumber: 1, tier })}\n\n`,
          ),
        );
      },

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
