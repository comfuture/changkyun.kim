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
 * Creates a digital signature for HTTP requests using RSASSA-PKCS1-v1_5 with SHA-256.
 * 
 * @param params - Parameters needed for creating the signature
 * @param params.method - The HTTP method (e.g., 'GET', 'POST')
 * @param params.path - The request path
 * @param params.headers - The HTTP headers to include in the signature
 * @param key - The private cryptographic key used for signing
 * @returns A Promise resolving to the base64-encoded signature string
 */
export async function createSignature(params: SignatureParams, key: CryptoKey): Promise<string> {
  const { method, path, headers } = params;
  const { normalized, order } = normalizeHeaderParams(headers);
  const headerNames = Array.from(new Set(order));
  const signatureLines = [`(request-target): ${method.toLowerCase()} ${path}`];
  for (const headerName of headerNames) {
    signatureLines.push(`${headerName}: ${normalized[headerName]}`);
  }
  const signatureData = signatureLines.join('\n');

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
 * Creates HTTP headers with signature for authenticated federated requests.
 * This function implements HTTP Signatures protocol by generating a cryptographic
 * signature of the request and formatting it according to the specification.
 * 
 * @param params - Parameters required for creating the signature
 * @param key - CryptoKey used for signing the request
 * @param keyId - Identifier for the key used to create the HTTP signature (e.g. `${actorId}#main-key`)
 * @returns Promise resolving to an object containing the HTTP Signature header and optional Digest header
 */
export async function createSignedRequestHeaders(
  params: SignatureParams,
  key: CryptoKey,
  keyId: string,
): Promise<Record<string, string>> {
  if (!keyId) {
    throw new Error('A keyId is required to sign ActivityPub requests.');
  }
  const { normalized, order } = normalizeHeaderParams(params.headers);
  const signature = await createSignature({ ...params, headers: normalized }, key);
  const headerNames = Array.from(new Set(order));
  const result: Record<string, string> = {
    Signature: `keyId="${keyId}",headers="${['(request-target)', ...headerNames].join(' ')}",signature="${signature}"`
  };
  const digestHeader = normalized.digest;
  if (digestHeader) {
    result.Digest = digestHeader.startsWith('SHA-256=') ? digestHeader : `SHA-256=${digestHeader}`;
  }
  return result;
}

function normalizeHeaderParams(headers: Record<string, string>): { normalized: Record<string, string>; order: string[] } {
  const normalized: Record<string, string> = {};
  const order: string[] = [];
  for (const [name, value] of Object.entries(headers || {})) {
    const headerName = name.toLowerCase().trim();
    order.push(headerName);
    normalized[headerName] = value;
  }
  return { normalized, order };
}
