import { createHash, randomUUID } from 'node:crypto';
import type { H3Event } from 'h3';

import { verifySignature } from './auth';
import { collectOutboxActivities, OUTBOX_PAGE_SIZE } from './outboxHelpers';

/**
 * Fetches an Actor from a given URL using ActivityPub protocol.
 * 
 * @param actorUrl - The URL of the Actor to fetch
 * @returns A Promise that resolves to the Actor object if successful, or null if the fetch fails
 */
export async function fetchActor(actorUrl: string): Promise<Actor | null> {
  const resp = await $fetch<Actor>(actorUrl, {
    headers: {
      Accept: 'application/activity+json',
    },
  }).catch((err) => {
    console.error('Error fetching actor:', err)
    return null
  })
  return resp
}

/**
 * Sets the Content-Type header to application/ld+json with the ActivityStreams profile
 * for the provided H3Event response.
 * 
 * @param event - The H3Event object representing the current request/response
 */
export const setJsonLdHeader = (event: H3Event) => {
  // Set the Content-Type header to application/ld+json with the ActivityStreams profile
  setResponseHeader(event, 'Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
}

/**
 * XXX: My federation profile.
 */
const BACKLOG_INITIAL_DELAY_MS = 1500

export const me = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1'
  ],
  id: 'https://changkyun.kim/@me',
  type: 'Person',
  preferredUsername: 'me',
  names: ['Changkyun Kim', '김창균', '金昌均'],
  icon: {
    type: 'Image',
    mediaType: 'image/jpeg',
    url: 'https://changkyun.kim/image/avatar.jpg',
  },
  image: {
    type: 'Image',
    mediaType: 'image/jpeg',
    url: 'https://changkyun.kim/cdn-cgi/image/fit=crop,w=1280,h=400/image/cover.jpg',
  },
  summary: `Principled person who values integrity. A slow but persistent learner with deep understanding. Problem solver using data, experience, and intuition.`,
  inbox: 'https://changkyun.kim/@me/inbox',
  outbox: 'https://changkyun.kim/@me/outbox',
  followers: 'https://changkyun.kim/@me/followers',
  following: 'https://changkyun.kim/@me/following',
  endpoints: {
    sharedInbox: 'https://changkyun.kim/inbox',
  },
}

export const PUBLIC_AUDIENCE = 'https://www.w3.org/ns/activitystreams#Public'

function normalizeCount(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function extractCount(rows?: Array<Record<string, unknown>>): number {
  if (!rows?.length) {
    return 0
  }
  const row = rows[0] ?? {}
  const raw = (row as Record<string, unknown>).count ?? Object.values(row)[0]
  return normalizeCount(raw)
}

export async function buildActorDocument(): Promise<Actor> {
  const db = useDatabase()
  const [followersResult, followingResult, actorResult] = await Promise.all([
    db.sql`SELECT COUNT(*) AS count FROM followers WHERE status = 'accepted'`,
    db.sql`SELECT COUNT(*) AS count FROM following WHERE status = 'accepted'`,
    db.sql`SELECT actor_id, public_key FROM actor WHERE actor_id = ${me.id} LIMIT 1`,
  ])

  const followersCount = extractCount(followersResult?.rows as Array<Record<string, unknown>> | undefined)
  const followingCount = extractCount(followingResult?.rows as Array<Record<string, unknown>> | undefined)

  const actorDocument: Actor = { ...me }

  actorDocument.followersCount = followersCount
  actorDocument.followers_count = followersCount
  actorDocument.followingCount = followingCount
  actorDocument.following_count = followingCount

  const actorRow = actorResult?.rows?.[0] as { actor_id?: string; public_key?: string } | undefined
  if (actorRow?.public_key && actorRow?.actor_id) {
    actorDocument.publicKey = {
      id: `${actorRow.actor_id}#main-key`,
      owner: actorRow.actor_id,
      publicKeyPem: actorRow.public_key,
    }
  }

  return actorDocument
}

export async function sendActivity(activity: Activity, target: string): Promise<void> {
  const recipient = typeof target === 'string' ? target : target?.id
  if (!recipient) {
    throw new Error('Cannot deliver activity without a valid target actor identifier.')
  }

  const targetActor = await fetchActor(recipient)
  if (!targetActor) {
    throw new Error(`Unable to load ActivityPub actor for ${recipient}`)
  }

  const inboxUrl = targetActor.inbox || targetActor.endpoints?.sharedInbox
  if (!inboxUrl) {
    throw new Error(`Target actor ${recipient} does not expose an inbox endpoint`)
  }

  const db = useDatabase()
  const { rows } = await db.sql`SELECT private_key FROM actor WHERE actor_id = ${me.id} LIMIT 1`
  if (!rows?.length) {
    throw new Error(`Missing local signing key for actor ${me.id}`)
  }

  const [{ private_key: privateKeyPem }] = rows as Array<{ private_key: string }>
  const { importPemKey, createDigest, createSignedRequestHeaders } = await import('./auth')
  const signingKey = await importPemKey(privateKeyPem, ['sign'])

  const body = JSON.stringify(activity)
  const digest = await createDigest(body)
  const inbox = new URL(inboxUrl)
  const date = new Date().toUTCString()

  const signedHeaders = await createSignedRequestHeaders({
    method: 'POST',
    path: `${inbox.pathname}${inbox.search}`,
    headers: {
      host: inbox.host,
      date,
      digest: `SHA-256=${digest}`,
    },
  }, signingKey, `${me.id}#main-key`)

  await $fetch(inbox.toString(), {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/activity+json',
      Date: date,
      ...signedHeaders,
    },
  })
}

/**
 * Accepts a follow request from a federated actor.
 * This function verifies the signature of the request, and if valid,
 * responds with a 202 Accepted status.
 * 
 * @param event - The H3 event object representing the HTTP request
 * @param activity - The follow activity containing the actor who initiated the follow request
 * @param activity.actor - The actor who initiated the follow request
 * @returns A promise that resolves when the request has been processed
 * @throws May throw an error if signature verification fails internally
 */
export async function acceptFollowRequest(event: H3Event, activity: FollowActivity): Promise<AcceptActivity | void> {
  const db = useDatabase()

  const actorId = typeof activity.actor === 'string'
    ? activity.actor
    : typeof (activity.actor as Actor | undefined)?.id === 'string'
      ? (activity.actor as Actor).id
      : null

  if (!actorId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Follow request missing actor' }))
  }

  const objectValue = activity.object as unknown
  const followTarget = typeof objectValue === 'string'
    ? objectValue
    : typeof (objectValue as { id?: string })?.id === 'string'
      ? (objectValue as { id: string }).id
      : null

  if (!followTarget) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Follow request missing object' }))
  }

  if (followTarget !== me.id && followTarget !== me.followers) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Unknown follow target' }))
  }

  const isValid = await verifySignature(event, actorId)
  if (!isValid) {
    return
  }

  const followActivityId = typeof activity.id === 'string' && activity.id
    ? activity.id
    : randomUUID()

  const followActivity: FollowActivity = {
    '@context': activity['@context'] ?? 'https://www.w3.org/ns/activitystreams',
    id: followActivityId,
    type: 'Follow',
    actor: actorId,
    object: me.id,
  }

  const payload = JSON.stringify(followActivity)

  let shouldBroadcastFollowersUpdate = true
  try {
    const { rows: existingRows } = await db.sql`SELECT status FROM followers WHERE actor_id = ${actorId} LIMIT 1`
    if (existingRows?.length) {
      const [existing] = existingRows as Array<{ status?: string | null }>
      if (existing?.status === 'accepted') {
        shouldBroadcastFollowersUpdate = false
      }
    }
  } catch (lookupError) {
    console.error('Failed checking existing follower state', lookupError)
  }

  await db.sql`INSERT INTO followers (actor_id, activity_id, activity_payload, status)
    VALUES (${actorId}, ${followActivity.id}, ${payload}, 'accepted')
    ON CONFLICT(actor_id) DO UPDATE SET
      activity_id = excluded.activity_id,
      activity_payload = excluded.activity_payload,
      status = 'accepted',
      updated_at = CURRENT_TIMESTAMP`

  const acceptHash = createHash('sha256')
    .update(`${actorId}|${followActivity.id}`)
    .digest('hex')

  const acceptActivity: AcceptActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${me.id}#accept-${acceptHash}`,
    type: 'Accept',
    actor: me.id,
    object: followActivity,
    to: [actorId],
  }

  try {
    await runTask('ap:sendActivity', {
      payload: {
        activity: acceptActivity,
        target: actorId,
      },
    })
  } catch (error) {
    console.error('Failed scheduling Accept activity delivery', error)
  }

  try {
    const { orderedItems } = await collectOutboxActivities(event, { limit: OUTBOX_PAGE_SIZE })
    if (orderedItems.length) {
      const backlogActivities = orderedItems.slice().reverse()
      try {
        const backlogPromise = runTask('ap:deliverBacklog', {
          payload: {
            activities: backlogActivities,
            target: actorId,
            initialDelay: BACKLOG_INITIAL_DELAY_MS,
          },
        })
        backlogPromise.catch((deliveryError) => {
          console.error('Failed delivering backlog activities to new follower', deliveryError)
        })
      } catch (scheduleError) {
        console.error('Failed scheduling backlog activities for follower', scheduleError)
      }
    }
  } catch (error) {
    console.error('Failed preparing backlog activities for follower', error)
  }

  if (shouldBroadcastFollowersUpdate) {
    try {
      const actorDocument = await buildActorDocument()
      const updateActivity: Activity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `${me.id}#update-${randomUUID()}`,
        type: 'Update',
        actor: me.id,
        object: actorDocument,
        to: [PUBLIC_AUDIENCE],
        cc: [me.followers],
      }

      await runTask('ap:sendActivity', {
        payload: {
          activity: updateActivity,
        },
      })
    } catch (error) {
      console.error('Failed broadcasting follower count update', error)
    }
  }

  setJsonLdHeader(event)
  setResponseStatus(event, 202)
  return acceptActivity
}

export async function removeFollower(actorId: string, followActivityId?: string | null): Promise<void> {
  if (!actorId) {
    return
  }

  const db = useDatabase()
  const normalizedFollowId = followActivityId ?? null

  await db.sql`UPDATE followers
    SET status = 'removed',
        activity_id = COALESCE(${normalizedFollowId}, activity_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE actor_id = ${actorId}`
}

/**
 * Accepts a reply request from a federated actor after verifying their signature.
 *
 * This function processes incoming ActivityPub reply requests. It verifies the
 * signature of the actor making the request, and if valid, responds with a 202
 * Accepted status.
 * 
 * @param event - The H3 event object containing the HTTP request details
 * @param activity - The reply activity containing information about the reply request
 * @param activity.actor - The actor who initiated the reply request
 * 
 * @returns A Promise that resolves when the handling is complete
 * 
 * @throws Will not throw errors, but will silently return if signature verification fails
 */
export async function acceptReplyRequest(event: H3Event, activity: ReplyActivity): Promise<void> {
  const { actor } = activity
  if (!await verifySignature(event, actor as string)) {
    return
  }
  setResponseStatus(event, 202)
  send(event, 'Accepted')
}