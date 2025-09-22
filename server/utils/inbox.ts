import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'

import { acceptFollowRequest, me, removeFollower, setJsonLdHeader } from './federation'
import { verifySignature } from './auth'

function normalizeActorId(actor: unknown): string | null {
  if (!actor) {
    return null
  }
  if (typeof actor === 'string') {
    return actor
  }
  if (typeof actor === 'object' && typeof (actor as Actor | null)?.id === 'string') {
    return (actor as Actor).id
  }
  return null
}

function normalizeObjectIdentifier(object: unknown): string | null {
  if (!object) {
    return null
  }
  if (typeof object === 'string') {
    return object
  }
  if (Array.isArray(object)) {
    for (const entry of object) {
      const candidate = normalizeObjectIdentifier(entry)
      if (candidate) {
        return candidate
      }
    }
    return null
  }
  if (typeof object === 'object' && typeof (object as { id?: string | null })?.id === 'string') {
    return (object as { id: string }).id
  }
  return null
}

async function recordActivity(activity: Activity): Promise<string> {
  const db = useDatabase()
  const activityId = typeof activity.id === 'string' && activity.id
    ? activity.id
    : randomUUID()
  const actorId = normalizeActorId(activity.actor)
  const objectValue = activity.object
  const object = Array.isArray(objectValue)
    ? JSON.stringify(objectValue)
    : typeof objectValue === 'string'
      ? objectValue
      : objectValue && typeof objectValue === 'object'
        ? (objectValue as { id?: string | null }).id ?? JSON.stringify(objectValue)
        : null
  const payload = JSON.stringify(activity)

  await db.sql`INSERT INTO activity (activity_id, actor_id, type, object, payload, direction)
    VALUES (${activityId}, ${actorId}, ${activity.type}, ${object}, ${payload}, 'inbox')
    ON CONFLICT(activity_id) DO UPDATE SET
      actor_id = excluded.actor_id,
      type = excluded.type,
      object = excluded.object,
      payload = excluded.payload,
      direction = excluded.direction,
      updated_at = CURRENT_TIMESTAMP`

  return activityId
}

async function deleteRecordedActivity(activityId: string | null | undefined): Promise<void> {
  if (!activityId) {
    return
  }
  const db = useDatabase()
  await db.sql`DELETE FROM activity WHERE activity_id = ${activityId} AND direction = 'inbox'`
}

async function handleUndoActivity(event: H3Event, activity: UndoActivity) {
  const actorId = normalizeActorId(activity.actor)
  if (!actorId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Undo activity missing actor' }))
  }

  if (!await verifySignature(event, actorId)) {
    return
  }

  const objectValue = activity.object as unknown
  let followActivityId: string | null = null
  let followActorId: string | null = null
  let followTarget: string | null = null
  let followType: string | null = null

  if (typeof objectValue === 'string') {
    followActivityId = objectValue
  } else if (objectValue && typeof objectValue === 'object') {
    const followObject = objectValue as Partial<FollowActivity> & { type?: string }
    followActivityId = typeof followObject.id === 'string' ? followObject.id : null
    followActorId = normalizeActorId(followObject.actor as unknown)
    followTarget = normalizeObjectIdentifier(followObject.object as unknown)
    followType = typeof followObject.type === 'string' ? followObject.type : null
  }

  if (followType && followType !== 'Follow') {
    return
  }

  if (!followActorId) {
    followActorId = actorId
  }

  if (followActorId !== actorId) {
    return
  }

  if (followTarget && followTarget !== me.id && followTarget !== me.followers) {
    return
  }

  await removeFollower(actorId, followActivityId)
  setJsonLdHeader(event)
  setResponseStatus(event, 202)
  return { status: 'Accepted' }
}

async function handleAcceptActivity(event: H3Event, activity: AcceptActivity) {
  const actorId = normalizeActorId(activity.actor)
  if (!actorId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Accept activity missing actor' }))
  }

  if (!await verifySignature(event, actorId)) {
    return
  }

  const db = useDatabase()
  const objectValue = activity.object as unknown
  let followActivityId: string | null = null
  let followActorId: string | null = null
  let followTargetId: string | null = null
  let followPayload: string | null = null

  if (typeof objectValue === 'string') {
    followActivityId = objectValue
  } else if (objectValue && typeof objectValue === 'object') {
    const followObject = objectValue as Partial<FollowActivity>
    followActivityId = typeof followObject.id === 'string' ? followObject.id : null
    followActorId = normalizeActorId(followObject.actor as unknown)
    followTargetId = normalizeObjectIdentifier(followObject.object as unknown)

    const normalizedFollow: FollowActivity = {
      '@context': followObject['@context'] ?? 'https://www.w3.org/ns/activitystreams',
      id: followActivityId ?? randomUUID(),
      type: 'Follow',
      actor: me.id,
      object: followTargetId ?? actorId,
    }
    followActivityId = normalizedFollow.id
    followTargetId = normalizedFollow.object
    followPayload = JSON.stringify(normalizedFollow)
  }

  if (followActorId && followActorId !== me.id) {
    return
  }

  const targetActorId = followTargetId ?? actorId
  let payloadToStore = followPayload
  let activityIdentifier = followActivityId ?? null

  if (targetActorId) {
    const { rows } = await db.sql`SELECT activity_id, activity_payload FROM following WHERE actor_id = ${targetActorId} LIMIT 1`
    const existing = rows?.[0] as { activity_id?: string | null; activity_payload?: string | null } | undefined

    if (!activityIdentifier && existing?.activity_id) {
      activityIdentifier = existing.activity_id ?? null
    }
    if (!payloadToStore && typeof existing?.activity_payload === 'string' && existing.activity_payload) {
      payloadToStore = existing.activity_payload
    }

    if (!payloadToStore) {
      const fallback: FollowActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: activityIdentifier ?? randomUUID(),
        type: 'Follow',
        actor: me.id,
        object: targetActorId,
      }
      payloadToStore = JSON.stringify(fallback)
      activityIdentifier = fallback.id
    }

    await db.sql`INSERT INTO following (actor_id, activity_id, activity_payload, status)
      VALUES (${targetActorId}, ${activityIdentifier}, ${payloadToStore}, 'accepted')
      ON CONFLICT(actor_id) DO UPDATE SET
        activity_id = COALESCE(excluded.activity_id, following.activity_id),
        activity_payload = COALESCE(excluded.activity_payload, following.activity_payload),
        status = 'accepted',
        updated_at = CURRENT_TIMESTAMP`
  }

  setJsonLdHeader(event)
  setResponseStatus(event, 202)
  return { status: 'Accepted' }
}

async function handleDefaultActivity(event: H3Event) {
  setJsonLdHeader(event)
  setResponseStatus(event, 202)
  return { status: 'Accepted' }
}

export async function handleInboxPost(event: H3Event) {
  let activity: Activity
  try {
    activity = await readBody(event)
    if (!activity || typeof activity !== 'object') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Invalid ActivityPub payload' }))
    }
  } catch (error) {
    console.error('Failed parsing ActivityPub inbox payload', error)
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Failed to parse request body' }))
  }

  let recordedActivityId: string | null = null
  try {
    recordedActivityId = await recordActivity(activity)
  } catch (error) {
    console.error('Failed storing ActivityPub inbox activity', error)
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Failed to persist inbox activity' }))
  }

  let processed = false
  try {
    switch (activity.type) {
      case 'Follow': {
        const response = await acceptFollowRequest(event, activity as FollowActivity)
        processed = true
        return response
      }
      case 'Undo': {
        const response = await handleUndoActivity(event, activity as UndoActivity)
        processed = true
        return response
      }
      case 'Accept': {
        const response = await handleAcceptActivity(event, activity as AcceptActivity)
        processed = true
        return response
      }
      default: {
        const response = await handleDefaultActivity(event)
        processed = true
        return response
      }
    }
  } finally {
    if (processed && recordedActivityId) {
      try {
        await deleteRecordedActivity(recordedActivityId)
      } catch (cleanupError) {
        console.error('Failed removing processed inbox activity', cleanupError)
      }
    }
  }
}
