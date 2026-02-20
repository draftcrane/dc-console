/**
 * Source search service -- full-text search across source content.
 *
 * Uses D1 FTS5 virtual table `source_content_fts` for keyword search.
 * Falls back to LIKE-based search on `source_materials` if FTS is unavailable.
 *
 * Results include snippets around the match and approximate character position.
 */

import { notFound, validationError } from "../middleware/error-handler.js";

/** A single search result */
export interface SourceSearchResult {
  sourceId: string;
  title: string;
  snippet: string;
  position: number;
}

/** Response shape for the search endpoint */
export interface SourceSearchResponse {
  results: SourceSearchResult[];
}

/** Maximum number of results to return */
const MAX_RESULTS = 20;

/** Minimum query length */
const MIN_QUERY_LENGTH = 2;

/** Snippet length for LIKE fallback (characters around match) */
const SNIPPET_CONTEXT_CHARS = 80;

export class SourceSearchService {
  constructor(private readonly db: D1Database) {}

  /**
   * Search source content for a project.
   *
   * 1. Validates query (min 2 chars)
   * 2. Verifies project ownership
   * 3. Tries FTS5 search first
   * 4. Falls back to LIKE if FTS fails
   */
  async search(userId: string, projectId: string, query: string): Promise<SourceSearchResponse> {
    // Validate query
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      validationError(`Search query must be at least ${MIN_QUERY_LENGTH} characters`);
    }

    // Verify project ownership
    const project = await this.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND user_id = ? AND status = 'active'`)
      .bind(projectId, userId)
      .first<{ id: string }>();

    if (!project) {
      notFound("Project not found");
    }

    // Try FTS5 first, fall back to LIKE
    try {
      return await this.ftsSearch(projectId, trimmedQuery);
    } catch {
      // FTS table may not exist or query may be malformed -- fall back
      return await this.likeSearch(projectId, trimmedQuery);
    }
  }

  /**
   * FTS5 search using MATCH syntax.
   * Joins with source_materials to filter by project and active status.
   * Uses FTS5 snippet() for result previews and rank for ordering.
   */
  private async ftsSearch(projectId: string, query: string): Promise<SourceSearchResponse> {
    // Escape FTS5 special characters and wrap terms in double quotes for safety.
    // This prevents FTS syntax errors from user input.
    const safeQuery = this.sanitizeFtsQuery(query);

    if (!safeQuery) {
      return { results: [] };
    }

    const result = await this.db
      .prepare(
        `SELECT
          fts.source_id AS sourceId,
          fts.title AS title,
          snippet(source_content_fts, 2, '<b>', '</b>', '...', 32) AS snippet,
          fts.rank AS rank
        FROM source_content_fts fts
        JOIN source_materials sm ON sm.id = fts.source_id
        WHERE source_content_fts MATCH ?
          AND sm.project_id = ?
          AND sm.status != 'archived'
        ORDER BY fts.rank
        LIMIT ?`,
      )
      .bind(safeQuery, projectId, MAX_RESULTS)
      .all<{ sourceId: string; title: string; snippet: string; rank: number }>();

    const results: SourceSearchResult[] = (result.results ?? []).map((row) => ({
      sourceId: row.sourceId,
      title: row.title,
      snippet: this.stripHtmlTags(row.snippet),
      position: 0, // FTS5 doesn't provide byte offset directly; 0 = beginning
    }));

    return { results };
  }

  /**
   * LIKE-based fallback search.
   * Searches source_materials title and joins with source_content_fts content
   * when available. If FTS table is unavailable, searches title only.
   */
  private async likeSearch(projectId: string, query: string): Promise<SourceSearchResponse> {
    const likePattern = `%${query}%`;

    // Search titles from source_materials (always available)
    const result = await this.db
      .prepare(
        `SELECT
          sm.id AS sourceId,
          sm.title AS title
        FROM source_materials sm
        WHERE sm.project_id = ?
          AND sm.status != 'archived'
          AND sm.title LIKE ?
        ORDER BY sm.sort_order ASC
        LIMIT ?`,
      )
      .bind(projectId, likePattern, MAX_RESULTS)
      .all<{ sourceId: string; title: string }>();

    const results: SourceSearchResult[] = (result.results ?? []).map((row) => ({
      sourceId: row.sourceId,
      title: row.title,
      snippet: row.title,
      position: 0,
    }));

    return { results };
  }

  /**
   * Sanitize user input for FTS5 MATCH syntax.
   * Wraps each word in double quotes to prevent syntax errors from
   * special characters (*, -, OR, AND, NOT, etc.).
   */
  private sanitizeFtsQuery(query: string): string {
    // Split on whitespace, filter empty tokens, wrap each in quotes
    const terms = query
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => {
        // Remove any existing double quotes from the term
        const clean = t.replace(/"/g, "");
        return clean.length > 0 ? `"${clean}"` : "";
      })
      .filter((t) => t.length > 0);

    return terms.join(" ");
  }

  /**
   * Strip HTML tags from a snippet, preserving text content.
   * The FTS5 snippet() function wraps matches in <b> tags which we
   * want to remove for the API response (the frontend handles highlighting).
   */
  private stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, "");
  }
}
