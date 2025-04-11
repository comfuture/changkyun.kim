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

/**
 * Imports a PEM-encoded key (public or private) into a CryptoKey object.
 * 
 * @param pem - The PEM-encoded key as a string
 * @param usage - Optional key usage array. Defaults to ['verify'] for public keys and ['sign'] for private keys
 * @returns A Promise that resolves to a CryptoKey object
 */
export function importPemKey(pem: string, usage?: KeyUsage[]): Promise<CryptoKey> {
  // determine if the key is public or private
  const isPublicKey = pem.includes('-----BEGIN PUBLIC KEY-----')
  const isPrivateKey = pem.includes('-----BEGIN PRIVATE KEY-----')

  if (!isPublicKey && !isPrivateKey) {
    throw new Error('Unsupported key format. Expected PEM encoded public or private key')
  }

  let pemHeader, pemFooter
  let format: 'spki' | 'pkcs8'
  let defaultUsage: KeyUsage[]

  if (isPublicKey) {
    pemHeader = '-----BEGIN PUBLIC KEY-----'
    pemFooter = '-----END PUBLIC KEY-----'
    format = 'spki'
    defaultUsage = ['verify']
  } else {
    pemHeader = '-----BEGIN PRIVATE KEY-----'
    pemFooter = '-----END PRIVATE KEY-----'
    format = 'pkcs8'
    defaultUsage = ['sign']
  }

  // Remove headers and footers from PEM and perform Base64 decoding
  const pemContents = pem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')

  // Base64 decode to create binary DER format data
  const binaryDer = Buffer.from(pemContents, 'base64')

  return crypto.subtle.importKey(
    format,
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    false,
    usage || defaultUsage
  )
}

type SignatureFields = {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
};

function parseSignatureHeader(sig: string): SignatureFields {
  const result: Record<string, any> = {};
  sig.split(',').forEach(part => {
    const [key, value] = part.trim().split('=');
    result[key] = value.replace(/^"|"$/g, '');
  });
  result.headers = result.headers.split(' ');
  return result as SignatureFields;
}

interface DictLike {
  get(key: string): string | null
}

/**
 * Builds a string payload for HTTP signature construction used in federation protocols.
 * Takes header names, retrieves their values from a dictionary-like object,
 * and formats them according to HTTP Signature specification.
 * 
 * @param headers - Array of header names to include in the signature
 * @param jar - Dictionary-like object that contains header values
 * @param method - HTTP method (e.g., 'GET', 'POST')
 * @param path - Request path (e.g., '/users')
 * @returns A newline-separated string of formatted "header: value" pairs
 */
function buildPayloadString(headers: string[], jar: DictLike, method: string, path: string): string {
  return headers.map(header => {
    header = header.toLowerCase().trim();
    if (header === '(request-target)') {
      return `(request-target): ${method.toLowerCase()} ${path}`;
    }
    return `${header}: ${jar.get(header)}`;
  }).join('\n');
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
  const sig: string = event.headers.get('signature') as string;
  if (!sig) {
    sendError(event, createError({ statusCode: 401, statusMessage: 'No signature found in the request headers.' }));
    return false;
  }

  const fields = parseSignatureHeader(sig);

  if (!fields.signature) {
    sendError(event, createError({ statusCode: 401, statusMessage: 'Signature not found in the signature header' }));
    return false;
  }

  if (!isDateValid(event.headers.get('date') as string)) {
    sendError(event, createError({ statusCode: 401, statusMessage: 'Invalid date header' }));
    return false;
  }

  const signatureBuffer = Buffer.from(fields.signature, 'base64');
  const key = await importPemKey(actor.publicKey.publicKeyPem);
  const payload = buildPayloadString(fields.headers, event.headers, event.method, event.path);
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
 * Validates if a date string is within an acceptable time range from the current time.
 * This function is useful for federation protocols that require timestamp validation
 * to prevent replay attacks.
 * 
 * @param dateHeader - A string representation of a date that can be parsed by the Date constructor
 * @param maxSkewSeconds - Maximum allowed time difference in seconds between the current time and the provided date (default: 300 seconds/5 minutes)
 * @returns True if the date is valid and within the acceptable time range, false otherwise
 */
function isDateValid(dateHeader: string, maxSkewSeconds = 300): boolean {
  const requestTime = new Date(dateHeader).getTime();
  if (isNaN(requestTime)) return false;
  const currentTime = Date.now();
  const skew = Math.abs(currentTime - requestTime) / 1000;
  return skew <= maxSkewSeconds;
}

/**
 * Interface for the parameters required to create a signature.
 * This includes the key to be used for signing, the HTTP method, path,
 * headers, and an optional key ID.
 */
interface SignatureParams {
  method: string;           // HTTP 메소드 (GET, POST 등)
  path: string;             // 요청 경로
  headers: {                // 서명에 포함될 HTTP 헤더들
    [key: string]: string;
  };
}

/**
 * ActivityPub 프로토콜에서 사용되는 HTTP 서명을 생성합니다.
 * HTTP 서명 스펙에 따라 요청 대상, 호스트, 날짜 등을 포함한 서명을 생성합니다.
 * 
 * @param params - 서명 생성에 필요한 매개변수
 * @param key - 서명에 사용할 개인 키
 * @returns 생성된 서명(base64 인코딩)을 포함한 Promise
 */
export async function createSignature(params: SignatureParams, key: CryptoKey): Promise<string> {
  const { method, path, headers } = params;

  // 서명할 헤더들의 목록
  const headerNames = Object.keys(headers).map(h => h.toLowerCase());

  // HTTP 서명 스펙에 따라 (request-target) 항상 포함
  if (!headerNames.includes('(request-target)')) {
    headerNames.unshift('(request-target)');
  }

  // 서명 데이터 문자열 생성
  const signatureData = headerNames.map(headerName => {
    if (headerName === '(request-target)') {
      return `(request-target): ${method.toLowerCase()} ${path}`;
    }
    return `${headerName.toLowerCase()}: ${headers[headerName]}`;
  }).join('\n');

  // 서명 생성
  const signatureBuffer = Buffer.from(signatureData, 'utf-8');
  const signature = await crypto.subtle.sign(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    },
    key,
    signatureBuffer
  );

  // 서명 결과를 base64로 인코딩하여 반환
  return Buffer.from(signature).toString('base64');
}

/**
 * Creates a SHA-256 message digest from the provided string.
 * 
 * This function converts the input string to bytes using TextEncoder,
 * computes a SHA-256 hash of the data, and returns the hash
 * as a base64-encoded string.
 *
 * @param message - The string message to digest
 * @returns A Promise that resolves to the base64-encoded SHA-256 digest
 * @example
 * const digest = await createMessageDigest("Hello world");
 * // Returns the base64-encoded SHA-256 hash of "Hello world"
 */
export async function createDigest(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash).toString('base64');
}

/**
 * 지정한 액터에게 서명된 HTTP 요청을 전송하기 위한 헤더를 생성합니다.
 * 
 * @param params - 서명 생성에 필요한 매개변수
 * @param actorId - 요청 발신자 액터 ID
 * @returns HTTP 요청에 사용할 헤더 객체
 */
export async function createSignedRequestHeaders(
  params: SignatureParams,
  key: CryptoKey,
  keyId?: string,
): Promise<Record<string, string>> {
  const { headers } = params;
  const headerNames = Object.keys(headers).map(h => h.toLowerCase());

  // 서명 생성
  const signature = await createSignature(params, key);
  const resolvedKeyId = keyId || `${keyId}#main-key`;

  // Digest 헤더 생성
  const digest = await createDigest(JSON.stringify(headers));
  return {
    Digest: `SHA-256=${digest}`,
    Signature: `keyId="${resolvedKeyId}",headers="${['(request-target)', ...headerNames].join(' ')}",signature="${signature}"`
  };
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
  const { actor, type, object: fallowee } = activity
  await verifySignature(event, actor)
  const { success, lastInsertRowid } = await db.sql`INSERT INTO activity (
    actor_id, type, object
  ) VALUES (
    ${actor}, ${type}, ${fallowee}
  )`
  if (!success) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Failed accepting follow request' }))
  }
  setJsonLdHeader(event)
  setResponseStatus(event, 202)
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