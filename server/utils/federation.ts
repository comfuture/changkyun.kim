import { generateKeyPairSync } from 'node:crypto';
import type { H3Event } from 'h3';
/**
 * Generates a new RSA key pair for cryptographic operations.
 * 
 * @returns An object containing the generated public and private keys in PEM format.
 * @property {string} publicKey - The RSA public key in SPKI, PEM format.
 * @property {string} privateKey - The RSA private key in PKCS8, PEM format.
 */
export function generateRsaKeyPair(): { publicKey: string; privateKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })
  return { privateKey, publicKey }
}

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
  preferredUsername: 'me',
  names: ['Changkyun Kim', '김창균', '金昌均'],
  icon: 'https://changkyun.kim/image/avatar.jpg',
  image: 'https://changkyun.kim/cdn-cgi/image/fit=crop,w=1280,h=400/image/cover.jpg',
  summary: `Principled person who values integrity. A slow but persistent learner with deep understanding. Problem solver using data, experience, and intuition.`,
  inbox: 'https://changkyun.kim/@me/inbox',
  outbox: 'https://changkyun.kim/@me/outbox',
  followers: 'https://changkyun.kim/@me/followers',
  following: 'https://changkyun.kim/@me/following',
}

/**
 * Retrieves the federation profile of the only user of the server.
 * 
 * @returns An object containing the user's federation profile and public key.
 */
export function getMe() {
  const { privateKey, publicKey: storedKey } = generateRsaKeyPair()
  const publicKey: PublicKey = {
    id: `${me.id}#main-key`,
    owner: me.id,
    publicKeyPem: storedKey,
  }
  return { ...me, publicKey }
}

/**
 * Imports a PEM-encoded public key into a CryptoKey object.
 * 
 * @param pem - The PEM-encoded public key as a string
 * @returns A Promise that resolves to a CryptoKey object configured for RSA-PKCS1-v1_5 signature verification
 */
function importPemKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    Buffer.from(pem, 'utf-8'),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    ['verify']
  )
}
/**
 * Verifies the signature of an event for a given actor. It checks the signature in the request headers against the actor's public key.
 * 
 * @remarks
 * This function is designed to work with RSA-SHA256 signatures for now.
 *
 * @param event - The H3Event object representing the current request/response
 * @param actorId - The ID of the actor whose signature is being verified
 * @returns A Promise that resolves to a boolean indicating whether the signature is valid
 */
export async function verifySignature(event: H3Event, actorId: string): Promise<boolean> {
  const actor = await fetchActor(actorId);
  if (!actor || !actor.publicKey || !actor.publicKey.publicKeyPem) {
    sendError(event, createError({ statusCode: 401, statusMessage: 'Actor not found or invalid public key' }));
    return false;
  }

  // signature: headers="(request-target) host date",signature=abcd1234...
  const sig: string = event.node.req.headers['signature'] as string;
  if (!sig) {
    sendError(event, createError({ statusCode: 401, statusMessage: 'No signature found in the request headers.' }));
    return false;
  }
  const parts = sig.split(',').map(part => part.trim());
  const signaturePart = parts.find(part => part.startsWith('signature='));
  const signatureValue = signaturePart ? signaturePart.split('=')[1] : null;
  if (!signatureValue) {
    sendError(event, createError({ statusCode: 401, statusMessage: 'Signature not found in the signature header' }));
    return false;
  }
  const headerPart = parts.find(part => part.startsWith('headers='));
  const headerItems = headerPart ? headerPart.split('=')[1].replace(/^"|"$/g, '').split(' ') : [];

  const signatureBuffer = Buffer.from(signatureValue, 'base64');
  const key = await importPemKey(actor.publicKey.publicKeyPem);
  const body = await readRawBody(event);

  let payload = '';

  for (const header of headerItems) {
    if (header === '(request-target)') {
      payload += `(request-target): ${event.method.toLowerCase()} ${event.path}\n`;
    } else if (header === 'host') {
      const host = event.headers.get('host');
      if (host) {
        payload += `host: ${event.headers.get('host')}\n`;
      }
    } else if (header === 'date') {
      const date = event.headers.get('date');
      if (date) {
        payload += `date: ${date}\n`;
      }
    } else {
      const customHeader = event.headers.get(header);
      if (customHeader) {
        payload += `${header.toLowerCase()}: ${customHeader}\n`;
      }
    }
  }

  payload += '\n' + body;
  const dataBuffer = Buffer.from(payload, 'utf-8');

  const isValid = await crypto.subtle.verify(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    key,
    signatureBuffer,
    dataBuffer
  );

  if (!isValid) {
    sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid signature' }));
    return false;
  }

  return true;
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
  const { actor, object } = activity
  if (!await verifySignature(event, actor)) {
    return
  }
  const { success } = await db.sql`INSERT INTO activity (
    actor_id, type, object
  ) VALUES (
    ${activity.actor}, ${activity.type}, ${object}
  )`
  if (!success) {
    sendError(event, createError({ statusCode: 400, statusMessage: 'Failed accepting follow request' }))
    return
  }
  setJsonLdHeader(event)
  setResponseStatus(event, 202)
  send(event, {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${activity.id}#accept`,
    type: 'Accept',
    actor: me.id,
    object: 'Accepted',
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