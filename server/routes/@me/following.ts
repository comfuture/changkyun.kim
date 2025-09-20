import { me, setJsonLdHeader } from "../../utils/federation"

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows: following } = await db.sql`SELECT activity_id, object, payload FROM activity WHERE actor_id = ${me.id} AND type = 'Follow' ORDER BY created_at DESC`

  const orderedItems = following?.map((row) => {
    if (typeof row?.payload === 'string') {
      try {
        return JSON.parse(row.payload)
      } catch {
        // ignore parsing error and fall back to object URI
      }
    }
    return row?.object as string
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