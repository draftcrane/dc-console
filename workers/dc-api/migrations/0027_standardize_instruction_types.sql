-- Migration number: 0027 	 2026-02-24T00:00:00.000Z
-- Standardize AI instruction types: analysis/rewrite → desk/book/chapter
-- Add last_used_at column for recents tracking

-- 1. Create new table with updated type constraint and last_used_at
CREATE TABLE ai_instructions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  instruction_text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('desk', 'book', 'chapter')),
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Migrate existing rows with type mapping
INSERT INTO ai_instructions_new (id, user_id, label, instruction_text, type, created_at, updated_at)
SELECT id, user_id, label, instruction_text,
  CASE type
    WHEN 'analysis' THEN 'desk'
    WHEN 'rewrite' THEN 'chapter'
  END,
  created_at, updated_at
FROM ai_instructions;

-- 3. Swap tables
DROP TABLE ai_instructions;
ALTER TABLE ai_instructions_new RENAME TO ai_instructions;

-- 4. Recreate original index with new type values
CREATE INDEX idx_ai_instructions_user_id_type ON ai_instructions(user_id, type);

-- 5. Add recents index
CREATE INDEX idx_ai_instructions_last_used ON ai_instructions(user_id, last_used_at DESC);
