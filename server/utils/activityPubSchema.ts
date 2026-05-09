let schemaPromise: Promise<void> | null = null

function isDuplicateColumnError(error: unknown): boolean {
  return error instanceof Error && /duplicate column name/i.test(error.message)
}

async function addReactionActorProfileColumns() {
  const db = useDatabase()
  try {
    await db.sql`ALTER TABLE activitypub_reactions ADD COLUMN actor_name TEXT;`
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error
    }
  }
  try {
    await db.sql`ALTER TABLE activitypub_reactions ADD COLUMN actor_url TEXT;`
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error
    }
  }
  try {
    await db.sql`ALTER TABLE activitypub_reactions ADD COLUMN actor_icon_url TEXT;`
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error
    }
  }
}

async function runActivityPubSchema() {
  const db = useDatabase()

  await db.sql`CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id TEXT NOT NULL,
    actor_id TEXT,
    type TEXT,
    object TEXT,
    payload TEXT,
    direction TEXT NOT NULL DEFAULT 'inbox',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_activity_activity_id ON activity(activity_id);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activity_direction_type ON activity(direction, type);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activity_actor_direction ON activity(actor_id, direction);`

  await db.sql`CREATE TABLE IF NOT EXISTS followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    activity_id TEXT,
    activity_payload TEXT,
    status TEXT NOT NULL DEFAULT 'accepted',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_followers_actor_id ON followers(actor_id);`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_followers_activity_id ON followers(activity_id) WHERE activity_id IS NOT NULL;`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_followers_status ON followers(status);`

  await db.sql`CREATE TABLE IF NOT EXISTS following (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    activity_id TEXT,
    activity_payload TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_following_actor_id ON following(actor_id);`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_following_activity_id ON following(activity_id) WHERE activity_id IS NOT NULL;`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_following_status ON following(status);`

  await db.sql`CREATE TABLE IF NOT EXISTS actor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT,
    private_key TEXT,
    public_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_actor_actor_id ON actor(actor_id);`

  await db.sql`CREATE TABLE IF NOT EXISTS content_delivery_state (
    collection TEXT PRIMARY KEY,
    last_document_path TEXT,
    last_document_id TEXT,
    last_article_url TEXT,
    last_activity_id TEXT,
    last_published_at TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`

  await db.sql`CREATE TABLE IF NOT EXISTS activitypub_comments (
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
    published_at TEXT NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'visible',
    payload TEXT
  );`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_activitypub_comments_object_id ON activitypub_comments(object_id);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_comments_article_status ON activitypub_comments(article_path, status, published_at);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_comments_actor ON activitypub_comments(actor_id);`

  await db.sql`CREATE TABLE IF NOT EXISTS activitypub_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id TEXT,
    article_id TEXT NOT NULL,
    article_path TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    actor_url TEXT,
    actor_icon_url TEXT,
    reaction TEXT NOT NULL,
    reaction_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    published_at TEXT NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload TEXT
  );`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_activitypub_reactions_article_actor ON activitypub_reactions(article_path, actor_id);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_reactions_article_reaction ON activitypub_reactions(article_path, reaction);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_reactions_actor ON activitypub_reactions(actor_id);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_reactions_activity_id ON activitypub_reactions(activity_id);`
  await addReactionActorProfileColumns()

  await db.sql`CREATE TABLE IF NOT EXISTS activitypub_feed_actors (
    actor_id TEXT PRIMARY KEY,
    actor_name TEXT,
    actor_url TEXT,
    actor_icon_url TEXT,
    relation TEXT NOT NULL DEFAULT 'unknown',
    last_crawled_at TEXT,
    last_seen_object_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_feed_actors_relation ON activitypub_feed_actors(relation, updated_at);`

  await db.sql`CREATE TABLE IF NOT EXISTS activitypub_feed_posts (
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
  );`
  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_activitypub_feed_posts_object_id ON activitypub_feed_posts(object_id);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_feed_posts_actor_published ON activitypub_feed_posts(actor_id, published_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS ix_activitypub_feed_posts_published ON activitypub_feed_posts(published_at DESC);`
}

export async function ensureActivityPubSchema() {
  if (!schemaPromise) {
    schemaPromise = runActivityPubSchema().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  return await schemaPromise
}
