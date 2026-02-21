-- Migration number: 0020 	 2026-02-21T22:00:00.000Z

CREATE TABLE ai_instructions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  instruction_text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('analysis', 'rewrite')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_instructions_user_id_type ON ai_instructions(user_id, type);

-- Seed with default instructions for all existing users
INSERT INTO ai_instructions (id, user_id, label, instruction_text, type)
SELECT
  'instr_' || substr(hex(randomblob(16)), 1, 32),
  u.id,
  'Simpler language',
  'Rewrite the following text to use simpler, more accessible language, as if explaining it to a high school student.',
  'rewrite'
FROM users u;

INSERT INTO ai_instructions (id, user_id, label, instruction_text, type)
SELECT
  'instr_' || substr(hex(randomblob(16)), 1, 32),
  u.id,
  'More concise',
  'Rewrite the following text to be more concise and to the point, removing any unnecessary words or phrases.',
  'rewrite'
FROM users u;

INSERT INTO ai_instructions (id, user_id, label, instruction_text, type)
SELECT
  'instr_' || substr(hex(randomblob(16)), 1, 32),
  u.id,
  'Summarize',
  'Provide a concise, one-paragraph summary of the following document.',
  'analysis'
FROM users u;

INSERT INTO ai_instructions (id, user_id, label, instruction_text, type)
SELECT
  'instr_' || substr(hex(randomblob(16)), 1, 32),
  u.id,
  'Find key points',
  'Extract the key points or main arguments from the following document as a bulleted list.',
  'analysis'
FROM users u;
