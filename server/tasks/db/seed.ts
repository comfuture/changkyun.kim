import { generateRsaKeyPair } from "../../utils/auth"
import { ensureActivityPubSchema } from "../../utils/activityPubSchema"

export default defineTask({
  meta: {
    name: 'db:seed',
    description: 'Initialize and insert the database with initial data',
  },
  async run(_event) {
    await ensureActivityPubSchema()
    const db = useDatabase()
    console.info('Ensured ActivityPub database schema')

    // Insert initial data
    const { publicKey, privateKey } = generateRsaKeyPair()
    try {
      await db.sql`INSERT INTO actor (actor_id, private_key, public_key) VALUES (
        ${'https://changkyun.kim/@me'},
        ${privateKey},
        ${publicKey}
      );`
    } catch {
      console.info('Actor already exists, skipping insert')
      return { result: true }
    }
    console.info('Database seeded successfully!')
    return { result: true }
  }
})
