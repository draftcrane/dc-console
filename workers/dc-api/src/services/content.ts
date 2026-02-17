import { notFound, conflict } from "../middleware/error-handler.js";

/**
 * ContentService - Manages chapter content storage (Tier 2 & 3 of auto-save).
 *
 * Per US-015 (Three-Tier Save Architecture):
 * - Tier 2: Content stored in R2 (or Google Drive if connected)
 * - Tier 3: Metadata (word_count, version, updated_at) stored in D1
 *
 * R2 key format: chapters/{chapterId}/content.html
 * No content is stored in D1 - only metadata.
 */

interface ChapterOwnershipRow {
  id: string;
  project_id: string;
  version: number;
  r2_key: string | null;
}

interface SaveContentInput {
  content: string;
  version: number;
}

interface SaveContentResult {
  version: number;
  wordCount: number;
  updatedAt: string;
}

interface GetContentResult {
  content: string;
  version: number;
}

export class ContentService {
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket,
  ) {}

  /**
   * Save chapter content to R2 and update D1 metadata.
   *
   * Per US-015:
   * - PUT content to R2
   * - Update D1: word_count, version (incremented), updated_at
   * - 409 CONFLICT if version mismatch (optimistic locking)
   *
   * @param userId - Authenticated user ID
   * @param chapterId - Chapter to save content for
   * @param input - Content and expected version
   * @returns Updated metadata
   */
  async saveContent(
    userId: string,
    chapterId: string,
    input: SaveContentInput,
  ): Promise<SaveContentResult> {
    // Verify ownership and get current version
    const chapter = await this.db
      .prepare(
        `SELECT ch.id, ch.project_id, ch.version, ch.r2_key
         FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<ChapterOwnershipRow>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    // Version conflict detection (optimistic locking)
    // Per US-015: 409 response from API when version mismatch
    if (input.version !== chapter.version) {
      conflict(
        `Version mismatch: expected ${chapter.version}, got ${input.version}. ` +
          `Another save may have occurred.`,
      );
    }

    const newVersion = chapter.version + 1;
    const now = new Date().toISOString();
    const wordCount = countWords(input.content);
    const r2Key = `chapters/${chapterId}/content.html`;

    // Tier 2: Write content to R2 (fast cache per ADR-005)
    // Drive write-through is handled at the route layer (chapters.ts PUT handler)
    // with 30s coalescing to avoid hammering Google API on 2s auto-save cadence.
    await this.bucket.put(r2Key, input.content, {
      httpMetadata: {
        contentType: "text/html; charset=utf-8",
      },
      customMetadata: {
        chapterId,
        version: String(newVersion),
        updatedAt: now,
      },
    });

    // Tier 3: Update D1 metadata (no content stored in D1)
    await this.db
      .prepare(
        `UPDATE chapters
         SET word_count = ?, version = ?, r2_key = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(wordCount, newVersion, r2Key, now, chapterId)
      .run();

    // Update project updated_at
    await this.db
      .prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`)
      .bind(now, chapter.project_id)
      .run();

    return {
      version: newVersion,
      wordCount,
      updatedAt: now,
    };
  }

  /**
   * Get chapter content from R2.
   *
   * @param userId - Authenticated user ID
   * @param chapterId - Chapter to get content for
   * @returns Content and current version
   */
  async getContent(userId: string, chapterId: string): Promise<GetContentResult> {
    // Verify ownership
    const chapter = await this.db
      .prepare(
        `SELECT ch.id, ch.version, ch.r2_key
         FROM chapters ch
         JOIN projects p ON p.id = ch.project_id
         WHERE ch.id = ? AND p.user_id = ?`,
      )
      .bind(chapterId, userId)
      .first<{ id: string; version: number; r2_key: string | null }>();

    if (!chapter) {
      notFound("Chapter not found");
    }

    // If no r2_key set yet, return empty content
    if (!chapter.r2_key) {
      return {
        content: "",
        version: chapter.version,
      };
    }

    // Read from R2
    const object = await this.bucket.get(chapter.r2_key);
    if (!object) {
      // R2 object missing but metadata exists - return empty
      return {
        content: "",
        version: chapter.version,
      };
    }

    const content = await object.text();

    return {
      content,
      version: chapter.version,
    };
  }
}

/**
 * Count words in HTML content.
 * Strips HTML tags and counts whitespace-separated words.
 */
function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text.split(" ").length : 0;
}
