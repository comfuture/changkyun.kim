import { me, setJsonLdHeader } from "../../utils/federation"

const siteOrigin = new URL(me.id).origin
const LOCAL_AUDIENCE_IDS = new Set<string>([me.id, me.followers].filter(Boolean) as string[])

function normalizeRecipients(value: unknown): string[] {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    const recipients: string[] = []
    for (const entry of value) {
      recipients.push(...normalizeRecipients(entry))
    }
    return recipients
  }
  if (typeof value === "string") {
    return [value]
  }
  if (typeof value === "object") {
    const candidate = value as { id?: string | null }
    return candidate?.id ? [candidate.id] : []
  }
  return []
}

function targetsLocalObject(value: unknown): boolean {
  if (!value) {
    return false
  }
  if (Array.isArray(value)) {
    return value.some((entry) => targetsLocalObject(entry))
  }
  if (typeof value === "string") {
    return value === me.id || value.startsWith(siteOrigin)
  }
  if (typeof value === "object") {
    const candidate = value as Record<string, any>
    const identifier = typeof candidate.id === "string" ? candidate.id : null
    if (identifier && (identifier === me.id || identifier.startsWith(siteOrigin))) {
      return true
    }
    const inReplyTo = candidate?.inReplyTo
    if (typeof inReplyTo === "string" && inReplyTo.startsWith(siteOrigin)) {
      return true
    }
    if (candidate?.object && targetsLocalObject(candidate.object)) {
      return true
    }
  }
  return false
}

function isRelevantActivity(activity: Activity): boolean {
  if (!activity) {
    return false
  }

  if (targetsLocalObject(activity.object)) {
    return true
  }

  const recipients = [
    ...normalizeRecipients(activity.to),
    ...normalizeRecipients((activity as any).cc),
    ...normalizeRecipients((activity as any).bto),
    ...normalizeRecipients((activity as any).bcc),
    ...normalizeRecipients((activity as any).audience),
  ]

  return recipients.some((recipient) => LOCAL_AUDIENCE_IDS.has(recipient))
}

function parseStoredActivity(row: any): Activity | null {
  if (typeof row?.payload !== "string" || !row.payload) {
    return null
  }

  try {
    const parsed = JSON.parse(row.payload) as Activity
    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const normalized: Activity = { ...parsed }
    if (!normalized.id && typeof row?.activity_id === "string" && row.activity_id) {
      normalized.id = row.activity_id
    }
    return normalized
  } catch (error) {
    console.warn("Failed to parse stored ActivityPub payload", error)
    return null
  }
}

function createFallbackActivity(row: any): Activity | null {
  const activityId = typeof row?.activity_id === "string" && row.activity_id ? row.activity_id : null
  const actorId = typeof row?.actor_id === "string" && row.actor_id ? row.actor_id : null
  const type = typeof row?.type === "string" && row.type ? row.type : "Activity"

  if (!activityId || !actorId) {
    return null
  }

  const fallback: Activity = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: activityId,
    type: type as ActivityType,
    actor: actorId,
  }

  if (typeof row?.object !== "undefined") {
    fallback.object = row.object as any
  }

  return fallback
}

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const originMatch = `${siteOrigin}/%`
  const payloadActorMatch = `%${me.id}%`
  const payloadOriginMatch = `%${siteOrigin}/%`

  const { rows } = await db.sql`SELECT activity_id, payload, actor_id, type, object FROM activity
    WHERE type != 'Create'
      AND (
        object = ${me.id}
        OR object LIKE ${originMatch}
        OR payload LIKE ${payloadActorMatch}
        OR payload LIKE ${payloadOriginMatch}
      )
    ORDER BY created_at DESC`

  const orderedItems = rows?.map((row) => {
    const parsed = parseStoredActivity(row)
    if (parsed && isRelevantActivity(parsed)) {
      return parsed
    }

    const fallback = createFallbackActivity(row)
    if (fallback && isRelevantActivity(fallback)) {
      return fallback
    }

    return null
  }).filter((activity): activity is Activity => Boolean(activity)) ?? []

  setJsonLdHeader(event)
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: me.inbox,
    type: "OrderedCollection",
    totalItems: orderedItems.length,
    orderedItems,
  }
})
