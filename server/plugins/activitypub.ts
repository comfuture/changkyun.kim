import {
  buildCreateActivityFromEntry,
  resolveLegacyActivityIds,
  type ContentEntry,
} from "../utils/outboxHelpers"

const FEDERATED_COLLECTIONS = new Set(['/blog/', '/app/'])

function isFederatedDocument(document: Record<string, any>): boolean {
  const path = (document?.path || document?._path || '') as string
  if (!path || document?.draft) {
    return false
  }
  return Array.from(FEDERATED_COLLECTIONS).some((prefix) => path.startsWith(prefix))
}

async function broadcastDocument(document: ContentEntry) {
  const activity = await buildCreateActivityFromEntry(document)
  if (!activity) {
    return
  }

  const db = useDatabase()

  const actorId = typeof activity.actor === 'string'
    ? activity.actor
    : (activity.actor as { id?: string | null })?.id ?? null

  const objectId = typeof activity.object === 'string'
    ? activity.object
    : Array.isArray(activity.object)
      ? null
      : (activity.object as { id?: string | null })?.id ?? null
  const legacyActivityIds = objectId ? resolveLegacyActivityIds(objectId, document) : []

  try {
    const { rows } = await db.sql`SELECT 1 FROM activity WHERE activity_id = ${activity.id} AND direction = 'outbox' LIMIT 1`
    if (rows && rows.length) {
      return
    }

    for (const legacyId of legacyActivityIds) {
      const { rows: legacyRows } = await db.sql`SELECT 1 FROM activity WHERE activity_id = ${legacyId} AND direction = 'outbox' LIMIT 1`
      if (legacyRows && legacyRows.length) {
        const payload = JSON.stringify(activity)
        try {
          await db.sql`UPDATE activity
            SET activity_id = ${activity.id}, actor_id = ${actorId}, object = ${objectId}, payload = ${payload}, direction = 'outbox'
            WHERE activity_id = ${legacyId}`
          return
        } catch (updateError) {
          console.error('Failed to update legacy ActivityPub identifier', updateError)
          break
        }
      }
    }
  } catch (error) {
    console.error('Failed checking existing ActivityPub activity', error)
    return
  }

  try {
    await runTask('ap:broadcastCreate', {
      payload: { activity },
    })
  } catch (error) {
    console.error('Failed to schedule ActivityPub broadcast for content document', error)
  }
}

export default defineNitroPlugin((nitroApp) => {
  const handleContentUpdate = async (document: ContentEntry) => {
    if (!isFederatedDocument(document)) {
      return
    }
    await broadcastDocument(document)
  }

  nitroApp.hooks.hook('content:file:afterInsert', handleContentUpdate)
  nitroApp.hooks.hook('content:file:afterUpdate', handleContentUpdate)
})
