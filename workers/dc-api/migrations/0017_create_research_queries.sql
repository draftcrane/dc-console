-- Research queries: logs query metadata for analytics and rate limiting context.
-- AI responses are ephemeral (not stored). Only query metadata is persisted.
CREATE TABLE IF NOT EXISTS research_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  query TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'frontier',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'error')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_research_queries_user_id ON research_queries(user_id);
CREATE INDEX idx_research_queries_project_id ON research_queries(project_id);
CREATE INDEX idx_research_queries_created_at ON research_queries(created_at);
