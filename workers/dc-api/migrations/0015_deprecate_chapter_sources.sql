-- Migration 0015: Deprecate chapter_sources table (#181)
--
-- The chapter_sources table (created in 0012) is deprecated as of this migration.
-- Chapter-source linking has been removed from the application:
--   - API endpoints removed (GET/POST/DELETE /chapters/:chapterId/sources[/:sourceId/link])
--   - Frontend hook (useChapterSources) and Link/Unlink UI removed
--   - No new writes will be made to this table
--
-- The table is intentionally NOT dropped to preserve data integrity during a
-- 90-day rollback window. After 90 days (target: 2026-05-21), a follow-up
-- migration should DROP the table and its indexes.
--
-- Existing data in chapter_sources remains as-is for reference/rollback.
--
-- Design reference: docs/design/source-review/design-spec.md, Section 8
-- Decision reference: docs/design/source-review/design-spec.md, Section 11, Decision 2

-- No-op migration (documentation only). SQLite requires at least one statement.
SELECT 1;
