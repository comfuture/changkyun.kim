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
        // ignore parse errors and fall back to a minimal follow activity below
      }
    }
    const actorId = row?.actor_id as string | null
    if (!actorId) {
      return null
    }
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      actor: actorId,
      object: me.id,
    }
  }).filter((value): value is Activity => Boolean(value)) ?? []

  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: me.inbox,
    type: 'OrderedCollection',
    totalItems: orderedItems.length,
    orderedItems,
  }
})
