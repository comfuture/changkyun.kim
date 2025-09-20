import type { H3Event } from 'h3';

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
export const me = {
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1'
  ],
  id: 'https://changkyun.kim/@me',
  type: 'Person',
  preferredUsername: 'changkyun.kim',
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
}

export const PUBLIC_AUDIENCE = 'https://www.w3.org/ns/activitystreams#Public'

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

async function ensureActivityIdColumn(db: ReturnType<typeof useDatabase>) {
  try {
    await db.sql`ALTER TABLE activity ADD COLUMN activity_id TEXT`
  } catch (error) {
    const message = (error as Error)?.message ?? ''
    if (!/duplicate column name/i.test(message)) {
      throw error
    }
  }

  await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS ix_activity_activity_id ON activity(activity_id)`
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
export async function acceptFollowRequest(event: H3Event, activity: FollowActivity): Promise<void> {
  const db = useDatabase()
  const { id: activity_id, actor, type, object: fallowee } = activity
  const isValid = await verifySignature(event, actor)
  if (!isValid) {
    return
  }
  const insertActivity = () => db.sql`INSERT INTO activity (
    activity_id, actor_id, type, object
  ) VALUES (
    ${activity_id}, ${actor}, ${type}, ${fallowee}
  )`

  let insertResult
  try {
    insertResult = await insertActivity()
  } catch (error) {
    const message = (error as Error)?.message ?? ''
    if (/no column named activity_id/i.test(message)) {
      try {
        await ensureActivityIdColumn(db)
      } catch (migrationError) {
        console.error('Failed migrating activity table', migrationError)
        return sendError(event, createError({ statusCode: 500, statusMessage: 'Failed accepting follow request' }))
      }

      try {
        insertResult = await insertActivity()
      } catch (retryError) {
        console.error('Failed inserting follow activity', retryError)
        return sendError(event, createError({ statusCode: 500, statusMessage: 'Failed accepting follow request' }))
      }
    } else {
      console.error('Failed inserting follow activity', error)
      return sendError(event, createError({ statusCode: 500, statusMessage: 'Failed accepting follow request' }))
    }
  }

  const { success, lastInsertRowid } = insertResult
  if (!success) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Failed accepting follow request' }))
  }
  const acceptActivity: AcceptActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${me.id}#accept-${lastInsertRowid}`,
    type: 'Accept',
    actor: me.id,
    object: activity,
    to: [actor],
  }

  await runTask('ap:sendActivity', {
    payload: {
      activity: acceptActivity,
      target: actor,
    },
  })

  setJsonLdHeader(event)
  setResponseStatus(event, 202)
  return acceptActivity
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