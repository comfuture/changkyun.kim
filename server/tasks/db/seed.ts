import { generateRsaKeyPair } from "../../utils/auth"

export default defineTask({
  meta: {
    name: 'db:seed',
    description: 'Initialize and insert the database with initial data',
  },
  async run(event) {
    const db = useDatabase()

    // Drop existing tables so we can recreate them with the latest schema
    await db.sql`DROP TABLE IF EXISTS activity;`
    await db.sql`DROP TABLE IF EXISTS followers;`
    await db.sql`DROP TABLE IF EXISTS following;`
    await db.sql`DROP TABLE IF EXISTS actor;`

    // Activity queue table for inbound/outbound ActivityPub messages
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
    console.info('Created activity table and indexes')

    // Followers table to track remote actors following the local account
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
    console.info('Created followers table and indexes')

    // Following table to track remote actors followed by the local account
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
    console.info('Created following table and indexes')

    await db.sql`CREATE TABLE IF NOT EXISTS actor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      private_key TEXT,
      public_key TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
    await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_actor_actor_id ON actor(actor_id);`
    console.info('Created actor table and index')

    // Insert initial data
    const { publicKey, privateKey } = generateRsaKeyPair()
    try {
      await db.sql`INSERT INTO actor (actor_id, private_key, public_key) VALUES (
        ${'https://changkyun.kim/@me'},
        ${privateKey},
        ${publicKey}
      );`
    } catch (error) {
      console.info('Actor already exists, skipping insert')
      return { result: true }
    }
    console.info('Database seeded successfully!')
    return { result: true }
  }
})