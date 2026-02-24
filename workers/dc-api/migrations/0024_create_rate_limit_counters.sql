-- Atomic per-window counters for API rate limiting.
-- Key format: ratelimit:{prefix}:{userId}:{windowBucket}
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  counter_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  expires_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_expires_at_ms
  ON rate_limit_counters(expires_at_ms);
