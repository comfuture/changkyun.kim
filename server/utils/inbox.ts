import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'

import { acceptFollowRequest, ensureActivitySchema, setJsonLdHeader } from './federation'

async function recordActivity(activity: Activity): Promise<void> {
  const db = useDatabase()
  const activityId = typeof activity.id === 'string' && activity.id
    ? activity.id
    : randomUUID()
  const actorId = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
  const object = Array.isArray(activity.object)
    ? JSON.stringify(activity.object)
    : typeof activity.object === 'string'
      ? activity.object
      : activity.object && typeof activity.object === 'object'
        ? activity.object.id || JSON.stringify(activity.object)
        : null
  const payload = JSON.stringify(activity)

  const insertActivity = () => db.sql`INSERT INTO activity (activity_id, actor_id, type, object, payload) VALUES (
    ${activityId}, ${actorId}, ${activity.type}, ${object}, ${payload}
  )`

  try {
    await insertActivity()
  } catch (error) {
    const message = (error as Error)?.message ?? ''
    if (/no such table: activity/i.test(message)) {
      await ensureActivitySchema(db)
      await insertActivity()
      return
    }
    if (/no column named (activity_id|payload)/i.test(message)) {
      await ensureActivitySchema(db)
      await insertActivity()
      return
    }
    if (/unique constraint failed|duplicate/i.test(message)) {
      return
    }
    console.error('Failed recording ActivityPub inbox activity', error)
    throw error
  }
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

  switch (activity.type) {
    case 'Follow':
      return await acceptFollowRequest(event, activity as FollowActivity)
    default:
      await recordActivity(activity)
      setJsonLdHeader(event)
      setResponseStatus(event, 202)
      return { status: 'Accepted' }
  }
}
