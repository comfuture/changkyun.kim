CREATE TABLE IF NOT EXISTS bluesky_shares (
  source_activity_id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  record_key TEXT NOT NULL,
  record_json TEXT NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  at_uri TEXT,
  cid TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  posted_at TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('pending', 'posted', 'conflict'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_bluesky_shares_record_key ON bluesky_shares(record_key);
CREATE INDEX IF NOT EXISTS ix_bluesky_shares_pending ON bluesky_shares(status, next_attempt_at);
