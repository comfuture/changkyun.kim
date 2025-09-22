import { me, setJsonLdHeader } from "../../utils/federation"

function parseQueuedActivity(row: any): Activity | null {
  const payload = typeof row?.payload === 'string' ? row.payload : null
  if (payload) {
    try {
      const activity = JSON.parse(payload) as Activity | null
      if (activity && typeof activity === 'object') {
        return activity
      }
    } catch (error) {
      console.warn('Failed to parse stored inbox activity payload', error)
    }
  }

  const activityId = typeof row?.activity_id === 'string' && row.activity_id
    ? row.activity_id
    : null
  const actorId = typeof row?.actor_id === 'string' && row.actor_id
    ? row.actor_id
    : null

  if (!activityId || !actorId) {
    return null
  }

  const type = typeof row?.type === 'string' && row.type
    ? row.type
    : null

  if (!type) {
    return null
  }

  const activity: Activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: activityId,
    type: type as Activity['type'],
    actor: actorId,
  }

  if (typeof row?.object === 'string' && row.object) {
    activity.object = row.object
  }

  return activity
}

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows } = await db.sql`SELECT activity_id, actor_id, type, object, payload FROM activity WHERE direction = 'inbox' ORDER BY created_at DESC`

  const orderedItems = rows?.map(parseQueuedActivity).filter((value): value is Activity => Boolean(value)) ?? []

  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: me.inbox,
    type: 'OrderedCollection',
    totalItems: orderedItems.length,
    orderedItems,
  }
})
