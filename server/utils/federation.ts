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

export async function sendActivity(activity: Activity, target: string): Promise<void> {
  const db = useDatabase()
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
  await verifySignature(event, actor)
  const { success, lastInsertRowid } = await db.sql`INSERT INTO activity (
    activity_id, actor_id, type, object
  ) VALUES (
    ${activity_id}, ${actor}, ${type}, ${fallowee}
  )`
  if (!success) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Failed accepting follow request' }))
  }
  setResponseStatus(event, 202)
  send(event, 'Accepted')
  runTask('ap:sendActivity', {
    payload: {
      activity: {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `${me.id}#accept-${lastInsertRowid}`,
        type: 'Accept',
        actor: me.id,
        object: activity_id,
      },
      target: actor,
    },
  })
  send(event, {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${me.id}#accept-${lastInsertRowid}`,
    type: 'Accept',
    actor: me.id,
    object: 'Accept',
  })
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