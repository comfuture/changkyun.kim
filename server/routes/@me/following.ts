import { me, setJsonLdHeader } from "../../utils/federation"

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows } = await db.sql`SELECT actor_id, activity_payload FROM following WHERE status IN ('accepted', 'requested') ORDER BY updated_at DESC`

  const orderedItems = rows?.map((row) => {
    const payload = typeof row?.activity_payload === 'string' ? row.activity_payload : null
    if (payload) {
      try {
        return JSON.parse(payload)
      } catch {
        // ignore parsing error and fall back to actor URI
      }
    }
    return row?.actor_id as string
  }).filter(Boolean) ?? []

  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://changkyun.kim/@me/following',
    type: 'OrderedCollection',
    totalItems: orderedItems.length,
    orderedItems,
  }
})