import { me, setJsonLdHeader } from "../../utils/federation"

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows } = await db.sql`SELECT actor_id, activity_payload FROM followers WHERE status = 'accepted' ORDER BY updated_at DESC`
  const orderedItems = rows?.map((row) => {
    const payload = typeof row?.activity_payload === 'string' ? row.activity_payload : null
    if (payload) {
      try {
        return JSON.parse(payload)
      } catch {
        // fall back to actor URI below
      }
    }
    const actorId = row?.actor_id as string | null
    return actorId || null
  }).filter(Boolean) ?? []
  const totalItems = orderedItems.length
  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://changkyun.kim/@me/followers',
    type: 'OrderedCollection',
    totalItems,
    orderedItems,
  }
})
