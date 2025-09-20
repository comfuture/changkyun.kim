import { me, setJsonLdHeader } from "../../utils/federation"

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows } = await db.sql`SELECT activity_id, payload, actor_id, type, object FROM activity WHERE type != 'Create' AND (object = ${me.id} OR actor_id != ${me.id}) ORDER BY created_at DESC`

  const orderedItems = rows?.map((row) => {
    if (typeof row?.payload === 'string') {
      try {
        return JSON.parse(row.payload)
      } catch {
        // fall back to minimal activity representation
      }
    }
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: row?.activity_id,
      type: row?.type ?? 'Follow',
      actor: row?.actor_id,
      object: row?.object,
    }
  }).filter(Boolean) ?? []

  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: me.inbox,
    type: 'OrderedCollection',
    totalItems: orderedItems.length,
    orderedItems,
  }
})
