-- Add tier column to ai_interactions for multi-tier AI tracking (edge vs frontier)
ALTER TABLE ai_interactions ADD COLUMN tier TEXT NOT NULL DEFAULT 'frontier';
