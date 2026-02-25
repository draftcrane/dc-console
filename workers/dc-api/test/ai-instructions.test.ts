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
      await seedAIInstruction(userId, { label: "Summarize", type: "desk" });
      await seedAIInstruction(userId, { label: "Concise", type: "chapter" });

      const result = await service.list(userId);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("Summarize");
      expect(result[1].label).toBe("Concise");
    });

    it("filters by type", async () => {
      await seedAIInstruction(userId, { label: "Summarize", type: "desk" });
      await seedAIInstruction(userId, { label: "Concise", type: "chapter" });

      const deskOnly = await service.list(userId, "desk");
      expect(deskOnly).toHaveLength(1);
      expect(deskOnly[0].label).toBe("Summarize");

      const chapterOnly = await service.list(userId, "chapter");
      expect(chapterOnly).toHaveLength(1);
      expect(chapterOnly[0].label).toBe("Concise");
    });

    it("filters by book type", async () => {
      await seedAIInstruction(userId, { label: "Find redundancies", type: "book" });
      await seedAIInstruction(userId, { label: "Summarize", type: "desk" });

      const bookOnly = await service.list(userId, "book");
      expect(bookOnly).toHaveLength(1);
      expect(bookOnly[0].label).toBe("Find redundancies");
    });

    it("ignores invalid type filter and returns all", async () => {
      await seedAIInstruction(userId, { label: "A", type: "desk" });
      await seedAIInstruction(userId, { label: "B", type: "chapter" });

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
        type: "desk",
      });

      expect(result.id).toBeTruthy();
      expect(result.userId).toBe(userId);
      expect(result.label).toBe("Summarize key points");
      expect(result.instructionText).toBe("Extract the key points from this document.");
      expect(result.type).toBe("desk");
      expect(result.lastUsedAt).toBeNull();
      expect(result.createdAt).toBeTruthy();
    });

    it("trims label and instruction text", async () => {
      const result = await service.create(userId, {
        label: "  Trimmed Label  ",
        instructionText: "  Trimmed text  ",
        type: "chapter",
      });

      expect(result.label).toBe("Trimmed Label");
      expect(result.instructionText).toBe("Trimmed text");
    });

    it("rejects empty label", async () => {
      await expect(
        service.create(userId, {
          label: "",
          instructionText: "Some text",
          type: "desk",
        }),
      ).rejects.toThrow("Label is required");
    });

    it("rejects whitespace-only label", async () => {
      await expect(
        service.create(userId, {
          label: "   ",
          instructionText: "Some text",
          type: "desk",
        }),
      ).rejects.toThrow("Label is required");
    });

    it("rejects label exceeding max length", async () => {
      await expect(
        service.create(userId, {
          label: "a".repeat(101),
          instructionText: "Some text",
          type: "desk",
        }),
      ).rejects.toThrow("Label must be at most 100 characters");
    });

    it("rejects empty instruction text", async () => {
      await expect(
        service.create(userId, {
          label: "Valid",
          instructionText: "",
          type: "desk",
        }),
      ).rejects.toThrow("Instruction text is required");
    });

    it("rejects instruction text exceeding max length", async () => {
      await expect(
        service.create(userId, {
          label: "Valid",
          instructionText: "a".repeat(2001),
          type: "desk",
        }),
      ).rejects.toThrow("Instruction text must be at most 2000 characters");
    });

    it("rejects invalid type", async () => {
      await expect(
        service.create(userId, {
          label: "Valid",
          instructionText: "Some text",
          type: "invalid" as "desk",
        }),
      ).rejects.toThrow("Type must be 'desk', 'book', or 'chapter'");
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

  describe("touchLastUsed", () => {
    it("updates last_used_at timestamp", async () => {
      const created = await seedAIInstruction(userId);

      // Verify initially null
      const before = await service.list(userId);
      expect(before[0].lastUsedAt).toBeNull();

      await service.touchLastUsed(userId, created.id);

      const after = await service.list(userId);
      expect(after[0].lastUsedAt).toBeTruthy();
    });

    it("enforces ownership", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const created = await seedAIInstruction(userId);

      await expect(service.touchLastUsed(otherUser.id, created.id)).rejects.toThrow(
        "Instruction not found",
      );
    });

    it("rejects nonexistent instruction", async () => {
      await expect(service.touchLastUsed(userId, "nonexistent")).rejects.toThrow(
        "Instruction not found",
      );
    });
  });

  describe("seedDefaultInstructions", () => {
    it("seeds 13 default instructions", async () => {
      await service.seedDefaultInstructions(userId);

      const all = await service.list(userId);
      expect(all).toHaveLength(13);
    });

    it("seeds correct type distribution", async () => {
      await service.seedDefaultInstructions(userId);

      const chapter = await service.list(userId, "chapter");
      const desk = await service.list(userId, "desk");
      const book = await service.list(userId, "book");

      expect(chapter).toHaveLength(5);
      expect(desk).toHaveLength(4);
      expect(book).toHaveLength(4);
    });

    it("is idempotent on second call", async () => {
      await service.seedDefaultInstructions(userId);
      await service.seedDefaultInstructions(userId);

      const all = await service.list(userId);
      expect(all).toHaveLength(13);
    });

    it("skips seeding if user already has instructions", async () => {
      await seedAIInstruction(userId, { label: "Custom" });

      await service.seedDefaultInstructions(userId);

      const all = await service.list(userId);
      expect(all).toHaveLength(1);
      expect(all[0].label).toBe("Custom");
    });
  });
});
