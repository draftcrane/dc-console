import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { LinkedFolderService } from "../src/services/linked-folder.js";
import {
  seedUser,
  seedProject,
  seedDriveConnection,
  seedLinkedFolder,
  seedSource,
  cleanAll,
} from "./helpers/seed.js";

describe("LinkedFolderService", () => {
  let service: LinkedFolderService;
  let userId: string;
  let projectId: string;
  let connectionId: string;
  let connectionEmail: string;

  beforeEach(async () => {
    await cleanAll();
    service = new LinkedFolderService(env.DB, env.EXPORTS_BUCKET);
    const user = await seedUser();
    userId = user.id;
    const project = await seedProject(userId);
    projectId = project.id;
    const conn = await seedDriveConnection(userId);
    connectionId = conn.id;
    connectionEmail = conn.email;
  });

  describe("listLinkedFolders", () => {
    it("returns empty array when no folders are linked", async () => {
      const folders = await service.listLinkedFolders(userId, projectId);
      expect(folders).toHaveLength(0);
    });

    it("returns linked folders with email from drive_connections", async () => {
      await seedLinkedFolder(projectId, connectionId, {
        folderName: "Research Notes",
        documentCount: 5,
      });

      const folders = await service.listLinkedFolders(userId, projectId);
      expect(folders).toHaveLength(1);
      expect(folders[0].folderName).toBe("Research Notes");
      expect(folders[0].email).toBe(connectionEmail);
      expect(folders[0].documentCount).toBe(5);
      expect(folders[0].projectId).toBe(projectId);
      expect(folders[0].driveConnectionId).toBe(connectionId);
    });

    it("throws NOT_FOUND for wrong user", async () => {
      const otherUser = await seedUser({ id: "other-user" });
      await expect(service.listLinkedFolders(otherUser.id, projectId)).rejects.toThrow("not found");
    });

    it("throws NOT_FOUND for non-existent project", async () => {
      await expect(service.listLinkedFolders(userId, "nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("unlinkFolder", () => {
    it("deletes the linked folder row", async () => {
      const folder = await seedLinkedFolder(projectId, connectionId);

      await service.unlinkFolder(userId, projectId, folder.id);

      const folders = await service.listLinkedFolders(userId, projectId);
      expect(folders).toHaveLength(0);
    });

    it("does NOT archive source_materials when unlinking", async () => {
      const folder = await seedLinkedFolder(projectId, connectionId);

      // Add a source document associated with this connection
      await seedSource(projectId, {
        driveFileId: "doc-in-folder",
        title: "Doc in folder",
      });

      await service.unlinkFolder(userId, projectId, folder.id);

      // Source should still be active
      const sources = await env.DB.prepare(
        `SELECT status FROM source_materials WHERE project_id = ? AND drive_file_id = 'doc-in-folder'`,
      )
        .bind(projectId)
        .first<{ status: string }>();
      expect(sources?.status).toBe("active");
    });

    it("throws NOT_FOUND for non-existent folder", async () => {
      await expect(service.unlinkFolder(userId, projectId, "nonexistent")).rejects.toThrow(
        "not found",
      );
    });

    it("throws NOT_FOUND for wrong project", async () => {
      const folder = await seedLinkedFolder(projectId, connectionId);
      const otherProject = await seedProject(userId, { title: "Other" });

      await expect(service.unlinkFolder(userId, otherProject.id, folder.id)).rejects.toThrow(
        "not found",
      );
    });
  });
});
