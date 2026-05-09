import {
  createError,
  getHeader,
  getRequestHeaders,
  getRequestURL,
  type H3Event,
} from "h3"

import { ensureActivityPubSchema } from "./activityPubSchema"
import { importPemKey } from "./auth"
import { ACTOR_IDENTIFIER, SITE_ORIGIN } from "./fedifyContent"

type SignatureFields = {
  keyId: string
  headers: string[]
  signature: string
}

const DEFAULT_ADMIN_ACTOR_ID = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN).href
const MAX_CLOCK_SKEW_SECONDS = 300

type AdminEnv = {
  ACTIVITYPUB_ADMIN_ACTOR_ID?: string
  ACTIVITYPUB_ADMIN_KEY_ID?: string
  ACTIVITYPUB_ADMIN_PUBLIC_KEY?: string
  ACTIVITYPUB_ADMIN_PUBLIC_KEYS?: string
}

function resolveAdminEnv(event?: H3Event): AdminEnv | undefined {
  return event?.context?.cloudflare?.env
    ?? event?.context?._platform?.cloudflare?.env
    ?? (globalThis as any).__env__
    ?? (typeof process !== "undefined" ? process.env : undefined)
}

function resolveAdminActorId(event: H3Event): string {
  const env = resolveAdminEnv(event)
  const actorIdFromEnv = env?.ACTIVITYPUB_ADMIN_ACTOR_ID?.trim()
  if (actorIdFromEnv) {
    return actorIdFromEnv
  }

  const keyIdFromEnv = env?.ACTIVITYPUB_ADMIN_KEY_ID?.trim()
  if (keyIdFromEnv) {
    return extractActorFromKeyId(keyIdFromEnv)
  }

  return DEFAULT_ADMIN_ACTOR_ID
}

function normalizeHeaderValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeHeaderNames(names: string[]): string[] {
  return names.map((name) => name.trim().toLowerCase()).filter(Boolean)
}

function isDateWithinSkew(dateHeader: string | null): boolean {
  if (!dateHeader) {
    return false
  }

  const requestTime = Date.parse(dateHeader)
  if (Number.isNaN(requestTime)) {
    return false
  }

  const now = Date.now()
  const deltaSeconds = Math.abs(now - requestTime) / 1000
  return deltaSeconds <= MAX_CLOCK_SKEW_SECONDS
}

export function parseSignatureHeader(value: string): SignatureFields | null {
  const keyValuePattern = /([^=\s,]+)\s*=\s*"([^"]*)"/g
  const pairs = new Map<string, string>()
  for (const match of value.matchAll(keyValuePattern)) {
    const key = match[1]
    const pairValue = match[2]
    if (key && typeof pairValue === "string") {
      pairs.set(key, pairValue)
    }
  }

  const signature = pairs.get("signature") ?? ""
  const keyId = pairs.get("keyId") ?? ""
  const headers = normalizeHeaderNames((pairs.get("headers") ?? "").split(" "))
  if (!signature || !keyId || headers.length === 0) {
    return null
  }
  return { keyId, headers, signature }
}

function extractActorFromKeyId(value: string): string {
  try {
    const keyUrl = new URL(value)
    return `${keyUrl.origin}${keyUrl.pathname}`
  } catch {
    return ""
  }
}

function normalizePemFromEnv(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const normalized = value.replace(/\\n/g, "\n").trim()
  return normalized || null
}

function parseConfiguredPublicKeys(value: string | null | undefined): Record<string, string> {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed
        .filter((item) => item && typeof item.keyId === "string" && typeof item.publicKey === "string")
        .map((item) => [item.keyId, item.publicKey]))
    }
    if (parsed && typeof parsed === "object") {
      return Object.fromEntries(Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    }
  } catch {
    // Fall through to no configured keys.
  }

  return {}
}

function loadConfiguredAdminPublicKeyPem(env: AdminEnv | undefined, keyId: string): string | null {
  const publicKeys = parseConfiguredPublicKeys(env?.ACTIVITYPUB_ADMIN_PUBLIC_KEYS)
  const configured = publicKeys[keyId]
  if (configured) {
    return normalizePemFromEnv(configured)
  }

  const singleKeyId = env?.ACTIVITYPUB_ADMIN_KEY_ID?.trim() || `${DEFAULT_ADMIN_ACTOR_ID}#main-key`
  if (singleKeyId && singleKeyId === keyId) {
    return normalizePemFromEnv(env?.ACTIVITYPUB_ADMIN_PUBLIC_KEY)
  }

  return null
}

async function createDigest(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return `SHA-256=${Buffer.from(hashBuffer).toString("base64")}`
}

async function verifyDigestHeader(event: H3Event, bodyText: string | null | undefined): Promise<boolean> {
  const method = (event.method || "GET").toUpperCase()
  if (method === "GET" || method === "HEAD") {
    return true
  }

  const digestHeader = normalizeHeaderValue(getHeader(event, "digest"))
  if (!digestHeader || typeof bodyText !== "string") {
    return false
  }

  return digestHeader === await createDigest(bodyText)
}

function hasSignedHeader(headers: string[], headerName: string): boolean {
  return headers.includes(headerName.toLowerCase())
}

function hasRequiredSignedHeaders(method: string, headers: string[]): boolean {
  if (!hasSignedHeader(headers, "(request-target)")
    || !hasSignedHeader(headers, "host")
    || !hasSignedHeader(headers, "date")) {
    return false
  }

  const normalizedMethod = method.toUpperCase()
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return true
  }
  return hasSignedHeader(headers, "digest")
}

function buildSigningString(method: string, path: string, headers: string[], values: Record<string, string>): string {
  const signed = []
  for (const header of headers) {
    if (header === "(request-target)") {
      signed.push(`(request-target): ${method.toLowerCase()} ${path}`)
      continue
    }
    const value = values[header]
    if (typeof value !== "string") {
      throw createError({
        statusCode: 401,
        statusMessage: "Signature header references missing header.",
      })
    }
    signed.push(`${header}: ${value}`)
  }
  return signed.join("\n")
}

function resolveSignedHeaderValues(
  event: H3Event,
  requestUrl: URL,
  headerNames: string[],
): Record<string, string> {
  const rawHeaders = getRequestHeaders(event)
  const normalized = new Map<string, string>()
  for (const [headerName, rawValue] of Object.entries(rawHeaders)) {
    const value = Array.isArray(rawValue)
      ? normalizeHeaderValue(rawValue.join(", "))
      : normalizeHeaderValue(rawValue)
    if (value) {
      normalized.set(headerName.toLowerCase(), value)
    }
  }

  const values: Record<string, string> = {}
  for (const headerName of headerNames) {
    if (headerName === "(request-target)") {
      continue
    }
    if (headerName === "host") {
      values.host = requestUrl.host
      continue
    }
    const headerValue = normalized.get(headerName)
    if (!headerValue) {
      throw createError({
        statusCode: 401,
        statusMessage: `Missing required signature header: ${headerName}`,
      })
    }
    values[headerName] = headerValue
  }

  return values
}

async function loadAdminPublicKeyPem(actorId: string): Promise<string | null> {
  await ensureActivityPubSchema()
  const db = useDatabase()
  const { rows } = await db.sql`
    SELECT public_key
    FROM actor
    WHERE actor_id = ${actorId}
    LIMIT 1
  `
  return (rows?.[0] as { public_key?: string | null } | undefined)?.public_key ?? null
}

export async function verifyActivityPubAdminRequestSignature(event: H3Event, bodyText?: string): Promise<boolean> {
  try {
    const signatureHeader = getHeader(event, "signature")
    if (!signatureHeader) {
      return false
    }

    const parsed = parseSignatureHeader(signatureHeader)
    if (!parsed) {
      return false
    }

    const env = resolveAdminEnv(event)
    const expectedActorId = resolveAdminActorId(event)
    const signerActorId = extractActorFromKeyId(parsed.keyId)
    if (!signerActorId || signerActorId !== expectedActorId) {
      return false
    }

    const publicKeyPem = loadConfiguredAdminPublicKeyPem(env, parsed.keyId)
      ?? await loadAdminPublicKeyPem(expectedActorId)
    if (!publicKeyPem) {
      return false
    }

    const requestUrl = getRequestURL(event)
    const path = `${requestUrl.pathname}${requestUrl.search}`
    const method = event.method || "GET"
    const dateHeader = getHeader(event, "date") || null
    if (!isDateWithinSkew(dateHeader)) {
      return false
    }

    const headersToSign = parsed.headers
    if (!hasRequiredSignedHeaders(method, headersToSign)) {
      return false
    }
    if (!await verifyDigestHeader(event, bodyText)) {
      return false
    }

    const values = resolveSignedHeaderValues(event, requestUrl, headersToSign)
    const signedText = buildSigningString(method, path, headersToSign, {
      ...values,
      "(request-target)": `${method.toLowerCase()} ${path}`,
    })

    const publicKey = await importPemKey(publicKeyPem)
    const isValid = await crypto.subtle.verify(
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      publicKey,
      Buffer.from(parsed.signature, "base64"),
      new TextEncoder().encode(signedText),
    )

    return isValid
  } catch {
    return false
  }
}

export function unauthorizedError() {
  throw createError({
    statusCode: 404,
    statusMessage: "Not Found",
  })
}
