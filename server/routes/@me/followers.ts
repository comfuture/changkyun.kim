import { me, setJsonLdHeader } from "../../utils/federation"

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows: followers } = await db.sql`SELECT activity_id, actor_id, payload FROM activity WHERE object = ${me.id} AND type = 'Follow' ORDER BY created_at DESC`
  const orderedItems = followers?.map((row) => {
    if (typeof row?.payload === 'string') {
      try {
        return JSON.parse(row.payload)
      } catch {
        // fall back to actor URI
      }
    }
    return row?.actor_id as string
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
