import { describe, it, expect, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { ExportDeliveryService } from "../src/services/export-delivery.js";
import {
  seedUser,
  seedProject,
  seedDriveConnection,
  seedExportPreference,
  cleanAll,
} from "./helpers/seed.js";

const BASE = "http://localhost";

function authHeaders(userId: string, extra?: Record<string, string>): Record<string, string> {
  return {
    "X-Test-User-Id": userId,
    ...extra,
  };
}

async function jsonRequest(
  method: string,
  path: string,
  userId: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: authHeaders(userId, { "Content-Type": "application/json" }),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return SELF.fetch(`${BASE}${path}`, init);
}

// ── Service-level tests ──

describe("ExportDeliveryService — preferences", () => {
  let service: ExportDeliveryService;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
    service = new ExportDeliveryService(env.DB, env.EXPORTS_BUCKET, "");
  });

  describe("getExportPreference", () => {
    it("returns null when no preference exists", async () => {
      const pref = await service.getExportPreference(userId, projectId);
      expect(pref).toBeNull();
    });

    it("returns saved device preference", async () => {
      await seedExportPreference(projectId, userId, { destinationType: "device" });
      const pref = await service.getExportPreference(userId, projectId);
      expect(pref).not.toBeNull();
      expect(pref!.destinationType).toBe("device");
      expect(pref!.driveConnectionId).toBeNull();
    });

    it("returns saved drive preference with folder info", async () => {
      const conn = await seedDriveConnection(userId);
      await seedExportPreference(projectId, userId, {
        destinationType: "drive",
        driveConnectionId: conn.id,
        driveFolderId: "folder-abc",
        driveFolderPath: "My Book / _exports",
      });

      const pref = await service.getExportPreference(userId, projectId);
      expect(pref).not.toBeNull();
      expect(pref!.destinationType).toBe("drive");
      expect(pref!.driveConnectionId).toBe(conn.id);
      expect(pref!.driveFolderId).toBe("folder-abc");
      expect(pref!.driveFolderPath).toBe("My Book / _exports");
    });

    it("does not return another user's preference", async () => {
      const other = await seedUser({ id: "other-user" });
      await seedExportPreference(projectId, userId, { destinationType: "device" });
      const pref = await service.getExportPreference(other.id, projectId);
      expect(pref).toBeNull();
    });
  });

  describe("setExportPreference", () => {
    it("creates a device preference", async () => {
      const pref = await service.setExportPreference(userId, projectId, {
        destinationType: "device",
      });
      expect(pref.destinationType).toBe("device");
      expect(pref.projectId).toBe(projectId);
      expect(pref.userId).toBe(userId);
    });

    it("creates a drive preference with folder", async () => {
      const conn = await seedDriveConnection(userId);
      const pref = await service.setExportPreference(userId, projectId, {
        destinationType: "drive",
        driveConnectionId: conn.id,
        driveFolderId: "folder-xyz",
        driveFolderPath: "My Book / exports",
      });
      expect(pref.destinationType).toBe("drive");
      expect(pref.driveConnectionId).toBe(conn.id);
      expect(pref.driveFolderId).toBe("folder-xyz");
    });

    it("upserts (updates existing preference)", async () => {
      await service.setExportPreference(userId, projectId, {
        destinationType: "device",
      });

      const conn = await seedDriveConnection(userId);
      const updated = await service.setExportPreference(userId, projectId, {
        destinationType: "drive",
        driveConnectionId: conn.id,
      });

      expect(updated.destinationType).toBe("drive");

      // Verify only one row exists
      const count = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM export_preferences WHERE project_id = ? AND user_id = ?",
      )
        .bind(projectId, userId)
        .first<{ cnt: number }>();
      expect(count!.cnt).toBe(1);
    });

    it("clears drive fields when switching to device", async () => {
      const conn = await seedDriveConnection(userId);
      await service.setExportPreference(userId, projectId, {
        destinationType: "drive",
        driveConnectionId: conn.id,
        driveFolderId: "folder-xyz",
      });

      const updated = await service.setExportPreference(userId, projectId, {
        destinationType: "device",
      });

      expect(updated.driveConnectionId).toBeNull();
      expect(updated.driveFolderId).toBeNull();
    });

    it("rejects invalid destinationType", async () => {
      await expect(
        service.setExportPreference(userId, projectId, {
          destinationType: "invalid" as "device",
        }),
      ).rejects.toThrow('destinationType must be "device" or "drive"');
    });

    it("rejects drive without connectionId", async () => {
      await expect(
        service.setExportPreference(userId, projectId, {
          destinationType: "drive",
        }),
      ).rejects.toThrow("driveConnectionId is required");
    });

    it("rejects nonexistent project", async () => {
      await expect(
        service.setExportPreference(userId, "nonexistent", {
          destinationType: "device",
        }),
      ).rejects.toThrow("Project not found");
    });
  });

  describe("clearExportPreference", () => {
    it("deletes an existing preference", async () => {
      await seedExportPreference(projectId, userId, { destinationType: "device" });
      await service.clearExportPreference(userId, projectId);
      const pref = await service.getExportPreference(userId, projectId);
      expect(pref).toBeNull();
    });

    it("throws when no preference exists", async () => {
      await expect(service.clearExportPreference(userId, projectId)).rejects.toThrow(
        "No export preference found",
      );
    });
  });
});

// ── Route-level (integration) tests ──

describe("Integration: Export Preferences", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanAll();
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
  });

  it("GET /projects/:projectId/export-preferences returns null when none set", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/export-preferences`, {
      headers: authHeaders(userId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { preference: null };
    expect(body.preference).toBeNull();
  });

  it("PUT /projects/:projectId/export-preferences creates a device preference", async () => {
    const res = await jsonRequest("PUT", `/projects/${projectId}/export-preferences`, userId, {
      destinationType: "device",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { preference: { destinationType: string } };
    expect(body.preference.destinationType).toBe("device");
  });

  it("PUT /projects/:projectId/export-preferences creates a drive preference", async () => {
    const conn = await seedDriveConnection(userId);
    const res = await jsonRequest("PUT", `/projects/${projectId}/export-preferences`, userId, {
      destinationType: "drive",
      driveConnectionId: conn.id,
      driveFolderId: "folder-123",
      driveFolderPath: "My Book / _exports",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      preference: {
        destinationType: string;
        driveConnectionId: string;
        driveFolderId: string;
        driveFolderPath: string;
      };
    };
    expect(body.preference.destinationType).toBe("drive");
    expect(body.preference.driveConnectionId).toBe(conn.id);
    expect(body.preference.driveFolderId).toBe("folder-123");
  });

  it("PUT rejects missing destinationType", async () => {
    const res = await jsonRequest("PUT", `/projects/${projectId}/export-preferences`, userId, {});
    expect(res.status).toBe(400);
  });

  it("GET returns the saved preference after PUT", async () => {
    await jsonRequest("PUT", `/projects/${projectId}/export-preferences`, userId, {
      destinationType: "device",
    });

    const res = await SELF.fetch(`${BASE}/projects/${projectId}/export-preferences`, {
      headers: authHeaders(userId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { preference: { destinationType: string } };
    expect(body.preference).not.toBeNull();
    expect(body.preference.destinationType).toBe("device");
  });

  it("DELETE removes the preference", async () => {
    await jsonRequest("PUT", `/projects/${projectId}/export-preferences`, userId, {
      destinationType: "device",
    });

    const res = await jsonRequest("DELETE", `/projects/${projectId}/export-preferences`, userId);
    expect(res.status).toBe(200);

    const check = await SELF.fetch(`${BASE}/projects/${projectId}/export-preferences`, {
      headers: authHeaders(userId),
    });
    const body = (await check.json()) as { preference: null };
    expect(body.preference).toBeNull();
  });

  it("DELETE returns 404 when no preference exists", async () => {
    const res = await jsonRequest("DELETE", `/projects/${projectId}/export-preferences`, userId);
    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/export-preferences`);
    expect(res.status).toBe(401);
  });

  it("isolates preferences between users", async () => {
    const other = await seedUser({ id: "other-iso" });
    const otherProject = await seedProject(other.id);

    await jsonRequest("PUT", `/projects/${projectId}/export-preferences`, userId, {
      destinationType: "device",
    });

    // Other user can't see it
    const res = await SELF.fetch(`${BASE}/projects/${projectId}/export-preferences`, {
      headers: authHeaders(other.id),
    });
    const body = (await res.json()) as { preference: null };
    expect(body.preference).toBeNull();

    // Other user has their own
    await jsonRequest("PUT", `/projects/${otherProject.id}/export-preferences`, other.id, {
      destinationType: "device",
    });

    const otherRes = await SELF.fetch(`${BASE}/projects/${otherProject.id}/export-preferences`, {
      headers: authHeaders(other.id),
    });
    const otherBody = (await otherRes.json()) as { preference: { destinationType: string } };
    expect(otherBody.preference).not.toBeNull();
  });
});
