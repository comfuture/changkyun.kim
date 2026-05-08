CREATE TABLE IF NOT EXISTS activitypub_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id TEXT,
  article_id TEXT NOT NULL,
  article_path TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  published_at TEXT NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_activitypub_reactions_article_actor ON activitypub_reactions(article_path, actor_id);
CREATE INDEX IF NOT EXISTS ix_activitypub_reactions_article_reaction ON activitypub_reactions(article_path, reaction);
CREATE INDEX IF NOT EXISTS ix_activitypub_reactions_actor ON activitypub_reactions(actor_id);
CREATE INDEX IF NOT EXISTS ix_activitypub_reactions_activity_id ON activitypub_reactions(activity_id);
