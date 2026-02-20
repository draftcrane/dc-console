-- FTS5 virtual table for full-text search across source content.
-- Populated after text extraction (local upload or Drive fetch).
-- Used for keyword search in the Sources tab.
-- Rebuilt on content refresh.

CREATE VIRTUAL TABLE source_content_fts USING fts5(
  source_id,
  title,
  content,
  tokenize='porter unicode61'
);
