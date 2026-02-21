
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';
import type { AIProvider } from './ai-provider';
import { DriveService } from './drive';
import { AIInteractionService } from './ai-interaction';

export interface AnalysisInput {
  connectionId: string;
  fileId: string;
  instruction: string;
  tier: 'edge' | 'frontier';
}

export class AIAnalysisService {
  private readonly interactions: AIInteractionService;
  private readonly drive: DriveService;

  constructor(
    private readonly db: D1Database,
    private readonly provider: AIProvider,
    env: Env,
  ) {
    this.interactions = new AIInteractionService(db);
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

  async streamAnalysis(userId: string, input: AnalysisInput) {
    const { connectionId, fileId, instruction, tier } = input;

    // 1. Get file content from Drive
    const tokens = await this.drive.tokenService.getValidTokensByConnection(connectionId);
    if (!tokens) {
      throw new Error("Drive connection not found or invalid");
    }
    const { content: fileContent } = await this.drive.getFileContent(tokens.accessToken, fileId);

    // 2. Construct the prompt
    const prompt = `INSTRUCTION: ${instruction}

DOCUMENT:
${fileContent}`;

    // 3. Log the start of the interaction
    const { id: interactionId, attemptNumber } = await this.interactions.logInteractionStart({
      userId,
      // For now, we don't have a chapterId, so this can be null or a placeholder
      chapterId: null, 
      action: "analysis",
      instruction,
      inputChars: fileContent.length,
      model: this.provider.modelName,
      tier,
    });
    
    // 4. Get the AI stream
    const stream = await this.provider.getStreamingResponse(prompt, {
      onStart: () => {
        // stream starts...
      },
      onToken: (text) => {
        // handle tokens...
      },
      onComplete: (fullResponse) => {
        this.interactions.logInteractionComplete(interactionId, {
          outputChars: fullResponse.length,
          latencyMs: 0, // latency is tricky to calculate here, skip for now
        });
      },
      onError: (error) => {
        this.interactions.logInteractionError(interactionId, error.message);
      },
      interactionId,
      attemptNumber,
    });

    return { stream, interactionId };
  }
}
