-- Research clips: saved text snippets from AI results or source text selection.
-- Users can tag clips with a chapter for organization.
CREATE TABLE IF NOT EXISTS research_clips (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  source_id TEXT REFERENCES source_materials(id) ON DELETE SET NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  source_title TEXT NOT NULL,
  snippet_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_research_clips_project ON research_clips(project_id);
CREATE INDEX idx_research_clips_user ON research_clips(user_id);
CREATE INDEX idx_research_clips_chapter ON research_clips(chapter_id);
CREATE INDEX idx_research_clips_created ON research_clips(created_at);
-- Deduplication: same user cannot save the exact same text for the same project
CREATE UNIQUE INDEX idx_research_clips_dedup
  ON research_clips(project_id, user_id, content_hash);
