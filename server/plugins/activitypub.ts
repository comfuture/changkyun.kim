import { buildCreateActivityFromEntry, type ContentEntry } from "../utils/outboxHelpers"

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

  try {
    const db = useDatabase()
    const { rows } = await db.sql`SELECT 1 FROM activity WHERE activity_id = ${activity.id} LIMIT 1`
    if (rows && rows.length) {
      return
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
