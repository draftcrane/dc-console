-- Migration 0016: Create research_clips table (#195)
--
-- Research clips are user-saved snippets from source materials, linked to
-- a project and optionally to a specific chapter. They support the Research
-- Panel workflow where users highlight/save content from source documents.
--
-- Deduplication: A unique partial index prevents duplicate clips with the
-- same content + source within a project (source_id IS NOT NULL case).

CREATE TABLE research_clips (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES source_materials(id) ON DELETE SET NULL,
  source_title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_location TEXT,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_research_clips_project ON research_clips(project_id);
CREATE INDEX idx_research_clips_source ON research_clips(source_id);
CREATE INDEX idx_research_clips_chapter ON research_clips(chapter_id);

-- Dedup: same content + source within a project
CREATE UNIQUE INDEX idx_research_clips_dedup
  ON research_clips(project_id, source_id, content)
  WHERE source_id IS NOT NULL;
