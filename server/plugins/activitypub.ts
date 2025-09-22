import {
  buildCreateActivityFromEntry,
  resolveLegacyActivityIds,
  type ContentEntry,
} from "../utils/outboxHelpers"

const COLLECTION_PREFIXES = [
  { prefix: "/blog/", collection: "blog" },
  { prefix: "/app/", collection: "app" },
] as const

const FEDERATED_COLLECTIONS = new Set(COLLECTION_PREFIXES.map(({ prefix }) => prefix))

type DeliveryState = {
  collection: string
  lastDocumentPath: string | null
  lastDocumentId: string | null
  lastArticleUrl: string | null
  lastActivityId: string | null
  lastPublishedAt: string | null
}

type DatabaseClient = ReturnType<typeof useDatabase>

type BroadcastResult =
  | { status: "scheduled"; activity: CreateActivity }
  | { status: "duplicate"; activity: CreateActivity }
  | { status: "skipped" }

function resolveDocumentPath(document: Record<string, any>): string | null {
  const path = (document?.path || document?._path || document?.id || document?._id || "") as string
  if (!path) {
    return null
  }
  return path.startsWith("/") ? path : `/${path}`
}

function isFederatedDocument(document: Record<string, any>): boolean {
  const path = resolveDocumentPath(document)
  if (!path || document?.draft) {
    return false
  }
  for (const prefix of FEDERATED_COLLECTIONS) {
    if (path.startsWith(prefix)) {
      return true
    }
  }
  return false
}

function resolveCollectionFromDocument(document: Record<string, any>): string | null {
  const path = resolveDocumentPath(document)
  if (!path) {
    return null
  }
  for (const { prefix, collection } of COLLECTION_PREFIXES) {
    if (path.startsWith(prefix)) {
      return collection
    }
  }
  return null
}

function toTimestamp(value: string | Date | null | undefined): number {
  if (!value) {
    return 0
  }
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? 0 : time
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function compareEntries(a: ContentEntry, b: ContentEntry): number {
  const aTime = toTimestamp(a?.createdAt as string | Date | null)
  const bTime = toTimestamp(b?.createdAt as string | Date | null)
  if (aTime === bTime) {
    const aPath = resolveDocumentPath(a) ?? ""
    const bPath = resolveDocumentPath(b) ?? ""
    return aPath.localeCompare(bPath)
  }
  return aTime - bTime
}

function resolvePublishedInfo(entry: ContentEntry, activity: CreateActivity): { iso: string; timestamp: number } {
  let iso: string | null = null
  if (typeof activity.published === "string" && activity.published) {
    iso = activity.published
  } else if (activity.object && typeof activity.object === "object" && !Array.isArray(activity.object)) {
    const candidate = (activity.object as { published?: string | null }).published
    if (typeof candidate === "string" && candidate) {
      iso = candidate
    }
  }

  const entryCreatedAt = entry?.createdAt as string | Date | null | undefined
  if (!iso && entryCreatedAt) {
    if (entryCreatedAt instanceof Date) {
      iso = entryCreatedAt.toISOString()
    } else if (typeof entryCreatedAt === "string") {
      iso = entryCreatedAt
    }
  }

  if (!iso) {
    iso = new Date().toISOString()
  }

  let timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    timestamp = Date.now()
    iso = new Date(timestamp).toISOString()
  }

  return { iso, timestamp }
}

async function getDeliveryState(db: DatabaseClient, collection: string): Promise<DeliveryState | null> {
  try {
    const { rows } = await db.sql`
      SELECT
        collection,
        last_document_path,
        last_document_id,
        last_article_url,
        last_activity_id,
        last_published_at
      FROM content_delivery_state
      WHERE collection = ${collection}
      LIMIT 1
    `

    if (rows && rows.length) {
      const row = rows[0] as Record<string, any>
      return {
        collection: row.collection as string,
        lastDocumentPath: (row.last_document_path as string | null) ?? null,
        lastDocumentId: (row.last_document_id as string | null) ?? null,
        lastArticleUrl: (row.last_article_url as string | null) ?? null,
        lastActivityId: (row.last_activity_id as string | null) ?? null,
        lastPublishedAt: (row.last_published_at as string | null) ?? null,
      }
    }
  } catch (error) {
    console.error('Failed to read content delivery state', error)
  }

  return null
}

async function updateDeliveryState(db: DatabaseClient, state: DeliveryState): Promise<void> {
  try {
    await db.sql`
      INSERT INTO content_delivery_state (
        collection,
        last_document_path,
        last_document_id,
        last_article_url,
        last_activity_id,
        last_published_at,
        updated_at
      ) VALUES (
        ${state.collection},
        ${state.lastDocumentPath},
        ${state.lastDocumentId},
        ${state.lastArticleUrl},
        ${state.lastActivityId},
        ${state.lastPublishedAt},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(collection) DO UPDATE SET
        last_document_path = excluded.last_document_path,
        last_document_id = excluded.last_document_id,
        last_article_url = excluded.last_article_url,
        last_activity_id = excluded.last_activity_id,
        last_published_at = excluded.last_published_at,
        updated_at = CURRENT_TIMESTAMP
    `
  } catch (error) {
    console.error('Failed to update content delivery state', error)
  }
}

async function broadcastDocument(document: ContentEntry, preparedActivity?: CreateActivity | null): Promise<BroadcastResult> {
  const activity = preparedActivity ?? await buildCreateActivityFromEntry(document)
  if (!activity) {
    return { status: "skipped" }
  }

  const db = useDatabase()

  const actorId = typeof activity.actor === "string"
    ? activity.actor
    : (activity.actor as { id?: string | null })?.id ?? null

  const objectId = typeof activity.object === "string"
    ? activity.object
    : Array.isArray(activity.object)
      ? null
      : (activity.object as { id?: string | null })?.id ?? null
  const legacyActivityIds = objectId ? resolveLegacyActivityIds(objectId, document) : []

  try {
    const { rows } = await db.sql`SELECT 1 FROM activity WHERE activity_id = ${activity.id} AND direction = 'outbox' LIMIT 1`
    if (rows && rows.length) {
      return { status: "duplicate", activity }
    }

    for (const legacyId of legacyActivityIds) {
      const { rows: legacyRows } = await db.sql`SELECT 1 FROM activity WHERE activity_id = ${legacyId} AND direction = 'outbox' LIMIT 1`
      if (legacyRows && legacyRows.length) {
        const payload = JSON.stringify(activity)
        try {
          await db.sql`UPDATE activity
            SET activity_id = ${activity.id}, actor_id = ${actorId}, object = ${objectId}, payload = ${payload}, direction = 'outbox'
            WHERE activity_id = ${legacyId}`
          return { status: "duplicate", activity }
        } catch (updateError) {
          console.error('Failed to update legacy ActivityPub identifier', updateError)
          break
        }
      }
    }
  } catch (error) {
    console.error('Failed checking existing ActivityPub activity', error)
    return { status: "skipped" }
  }

  try {
    await runTask('ap:broadcastCreate', {
      payload: { activity },
    })
    return { status: "scheduled", activity }
  } catch (error) {
    console.error('Failed to schedule ActivityPub broadcast for content document', error)
    return { status: "skipped" }
  }
}

async function processCollection(collection: string) {
  const db = useDatabase()
  let state = await getDeliveryState(db, collection)

  let lastPublishedTime: number | null = null
  if (state?.lastPublishedAt) {
    const parsed = Date.parse(state.lastPublishedAt)
    if (!Number.isNaN(parsed)) {
      lastPublishedTime = parsed
    }
  }

  let entries: ContentEntry[] = []
  try {
    entries = await queryCollection(collection).order('createdAt', 'ASC').all()
  } catch (error) {
    console.error(`Failed to query content collection ${collection}`, error)
    return
  }

  if (!Array.isArray(entries) || !entries.length) {
    return
  }

  const documents = entries.filter((entry) => isFederatedDocument(entry)).sort(compareEntries)

  for (const entry of documents) {
    const activity = await buildCreateActivityFromEntry(entry)
    if (!activity) {
      continue
    }

    const { iso: publishedAt, timestamp: publishedTime } = resolvePublishedInfo(entry, activity)
    if (lastPublishedTime !== null && publishedTime < lastPublishedTime) {
      continue
    }

    if (state?.lastActivityId && activity.id === state.lastActivityId) {
      continue
    }

    const result = await broadcastDocument(entry, activity)
    if (result.status === "skipped") {
      continue
    }

    const deliveredActivity = result.activity

    const articleUrl = typeof deliveredActivity.object === "string"
      ? deliveredActivity.object
      : Array.isArray(deliveredActivity.object)
        ? null
        : (deliveredActivity.object as { id?: string | null })?.id ?? null

    const documentPath = resolveDocumentPath(entry)
    const documentId = typeof entry._id === "string"
      ? entry._id
      : typeof entry.id === "string"
        ? entry.id
        : null

    state = {
      collection,
      lastDocumentPath: documentPath,
      lastDocumentId: documentId,
      lastArticleUrl: articleUrl,
      lastActivityId: deliveredActivity.id ?? null,
      lastPublishedAt: publishedAt,
    }

    await updateDeliveryState(db, state)
    lastPublishedTime = publishedTime
  }
}

export default defineNitroPlugin((nitroApp) => {
  const pendingCollections = new Set<string>()
  let processing: Promise<void> | null = null

  const processQueue = () => {
    if (processing) {
      return processing
    }

    processing = (async () => {
      while (pendingCollections.size) {
        const iterator = pendingCollections.values().next()
        if (iterator.done) {
          break
        }
        const collection = iterator.value
        pendingCollections.delete(collection)

        try {
          await processCollection(collection)
        } catch (error) {
          console.error('Failed processing ActivityPub deliveries for collection', collection, error)
        }
      }
    })()

    return processing
      .catch((error) => {
        console.error('Failed processing ActivityPub delivery queue', error)
      })
      .finally(() => {
        processing = null
        if (pendingCollections.size) {
          processQueue()
        }
      })
  }

  nitroApp.hooks.hook('content:file:afterParse', (document: ContentEntry) => {
    if (!isFederatedDocument(document)) {
      return
    }
    const collection = resolveCollectionFromDocument(document)
    if (!collection) {
      return
    }

    pendingCollections.add(collection)
    void processQueue()
  })
})
