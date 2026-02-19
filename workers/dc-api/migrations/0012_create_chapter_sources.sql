-- Chapter-source junction: many-to-many linking with soft-delete.
-- Soft-delete allows reconnecting same account to restore links.

CREATE TABLE chapter_sources (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES source_materials(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX idx_chapter_sources_pair ON chapter_sources(chapter_id, source_id);
CREATE INDEX idx_chapter_sources_chapter ON chapter_sources(chapter_id);
CREATE INDEX idx_chapter_sources_source ON chapter_sources(source_id);
