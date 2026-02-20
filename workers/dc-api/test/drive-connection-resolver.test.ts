import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { DriveTokenService } from "../src/services/drive-token.js";
import type { GoogleTokenResponse } from "../src/services/drive-token.js";
import {
  resolveProjectConnection,
  resolveReadOnlyConnection,
} from "../src/services/drive-connection-resolver.js";
import { seedUser, seedProject, cleanAll } from "./helpers/seed.js";

/**
 * Drive connection resolver tests.
 *
 * Validates that mutating Drive operations use explicit connection resolution
 * and reject ambiguous states in multi-account scenarios (issue #166).
 *
 * Test matrix:
 *   - Single-connection users: implicit resolution works
 *   - Multi-connection users: explicit binding required, ambiguous rejected
 *   - Project-bound connections: project.drive_connection_id takes precedence
 *   - Invalid/expired connections: proper error responses
 */
describe("Drive Connection Resolver", () => {
  let tokenService: DriveTokenService;
  let userId: string;

  const mockTokens = (suffix: string): GoogleTokenResponse => ({
    access_token: `ya29.token-${suffix}`,
    refresh_token: `1//refresh-${suffix}`,
    expires_in: 3600,
    token_type: "Bearer",
    scope: "https://www.googleapis.com/auth/drive.file",
  });

  beforeEach(async () => {
    await cleanAll();
    tokenService = new DriveTokenService(env as unknown as import("../src/types/index.js").Env);
    const user = await seedUser();
    userId = user.id;
  });

  // ── resolveProjectConnection ──

  describe("resolveProjectConnection", () => {
    describe("single-connection user", () => {
      beforeEach(async () => {
        await tokenService.storeTokens(userId, "conn-1", mockTokens("1"), "user@gmail.com");
      });

      it("resolves via project.drive_connection_id when available", async () => {
        const result = await resolveProjectConnection(tokenService, userId, "conn-1");

        expect(result.connectionId).toBe("conn-1");
        expect(result.tokens.accessToken).toBe("ya29.token-1");
      });

      it("resolves via single-connection fallback when no project binding", async () => {
        const result = await resolveProjectConnection(tokenService, userId, null);

        expect(result.connectionId).toBe("conn-1");
        expect(result.tokens.accessToken).toBe("ya29.token-1");
      });

      it("resolves via request connectionId when no project binding", async () => {
        const result = await resolveProjectConnection(tokenService, userId, null, "conn-1");

        expect(result.connectionId).toBe("conn-1");
        expect(result.tokens.accessToken).toBe("ya29.token-1");
      });

      it("project binding takes precedence over request connectionId", async () => {
        // Even if a different connectionId is passed, project binding wins
        const result = await resolveProjectConnection(tokenService, userId, "conn-1", "conn-other");

        expect(result.connectionId).toBe("conn-1");
      });
    });

    describe("multi-connection user", () => {
      beforeEach(async () => {
        await tokenService.storeTokens(userId, "conn-1", mockTokens("1"), "personal@gmail.com");
        await tokenService.storeTokens(userId, "conn-2", mockTokens("2"), "work@company.com");
      });

      it("resolves via project.drive_connection_id (deterministic)", async () => {
        const result = await resolveProjectConnection(tokenService, userId, "conn-2");

        expect(result.connectionId).toBe("conn-2");
        expect(result.tokens.accessToken).toBe("ya29.token-2");
      });

      it("resolves via request connectionId when no project binding", async () => {
        const result = await resolveProjectConnection(tokenService, userId, null, "conn-1");

        expect(result.connectionId).toBe("conn-1");
        expect(result.tokens.accessToken).toBe("ya29.token-1");
      });

      it("rejects with DRIVE_AMBIGUOUS when no explicit binding", async () => {
        await expect(resolveProjectConnection(tokenService, userId, null)).rejects.toThrow(
          "Multiple Google Drive accounts connected",
        );
      });

      it("DRIVE_AMBIGUOUS error has 409 status code", async () => {
        try {
          await resolveProjectConnection(tokenService, userId, null);
          expect.fail("Should have thrown");
        } catch (err: unknown) {
          const error = err as { statusCode: number; code: string };
          expect(error.statusCode).toBe(409);
          expect(error.code).toBe("DRIVE_AMBIGUOUS");
        }
      });

      it("rejects request connectionId that belongs to another user", async () => {
        const otherUser = await seedUser({ id: "other-user" });
        await tokenService.storeTokens(
          otherUser.id,
          "conn-other",
          mockTokens("other"),
          "other@gmail.com",
        );

        await expect(
          resolveProjectConnection(tokenService, userId, null, "conn-other"),
        ).rejects.toThrow("Connection not found for this user");
      });
    });

    describe("no connections", () => {
      it("rejects with DRIVE_NOT_CONNECTED", async () => {
        await expect(resolveProjectConnection(tokenService, userId, null)).rejects.toThrow(
          "Google Drive is not connected",
        );
      });

      it("rejects with 422 status code", async () => {
        try {
          await resolveProjectConnection(tokenService, userId, null);
          expect.fail("Should have thrown");
        } catch (err: unknown) {
          const error = err as { statusCode: number; code: string };
          expect(error.statusCode).toBe(422);
          expect(error.code).toBe("DRIVE_NOT_CONNECTED");
        }
      });
    });

    describe("invalid connection", () => {
      it("rejects with DRIVE_NOT_CONNECTED when project connection is missing", async () => {
        await expect(
          resolveProjectConnection(tokenService, userId, "deleted-conn"),
        ).rejects.toThrow("Project Drive connection is invalid or expired");
      });
    });
  });

  // ── resolveReadOnlyConnection ──

  describe("resolveReadOnlyConnection", () => {
    it("resolves via explicit connectionId", async () => {
      await tokenService.storeTokens(userId, "conn-1", mockTokens("1"), "user@gmail.com");

      const result = await resolveReadOnlyConnection(tokenService, userId, "conn-1");

      expect(result.connectionId).toBe("conn-1");
      expect(result.tokens.accessToken).toBe("ya29.token-1");
    });

    it("resolves single-connection user without explicit connectionId", async () => {
      await tokenService.storeTokens(userId, "conn-1", mockTokens("1"), "user@gmail.com");

      const result = await resolveReadOnlyConnection(tokenService, userId);

      expect(result.connectionId).toBe("conn-1");
    });

    it("rejects multi-connection user without explicit connectionId", async () => {
      await tokenService.storeTokens(userId, "conn-1", mockTokens("1"), "personal@gmail.com");
      await tokenService.storeTokens(userId, "conn-2", mockTokens("2"), "work@company.com");

      await expect(resolveReadOnlyConnection(tokenService, userId)).rejects.toThrow(
        "Multiple Google Drive accounts connected",
      );
    });

    it("rejects when no connections exist", async () => {
      await expect(resolveReadOnlyConnection(tokenService, userId)).rejects.toThrow(
        "Google Drive is not connected",
      );
    });
  });

  // ── Multi-account project binding scenarios ──

  describe("project connect/disconnect scenarios", () => {
    it("project with explicit connection continues working after other connections added", async () => {
      // User starts with one connection, project is bound to it
      await tokenService.storeTokens(userId, "conn-1", mockTokens("1"), "personal@gmail.com");

      // Project is bound to conn-1
      const result1 = await resolveProjectConnection(tokenService, userId, "conn-1");
      expect(result1.connectionId).toBe("conn-1");

      // User adds a second connection -- project should still resolve to conn-1
      await tokenService.storeTokens(userId, "conn-2", mockTokens("2"), "work@company.com");

      const result2 = await resolveProjectConnection(tokenService, userId, "conn-1");
      expect(result2.connectionId).toBe("conn-1");
      expect(result2.tokens.accessToken).toBe("ya29.token-1");
    });

    it("project with deleted connection fails fast", async () => {
      await tokenService.storeTokens(userId, "conn-1", mockTokens("1"), "user@gmail.com");
      await tokenService.storeTokens(userId, "conn-2", mockTokens("2"), "work@company.com");

      // Delete the connection the project was bound to
      await tokenService.deleteConnectionById("conn-1", userId);

      // Should fail fast -- the project's connection is gone
      await expect(resolveProjectConnection(tokenService, userId, "conn-1")).rejects.toThrow(
        "Project Drive connection is invalid or expired",
      );
    });
  });
});
