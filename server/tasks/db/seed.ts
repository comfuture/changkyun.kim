export default defineTask({
  meta: {
    name: 'db:seed',
    description: 'Initialize and insert the database with initial data',
  },
  async run(event) {
    const db = useDatabase()

    // Create the database and tables
    await db.sql`CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id TEXT,
      actor_id TEXT,
      type TEXT,
      object TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
    await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_activity_activity_id ON activity(activity_id);`
    await db.sql`CREATE INDEX IF NOT EXISTS ix_activity_actor_id_type ON activity(actor_id, type);`
    console.info('Created activity table and index')

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