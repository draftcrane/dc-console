import { describe, it, expect, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { validateDriveId, escapeDriveQuery } from "../src/utils/drive-query.js";
import { AppError } from "../src/middleware/error-handler.js";
import { seedUser, seedProject, cleanAll } from "./helpers/seed.js";

/**
 * Drive query utility tests.
 *
 * Validates that malformed Google Drive IDs throw a 400 VALIDATION_ERROR
 * (not a generic Error that would bubble into a 5xx). Also tests the
 * query-escaping helper.
 */

const BASE = "http://localhost";

function authHeaders(userId: string, extra?: Record<string, string>): Record<string, string> {
  return {
    "X-Test-User-Id": userId,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Unit: validateDriveId
// ---------------------------------------------------------------------------
describe("validateDriveId", () => {
  it("returns a valid alphanumeric Drive ID unchanged", () => {
    expect(validateDriveId("abc123XYZ")).toBe("abc123XYZ");
  });

  it("accepts IDs with hyphens and underscores", () => {
    expect(validateDriveId("abc-123_XYZ")).toBe("abc-123_XYZ");
  });

  it("accepts a typical Google Drive ID length", () => {
    const id = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";
    expect(validateDriveId(id)).toBe(id);
  });

  it("throws AppError with 400 VALIDATION_ERROR for empty string", () => {
    try {
      validateDriveId("");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(400);
      expect(appErr.code).toBe("VALIDATION_ERROR");
      expect(appErr.message).toBe("Invalid Google Drive ID format");
    }
  });

  it("throws AppError for ID with spaces", () => {
    try {
      validateDriveId("abc 123");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("throws AppError for ID with special characters", () => {
    const malformed = ["abc!@#", "id/with/slashes", "id.with.dots", "id=value", "id&other"];
    for (const id of malformed) {
      try {
        validateDriveId(id);
        expect.unreachable(`should have thrown for: ${id}`);
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).code).toBe("VALIDATION_ERROR");
      }
    }
  });

  it("throws AppError for ID with SQL injection attempt", () => {
    try {
      validateDriveId("' OR 1=1 --");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("does not leak the invalid ID in the error message", () => {
    const maliciousId = "<script>alert(1)</script>";
    try {
      validateDriveId(maliciousId);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).not.toContain(maliciousId);
      expect((err as AppError).message).toBe("Invalid Google Drive ID format");
    }
  });
});

// ---------------------------------------------------------------------------
// Unit: escapeDriveQuery
// ---------------------------------------------------------------------------
describe("escapeDriveQuery", () => {
  it("escapes single quotes", () => {
    expect(escapeDriveQuery("it's")).toBe("it\\'s");
  });

  it("escapes backslashes", () => {
    expect(escapeDriveQuery("back\\slash")).toBe("back\\\\slash");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeDriveQuery("hello world")).toBe("hello world");
  });
});

// ---------------------------------------------------------------------------
// Integration: malformed Drive IDs on source endpoints return 400
// ---------------------------------------------------------------------------
describe("Integration: malformed Drive IDs on POST /projects/:projectId/sources", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  it("returns 400 VALIDATION_ERROR for Drive ID with special characters", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/sources`, {
      method: "POST",
      headers: authHeaders(userId, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        files: [
          {
            driveFileId: "abc!@#$%",
            title: "Bad Source",
            mimeType: "application/vnd.google-apps.document",
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Invalid Google Drive ID format");
  });

  it("returns 400 VALIDATION_ERROR for empty Drive ID", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/sources`, {
      method: "POST",
      headers: authHeaders(userId, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        files: [
          {
            driveFileId: "",
            title: "Empty ID Source",
            mimeType: "application/vnd.google-apps.document",
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for Drive ID with SQL injection attempt", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/sources`, {
      method: "POST",
      headers: authHeaders(userId, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        files: [
          {
            driveFileId: "' OR 1=1 --",
            title: "SQL Injection Source",
            mimeType: "application/vnd.google-apps.document",
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    // Error message should not contain the malicious input
    expect(body.error).not.toContain("OR 1=1");
  });

  it("does not leak internal details in the error response", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/sources`, {
      method: "POST",
      headers: authHeaders(userId, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        files: [
          {
            driveFileId: "../../../etc/passwd",
            title: "Path Traversal Source",
            mimeType: "application/vnd.google-apps.document",
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).not.toContain("etc/passwd");
    expect(body.error).not.toContain("stack");
  });

  it("accepts valid Drive IDs (positive case)", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/sources`, {
      method: "POST",
      headers: authHeaders(userId, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        files: [
          {
            driveFileId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
            title: "Valid Source",
            mimeType: "application/vnd.google-apps.document",
          },
        ],
      }),
    });

    // Should NOT be 400 -- the Drive ID format is valid.
    // It may succeed (201) or fail for another reason (no Drive connection, etc.)
    // but it should NOT be a VALIDATION_ERROR about Drive ID format.
    expect(res.status).not.toBe(400);
  });
});
