CREATE TABLE IF NOT EXISTS activitypub_feed_actors (
  actor_id TEXT PRIMARY KEY,
  actor_name TEXT,
  actor_url TEXT,
  actor_icon_url TEXT,
  relation TEXT NOT NULL DEFAULT 'unknown',
  last_crawled_at TEXT,
  last_seen_object_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_activitypub_feed_actors_relation ON activitypub_feed_actors(relation, updated_at);

CREATE TABLE IF NOT EXISTS activitypub_feed_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id TEXT NOT NULL,
  activity_id TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_url TEXT NOT NULL,
  actor_icon_url TEXT,
  object_type TEXT NOT NULL,
  name TEXT,
  summary TEXT,
  content_text TEXT NOT NULL,
  content_html TEXT,
  url TEXT,
  published_at TEXT NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL DEFAULT 'inbox',
  visibility TEXT NOT NULL DEFAULT 'public',
  payload TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_activitypub_feed_posts_object_id ON activitypub_feed_posts(object_id);
CREATE INDEX IF NOT EXISTS ix_activitypub_feed_posts_actor_published ON activitypub_feed_posts(actor_id, published_at DESC);
CREATE INDEX IF NOT EXISTS ix_activitypub_feed_posts_published ON activitypub_feed_posts(published_at DESC);
