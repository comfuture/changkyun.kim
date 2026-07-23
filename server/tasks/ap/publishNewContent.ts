import { Create } from "@fedify/vocab"

import {
  ACTOR_IDENTIFIER,
  buildCreateFromEntry,
  fetchFedifyContentEntries,
  resolveEntryPath,
  resolveFedifyLegacyActivityIds,
  type FedifyContentEntry,
} from "../../utils/fedifyContent"
import { createFedifyContext, getCloudflareEnv } from "../../utils/fedify"
import { ensureActivityPubSchema } from "../../utils/activityPubSchema"
import {
  resolveBlueskyConfig,
  shouldQueueBlueskyShare,
  type BlueskyConfig,
} from "../../utils/bluesky"
import {
  processPendingBlueskyShares,
  queueBlueskyShare,
} from "../../utils/blueskyShare"

const COLLECTIONS = ["blog", "app"] as const

type DeliveryState = {
  collection: string
  lastDocumentPath: string | null
  lastDocumentId: string | null
  lastArticleUrl: string | null
  lastActivityId: string | null
  lastPublishedAt: string | null
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

function compareEntries(a: FedifyContentEntry, b: FedifyContentEntry): number {
  const aTime = toTimestamp(a?.createdAt as string | Date | null)
  const bTime = toTimestamp(b?.createdAt as string | Date | null)
  if (aTime === bTime) {
    return (resolveEntryPath(a) ?? "").localeCompare(resolveEntryPath(b) ?? "")
  }
  return aTime - bTime
}

function resolvePublishedInfo(entry: FedifyContentEntry, activity: Create): { iso: string; timestamp: number } {
  let iso = activity.published?.toString() ?? null
  if (!iso && entry?.createdAt) {
    iso = entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt
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

async function getDeliveryState(collection: string): Promise<DeliveryState | null> {
  const db = useDatabase()
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

  const row = rows?.[0] as Record<string, any> | undefined
  if (!row) {
    return null
  }

  return {
    collection: row.collection as string,
    lastDocumentPath: (row.last_document_path as string | null) ?? null,
    lastDocumentId: (row.last_document_id as string | null) ?? null,
    lastArticleUrl: (row.last_article_url as string | null) ?? null,
    lastActivityId: (row.last_activity_id as string | null) ?? null,
    lastPublishedAt: (row.last_published_at as string | null) ?? null,
  }
}

async function updateDeliveryState(state: DeliveryState): Promise<void> {
  const db = useDatabase()
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
}

async function hasExistingOutboxActivity(activity: Create, entry: FedifyContentEntry): Promise<boolean> {
  const db = useDatabase()
  const activityId = activity.id?.href
  if (!activityId) {
    return true
  }

  const { rows } = await db.sql`SELECT 1 FROM activity WHERE activity_id = ${activityId} AND direction = 'outbox' LIMIT 1`
  if (rows?.length) {
    return true
  }

  const articleId = activity.objectId?.href
  if (!articleId) {
    return false
  }

  for (const legacyId of resolveFedifyLegacyActivityIds(articleId, entry)) {
    const legacy = await db.sql`SELECT 1 FROM activity WHERE activity_id = ${legacyId} AND direction = 'outbox' LIMIT 1`
    if (legacy.rows?.length) {
      const payload = JSON.stringify(await activity.toJsonLd({ format: "compact" }))
      await db.sql`UPDATE activity
        SET activity_id = ${activityId},
            actor_id = ${activity.actorIds[0]?.href ?? null},
            object = ${articleId},
            payload = ${payload},
            direction = 'outbox',
            updated_at = CURRENT_TIMESTAMP
        WHERE activity_id = ${legacyId}`
      return true
    }
  }

  return false
}

async function persistOutboxActivity(activity: Create): Promise<void> {
  const db = useDatabase()
  const activityId = activity.id?.href
  const articleId = activity.objectId?.href
  if (!activityId || !articleId) {
    throw new Error("Cannot persist Create activity without id and object id.")
  }
  const payload = JSON.stringify(await activity.toJsonLd({ format: "compact" }))

  await db.sql`INSERT INTO activity (
    activity_id, actor_id, type, object, payload, direction
  ) VALUES (
    ${activityId}, ${activity.actorIds[0]?.href ?? null}, 'Create', ${articleId}, ${payload}, 'outbox'
  )`
}

async function publishCollection(
  collection: typeof COLLECTIONS[number],
  env: ReturnType<typeof getCloudflareEnv>,
  blueskyConfig: BlueskyConfig,
) {
  const initialState = await getDeliveryState(collection)
  let initialLastPublishedTime: number | null = null
  if (initialState?.lastPublishedAt) {
    const parsed = Date.parse(initialState.lastPublishedAt)
    if (!Number.isNaN(parsed)) {
      initialLastPublishedTime = parsed
    }
  }

  const entries = (await fetchFedifyContentEntries(collection, {
    order: "ASC",
    createdAtGte: initialState?.lastPublishedAt && initialLastPublishedTime !== null
      ? initialState.lastPublishedAt
      : null,
  })).sort(compareEntries)

  let lastDeliveredTime = initialLastPublishedTime
  let lastDeliveredPath = initialState?.lastDocumentPath ?? null
  let lastDeliveredActivityId = initialState?.lastActivityId ?? null
  let published = 0
  let blueskyQueued = 0

  for (const entry of entries) {
    const activity = await buildCreateFromEntry(entry)
    if (!activity?.id) {
      continue
    }

    if (initialState?.lastActivityId && activity.id.href === initialState.lastActivityId) {
      continue
    }
    if (lastDeliveredActivityId && activity.id.href === lastDeliveredActivityId) {
      continue
    }

    const { iso: publishedAt, timestamp: publishedTime } = resolvePublishedInfo(entry, activity)
    const documentPath = resolveEntryPath(entry)

    if (initialLastPublishedTime === null && initialState?.lastDocumentPath && documentPath === initialState.lastDocumentPath) {
      continue
    }

    if (lastDeliveredTime !== null) {
      if (publishedTime < lastDeliveredTime) {
        continue
      }
      if (publishedTime === lastDeliveredTime && lastDeliveredPath && documentPath && documentPath.localeCompare(lastDeliveredPath) <= 0) {
        continue
      }
    }

    const alreadyPublished = await hasExistingOutboxActivity(activity, entry)
    if (!alreadyPublished) {
      if (shouldQueueBlueskyShare(blueskyConfig.status, alreadyPublished)
        && await queueBlueskyShare(activity.id.href, entry)) {
        blueskyQueued += 1
      }

      await persistOutboxActivity(activity)

      const ctx = await createFedifyContext(env)
      await ctx.sendActivity(
        { identifier: ACTOR_IDENTIFIER },
        "followers",
        activity,
        { preferSharedInbox: true },
      )
      published += 1
    }

    await updateDeliveryState({
      collection,
      lastDocumentPath: documentPath,
      lastDocumentId: typeof entry._id === "string" ? entry._id : typeof entry.id === "string" ? entry.id : null,
      lastArticleUrl: activity.objectId?.href ?? null,
      lastActivityId: activity.id.href,
      lastPublishedAt: publishedAt,
    })

    lastDeliveredTime = publishedTime
    lastDeliveredPath = documentPath ?? lastDeliveredPath
    lastDeliveredActivityId = activity.id.href
  }

  return { published, blueskyQueued }
}

export default defineTask({
  meta: {
    name: "ap:publishNewContent",
    description: "Publish new Nuxt Content entries through Fedify",
  },
  async run(event) {
    await ensureActivityPubSchema()
    const env = getCloudflareEnv(event)
    const blueskyConfig = resolveBlueskyConfig(env)
    let published = 0
    let blueskyQueued = 0
    for (const collection of COLLECTIONS) {
      const collectionResult = await publishCollection(collection, env, blueskyConfig)
      published += collectionResult.published
      blueskyQueued += collectionResult.blueskyQueued
    }
    const bluesky = await processPendingBlueskyShares(blueskyConfig)
    return {
      result: true,
      published,
      bluesky: {
        ...bluesky,
        queued: blueskyQueued,
      },
    }
  },
})
