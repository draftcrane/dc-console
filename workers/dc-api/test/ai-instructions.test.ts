import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { AIInstructionsService } from "../src/services/ai-instructions.js";
import { seedUser, seedAIInstruction, cleanAll } from "./helpers/seed.js";

describe("AIInstructionsService", () => {
  let service: AIInstructionsService;
  let userId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new AIInstructionsService(env.DB);
    const user = await seedUser();
    userId = user.id;
  });

  describe("list", () => {
    it("returns empty array when no instructions exist", async () => {
      const result = await service.list(userId);
      expect(result).toEqual([]);
    });

    it("returns all instructions for a user", async () => {
      await seedAIInstruction(userId, { label: "Summarize", type: "analysis" });
      await seedAIInstruction(userId, { label: "Concise", type: "rewrite" });

      const result = await service.list(userId);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("Summarize");
      expect(result[1].label).toBe("Concise");
    });

    it("filters by type", async () => {
      await seedAIInstruction(userId, { label: "Summarize", type: "analysis" });
      await seedAIInstruction(userId, { label: "Concise", type: "rewrite" });

      const analysisOnly = await service.list(userId, "analysis");
      expect(analysisOnly).toHaveLength(1);
      expect(analysisOnly[0].label).toBe("Summarize");

      const rewriteOnly = await service.list(userId, "rewrite");
      expect(rewriteOnly).toHaveLength(1);
      expect(rewriteOnly[0].label).toBe("Concise");
    });

    it("ignores invalid type filter and returns all", async () => {
      await seedAIInstruction(userId, { label: "A", type: "analysis" });
      await seedAIInstruction(userId, { label: "B", type: "rewrite" });

      const result = await service.list(userId, "invalid");
      expect(result).toHaveLength(2);
    });

    it("enforces user isolation", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      await seedAIInstruction(userId, { label: "Mine" });
      await seedAIInstruction(otherUser.id, { label: "Theirs" });

      const myInstructions = await service.list(userId);
      expect(myInstructions).toHaveLength(1);
      expect(myInstructions[0].label).toBe("Mine");

      const theirInstructions = await service.list(otherUser.id);
      expect(theirInstructions).toHaveLength(1);
      expect(theirInstructions[0].label).toBe("Theirs");
    });
  });

  describe("create", () => {
    it("creates an instruction with valid input", async () => {
      const result = await service.create(userId, {
        label: "Summarize key points",
        instructionText: "Extract the key points from this document.",
        type: "analysis",
      });

      expect(result.id).toBeTruthy();
      expect(result.userId).toBe(userId);
      expect(result.label).toBe("Summarize key points");
      expect(result.instructionText).toBe("Extract the key points from this document.");
      expect(result.type).toBe("analysis");
      expect(result.createdAt).toBeTruthy();
    });

    it("trims label and instruction text", async () => {
      const result = await service.create(userId, {
        label: "  Trimmed Label  ",
        instructionText: "  Trimmed text  ",
        type: "rewrite",
      });

      expect(result.label).toBe("Trimmed Label");
      expect(result.instructionText).toBe("Trimmed text");
    });

    it("rejects empty label", async () => {
      await expect(
        service.create(userId, {
          label: "",
          instructionText: "Some text",
          type: "analysis",
        }),
      ).rejects.toThrow("Label is required");
    });

    it("rejects whitespace-only label", async () => {
      await expect(
        service.create(userId, {
          label: "   ",
          instructionText: "Some text",
          type: "analysis",
        }),
      ).rejects.toThrow("Label is required");
    });

    it("rejects label exceeding max length", async () => {
      await expect(
        service.create(userId, {
          label: "a".repeat(101),
          instructionText: "Some text",
          type: "analysis",
        }),
      ).rejects.toThrow("Label must be at most 100 characters");
    });

    it("rejects empty instruction text", async () => {
      await expect(
        service.create(userId, {
          label: "Valid",
          instructionText: "",
          type: "analysis",
        }),
      ).rejects.toThrow("Instruction text is required");
    });

    it("rejects instruction text exceeding max length", async () => {
      await expect(
        service.create(userId, {
          label: "Valid",
          instructionText: "a".repeat(2001),
          type: "analysis",
        }),
      ).rejects.toThrow("Instruction text must be at most 2000 characters");
    });

    it("rejects invalid type", async () => {
      await expect(
        service.create(userId, {
          label: "Valid",
          instructionText: "Some text",
          type: "invalid" as "analysis",
        }),
      ).rejects.toThrow("Type must be 'analysis' or 'rewrite'");
    });
  });

  describe("update", () => {
    it("updates label only", async () => {
      const created = await seedAIInstruction(userId, {
        label: "Old Label",
        instructionText: "Original text",
      });

      const updated = await service.update(userId, created.id, { label: "New Label" });
      expect(updated.label).toBe("New Label");
      expect(updated.instructionText).toBe("Original text");
    });

    it("updates instruction text only", async () => {
      const created = await seedAIInstruction(userId, {
        label: "Keep This",
        instructionText: "Old text",
      });

      const updated = await service.update(userId, created.id, {
        instructionText: "New text",
      });
      expect(updated.label).toBe("Keep This");
      expect(updated.instructionText).toBe("New text");
    });

    it("updates both fields", async () => {
      const created = await seedAIInstruction(userId);

      const updated = await service.update(userId, created.id, {
        label: "New Label",
        instructionText: "New text",
      });
      expect(updated.label).toBe("New Label");
      expect(updated.instructionText).toBe("New text");
    });

    it("rejects update for nonexistent instruction", async () => {
      await expect(service.update(userId, "nonexistent", { label: "New" })).rejects.toThrow(
        "Instruction not found",
      );
    });

    it("enforces ownership on update", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const created = await seedAIInstruction(userId, { label: "Mine" });

      await expect(service.update(otherUser.id, created.id, { label: "Stolen" })).rejects.toThrow(
        "Instruction not found",
      );
    });

    it("rejects empty label on update", async () => {
      const created = await seedAIInstruction(userId);
      await expect(service.update(userId, created.id, { label: "   " })).rejects.toThrow(
        "Label cannot be empty",
      );
    });

    it("rejects label exceeding max length on update", async () => {
      const created = await seedAIInstruction(userId);
      await expect(service.update(userId, created.id, { label: "a".repeat(101) })).rejects.toThrow(
        "Label must be at most 100 characters",
      );
    });
  });

  describe("delete", () => {
    it("deletes an instruction", async () => {
      const created = await seedAIInstruction(userId);

      await service.delete(userId, created.id);

      const remaining = await service.list(userId);
      expect(remaining).toHaveLength(0);
    });

    it("rejects delete for nonexistent instruction", async () => {
      await expect(service.delete(userId, "nonexistent")).rejects.toThrow("Instruction not found");
    });

    it("enforces ownership on delete", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const created = await seedAIInstruction(userId);

      await expect(service.delete(otherUser.id, created.id)).rejects.toThrow(
        "Instruction not found",
      );

      // Verify the instruction still exists for the owner
      const remaining = await service.list(userId);
      expect(remaining).toHaveLength(1);
    });
  });
});
