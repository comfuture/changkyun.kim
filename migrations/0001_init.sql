CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id TEXT NOT NULL,
  actor_id TEXT,
  type TEXT,
  object TEXT,
  payload TEXT,
  direction TEXT NOT NULL DEFAULT 'inbox',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_activity_activity_id ON activity(activity_id);
CREATE INDEX IF NOT EXISTS ix_activity_direction_type ON activity(direction, type);
CREATE INDEX IF NOT EXISTS ix_activity_actor_direction ON activity(actor_id, direction);

CREATE TABLE IF NOT EXISTS followers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  activity_id TEXT,
  activity_payload TEXT,
  status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_followers_actor_id ON followers(actor_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_followers_activity_id ON followers(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_followers_status ON followers(status);

CREATE TABLE IF NOT EXISTS following (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  activity_id TEXT,
  activity_payload TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_following_actor_id ON following(actor_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_following_activity_id ON following(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_following_status ON following(status);

CREATE TABLE IF NOT EXISTS actor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  private_key TEXT,
  public_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_actor_actor_id ON actor(actor_id);

CREATE TABLE IF NOT EXISTS content_delivery_state (
  collection TEXT PRIMARY KEY,
  last_document_path TEXT,
  last_document_id TEXT,
  last_article_url TEXT,
  last_activity_id TEXT,
  last_published_at TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
