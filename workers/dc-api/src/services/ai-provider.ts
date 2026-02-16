/**
 * Provider-agnostic AI interface.
 *
 * Phase 0 ships with OpenAI because the target user lives in the ChatGPT ecosystem.
 * The UI says "AI" everywhere - no provider name is exposed to users.
 * Post-validation: user-selectable AI provider.
 *
 * See ADR-003-ai-provider.md for the full decision record.
 */

/** A single event from an AI completion stream */
export type AIStreamEvent =
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Options for a streaming completion request */
export interface CompletionOptions {
  maxTokens?: number;
}

/** Provider-agnostic AI interface */
export interface AIProvider {
  /** Stream a completion, yielding normalized events */
  streamCompletion(
    systemPrompt: string,
    userMessage: string,
    options?: CompletionOptions,
  ): Promise<ReadableStream<AIStreamEvent>>;

  /** The model identifier used by this provider */
  readonly model: string;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o";

/**
 * OpenAI implementation of AIProvider.
 *
 * Streams chat completions from the OpenAI API and normalizes the SSE events
 * into a provider-agnostic format. Uses proper event-boundary buffering to
 * handle chunk boundaries that split across SSE events.
 */
export class OpenAIProvider implements AIProvider {
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model?: string,
  ) {
    this.model = model || DEFAULT_MODEL;
  }

  async streamCompletion(
    systemPrompt: string,
    userMessage: string,
    options?: CompletionOptions,
  ): Promise<ReadableStream<AIStreamEvent>> {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      console.error("OpenAI API error:", response.status, errorBody);
      throw new Error(`AI provider error: ${response.status}`);
    }

    const body = response.body;
    if (!body) {
      throw new Error("No response body from AI provider");
    }

    return body.pipeThrough(createSSETransform());
  }
}

/**
 * Creates a TransformStream that converts raw SSE bytes into normalized AIStreamEvents.
 *
 * Fixes the chunk-boundary bug in the original code: SSE data can be split across
 * TCP chunks at arbitrary byte offsets. The original code split on \n per chunk,
 * which dropped tokens when a JSON payload spanned chunk boundaries.
 *
 * This implementation buffers incoming text and only processes complete SSE events
 * (delimited by \n\n).
 */
function createSSETransform(): TransformStream<Uint8Array, AIStreamEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new TransformStream<Uint8Array, AIStreamEvent>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      // Process all complete events (delimited by \n\n)
      const parts = buffer.split("\n\n");
      // Last element may be incomplete - keep it in the buffer
      buffer = parts.pop() || "";

      for (const eventBlock of parts) {
        processSSEBlock(eventBlock, controller);
      }
    },

    flush(controller) {
      // Process any remaining buffered data
      if (buffer.trim()) {
        processSSEBlock(buffer, controller);
      }
    },
  });
}

/**
 * Parse a single SSE event block and enqueue normalized events.
 */
function processSSEBlock(
  eventBlock: string,
  controller: TransformStreamDefaultController<AIStreamEvent>,
): void {
  for (const line of eventBlock.split("\n")) {
    if (!line.startsWith("data: ")) continue;

    const data = line.slice(6).trim();
    if (data === "[DONE]") {
      controller.enqueue({ type: "done" });
      return;
    }

    try {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;

      if (delta?.content) {
        controller.enqueue({ type: "token", text: delta.content });
      }

      // OpenAI signals completion via finish_reason
      if (parsed.choices?.[0]?.finish_reason === "stop") {
        controller.enqueue({ type: "done" });
      }
    } catch {
      // Skip malformed JSON
    }
  }
}
