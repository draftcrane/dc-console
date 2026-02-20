import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { DriveTokenService } from "../src/services/drive-token.js";
import type { GoogleTokenResponse } from "../src/services/drive-token.js";
import { seedUser, cleanAll } from "./helpers/seed.js";

/**
 * DriveTokenService tests.
 *
 * Validates the Google Drive OAuth authorization flow for source file reading (#121):
 *
 * 1. OAuth flow: authorization URL generation with correct scopes
 * 2. Read access: drive.readonly scope included for source file reading
 * 3. Authorization persistence: token storage, retrieval, and connection management
 *
 * Methods that make real HTTP calls to Google (exchangeCodeForTokens,
 * refreshAccessToken, getUserEmail, revokeToken) are not tested here —
 * those are integration concerns tested manually against the Google API.
 */
describe("DriveTokenService", () => {
  let service: DriveTokenService;
  let userId: string;

  beforeEach(async () => {
    await cleanAll();
    service = new DriveTokenService(env as unknown as import("../src/types/index.js").Env);
    const user = await seedUser();
    userId = user.id;
  });

  describe("getAuthorizationUrl", () => {
    it("generates a Google OAuth URL with correct parameters", () => {
      const url = service.getAuthorizationUrl("test-state-123");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://accounts.google.com");
      expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
      expect(parsed.searchParams.get("client_id")).toBe("test-google-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://api.draftcrane.app/drive/callback",
      );
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("access_type")).toBe("offline");
      expect(parsed.searchParams.get("prompt")).toBe("consent");
      expect(parsed.searchParams.get("state")).toBe("test-state-123");
    });

    it("requests drive.readonly scope for source file reading", () => {
      const url = service.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      const scope = parsed.searchParams.get("scope") || "";

      expect(scope).toContain("https://www.googleapis.com/auth/drive.readonly");
    });

    it("requests drive.file scope for output folder management", () => {
      const url = service.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      const scope = parsed.searchParams.get("scope") || "";

      expect(scope).toContain("https://www.googleapis.com/auth/drive.file");
    });

    it("requests email scope for identifying the Google account", () => {
      const url = service.getAuthorizationUrl("test-state");
      const parsed = new URL(url);
      const scope = parsed.searchParams.get("scope") || "";

      expect(scope).toContain("email");
    });

    it("includes loginHint when provided for multi-account support", () => {
      const url = service.getAuthorizationUrl("test-state", "user@example.com");
      const parsed = new URL(url);

      expect(parsed.searchParams.get("login_hint")).toBe("user@example.com");
    });

    it("omits loginHint when not provided", () => {
      const url = service.getAuthorizationUrl("test-state");
      const parsed = new URL(url);

      expect(parsed.searchParams.has("login_hint")).toBe(false);
    });
  });

  describe("storeTokens + getStoredTokens (persistence)", () => {
    const mockTokens: GoogleTokenResponse = {
      access_token: "ya29.test-access-token-abc123",
      refresh_token: "1//test-refresh-token-xyz789",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "https://www.googleapis.com/auth/drive.readonly",
    };

    it("stores tokens encrypted and retrieves them decrypted", async () => {
      await service.storeTokens(userId, "conn-1", mockTokens, "user@gmail.com");

      const stored = await service.getStoredTokens("conn-1");

      expect(stored).not.toBeNull();
      expect(stored!.accessToken).toBe("ya29.test-access-token-abc123");
      expect(stored!.refreshToken).toBe("1//test-refresh-token-xyz789");
      expect(stored!.expiresAt).toBeInstanceOf(Date);
    });

    it("stores tokens that persist across separate retrievals (session persistence)", async () => {
      await service.storeTokens(userId, "conn-persist", mockTokens, "persist@gmail.com");

      // Simulate a new service instance (new session)
      const service2 = new DriveTokenService(env as unknown as import("../src/types/index.js").Env);

      const stored = await service2.getStoredTokens("conn-persist");

      expect(stored).not.toBeNull();
      expect(stored!.accessToken).toBe("ya29.test-access-token-abc123");
      expect(stored!.refreshToken).toBe("1//test-refresh-token-xyz789");
    });

    it("returns null for non-existent connection", async () => {
      const stored = await service.getStoredTokens("non-existent-conn");

      expect(stored).toBeNull();
    });

    it("upserts on same user+email, preserving connection ID", async () => {
      const conn1 = await service.storeTokens(userId, "conn-1", mockTokens, "user@gmail.com");

      // Re-auth with same email but new tokens
      const updatedTokens: GoogleTokenResponse = {
        ...mockTokens,
        access_token: "ya29.updated-access-token",
      };
      const conn2 = await service.storeTokens(userId, "conn-2", updatedTokens, "user@gmail.com");

      // Should return the original connection ID, not the new one
      expect(conn2).toBe(conn1);

      // Should have the updated access token
      const stored = await service.getStoredTokens(conn1);
      expect(stored!.accessToken).toBe("ya29.updated-access-token");
    });

    it("preserves existing refresh token when re-auth omits refresh_token", async () => {
      await service.storeTokens(userId, "conn-1", mockTokens, "user@gmail.com");

      // Re-auth without refresh_token (Google only sends it on first consent)
      const reAuthTokens: GoogleTokenResponse = {
        access_token: "ya29.new-access-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/drive.readonly",
      };
      await service.storeTokens(userId, "conn-2", reAuthTokens, "user@gmail.com");

      const stored = await service.getStoredTokens("conn-1");
      expect(stored!.accessToken).toBe("ya29.new-access-token");
      expect(stored!.refreshToken).toBe("1//test-refresh-token-xyz789"); // Preserved
    });
  });

  describe("getStoredTokensByUser", () => {
    it("returns tokens for user's first connection", async () => {
      const mockTokens: GoogleTokenResponse = {
        access_token: "ya29.user-token",
        refresh_token: "1//user-refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/drive.readonly",
      };
      await service.storeTokens(userId, "conn-1", mockTokens, "user@gmail.com");

      const stored = await service.getStoredTokensByUser(userId);

      expect(stored).not.toBeNull();
      expect(stored!.connectionId).toBe("conn-1");
      expect(stored!.accessToken).toBe("ya29.user-token");
    });

    it("returns null for user with no connections", async () => {
      const stored = await service.getStoredTokensByUser(userId);

      expect(stored).toBeNull();
    });
  });

  describe("getConnectionsForUser", () => {
    it("returns empty array for user with no connections", async () => {
      const connections = await service.getConnectionsForUser(userId);

      expect(connections).toEqual([]);
    });

    it("returns connection metadata (no tokens exposed)", async () => {
      const mockTokens: GoogleTokenResponse = {
        access_token: "ya29.secret-token",
        refresh_token: "1//secret-refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/drive.readonly",
      };
      await service.storeTokens(userId, "conn-1", mockTokens, "user@gmail.com");

      const connections = await service.getConnectionsForUser(userId);

      expect(connections).toHaveLength(1);
      expect(connections[0].id).toBe("conn-1");
      expect(connections[0].email).toBe("user@gmail.com");
      expect(connections[0].connectedAt).toBeDefined();
      // Tokens must not be exposed in connection metadata
      expect(connections[0]).not.toHaveProperty("accessToken");
      expect(connections[0]).not.toHaveProperty("refreshToken");
    });

    it("returns multiple connections for multi-account users", async () => {
      const tokens1: GoogleTokenResponse = {
        access_token: "ya29.token1",
        refresh_token: "1//refresh1",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "",
      };
      const tokens2: GoogleTokenResponse = {
        access_token: "ya29.token2",
        refresh_token: "1//refresh2",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "",
      };
      await service.storeTokens(userId, "conn-1", tokens1, "personal@gmail.com");
      await service.storeTokens(userId, "conn-2", tokens2, "work@company.com");

      const connections = await service.getConnectionsForUser(userId);

      expect(connections).toHaveLength(2);
      const emails = connections.map((c) => c.email);
      expect(emails).toContain("personal@gmail.com");
      expect(emails).toContain("work@company.com");
    });

    it("isolates connections between users", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const tokens: GoogleTokenResponse = {
        access_token: "ya29.token",
        refresh_token: "1//refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "",
      };
      await service.storeTokens(userId, "conn-1", tokens, "user1@gmail.com");
      await service.storeTokens(otherUser.id, "conn-2", tokens, "user2@gmail.com");

      const user1Connections = await service.getConnectionsForUser(userId);
      const user2Connections = await service.getConnectionsForUser(otherUser.id);

      expect(user1Connections).toHaveLength(1);
      expect(user1Connections[0].email).toBe("user1@gmail.com");
      expect(user2Connections).toHaveLength(1);
      expect(user2Connections[0].email).toBe("user2@gmail.com");
    });
  });

  describe("deleteConnectionById", () => {
    it("removes a specific connection", async () => {
      const tokens: GoogleTokenResponse = {
        access_token: "ya29.token",
        refresh_token: "1//refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "",
      };
      await service.storeTokens(userId, "conn-1", tokens, "user@gmail.com");

      await service.deleteConnectionById("conn-1", userId);

      const stored = await service.getStoredTokens("conn-1");
      expect(stored).toBeNull();

      const connections = await service.getConnectionsForUser(userId);
      expect(connections).toHaveLength(0);
    });

    it("does not delete another user's connection", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      const tokens: GoogleTokenResponse = {
        access_token: "ya29.token",
        refresh_token: "1//refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "",
      };
      await service.storeTokens(otherUser.id, "conn-1", tokens, "other@gmail.com");

      // Attempt to delete other user's connection
      await service.deleteConnectionById("conn-1", userId);

      // Connection should still exist
      const stored = await service.getStoredTokens("conn-1");
      expect(stored).not.toBeNull();
    });
  });

  describe("getValidTokensByConnection", () => {
    it("returns tokens when not expired", async () => {
      const tokens: GoogleTokenResponse = {
        access_token: "ya29.valid-token",
        refresh_token: "1//valid-refresh",
        expires_in: 3600, // 1 hour from now
        token_type: "Bearer",
        scope: "",
      };
      await service.storeTokens(userId, "conn-1", tokens, "user@gmail.com");

      const valid = await service.getValidTokensByConnection("conn-1");

      expect(valid).not.toBeNull();
      expect(valid!.accessToken).toBe("ya29.valid-token");
      expect(valid!.wasRefreshed).toBe(false);
    });

    it("returns null for non-existent connection", async () => {
      const valid = await service.getValidTokensByConnection("non-existent");

      expect(valid).toBeNull();
    });
  });
});
