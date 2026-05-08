CREATE TABLE IF NOT EXISTS activitypub_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id TEXT NOT NULL,
  activity_id TEXT,
  article_id TEXT NOT NULL,
  article_path TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  actor_url TEXT,
  actor_icon_url TEXT,
  content_text TEXT NOT NULL,
  content_html TEXT,
  url TEXT,
  published_at TEXT,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'visible',
  payload TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_activitypub_comments_object_id ON activitypub_comments(object_id);
CREATE INDEX IF NOT EXISTS ix_activitypub_comments_article_status ON activitypub_comments(article_path, status, published_at);
CREATE INDEX IF NOT EXISTS ix_activitypub_comments_actor ON activitypub_comments(actor_id);
