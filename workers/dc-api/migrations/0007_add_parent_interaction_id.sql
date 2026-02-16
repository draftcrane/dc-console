-- Link retry attempts to their original interaction for proper attempt tracking.
-- parent_interaction_id references the first interaction in a retry chain.
ALTER TABLE ai_interactions ADD COLUMN parent_interaction_id TEXT REFERENCES ai_interactions(id);

CREATE INDEX idx_ai_interactions_parent ON ai_interactions(parent_interaction_id);
