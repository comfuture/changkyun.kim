const BLUESKY_ENTRYWAY = "https://bsky.social"
const BLUESKY_POST_COLLECTION = "app.bsky.feed.post"
const BLUESKY_POST_MAX_GRAPHEMES = 300
const BLUESKY_POST_MAX_BYTES = 3000
const BLUESKY_CARD_IMAGE_MAX_BYTES = 1_000_000
const BLUESKY_RETRY_BASE_MS = 10 * 60 * 1000
const BLUESKY_RETRY_MAX_MS = 6 * 60 * 60 * 1000
const S32_CHARACTERS = "234567abcdefghijklmnopqrstuvwxyz"

let lastTidTimestamp = 0
let tidClockId: number | null = null

export type BlueskyEnvironment = {
  BSKY_USER?: string
  BSKY_PASSWORD?: string
}

export type BlueskyConfig =
  | { status: "disabled" }
  | { status: "incomplete" }
  | { status: "enabled"; user: string; password: string }

export type BlueskyBlob = {
  $type: "blob"
  ref: {
    $link: string
  }
  mimeType: string
  size: number
}

export type BlueskyPostRecord = {
  $type: "app.bsky.feed.post"
  text: string
  createdAt: string
  embed: {
    $type: "app.bsky.embed.external"
    external: {
      uri: string
      title: string
      description: string
      thumb?: BlueskyBlob
    }
  }
}

export type BlueskyShareSource = {
  title?: string | null
  stem?: string | null
  description?: string | null
  body?: unknown
  coverImage?: string | null
}

export type BlueskyShareDraft = {
  recordKey: string
  record: BlueskyPostRecord
  coverImageUrl: string | null
}

export type BlueskySession = {
  accessJwt: string
  did: string
  pdsUrl: string
}

export type BlueskyRecordResult = {
  uri: string
  cid: string | null
}

export type BlueskyThumbnailResult = {
  record: BlueskyPostRecord
  outcome: "attached" | "skipped"
}

export class BlueskyXrpcError extends Error {
  status: number
  errorCode: string | null

  constructor(method: string, status: number, errorCode: string | null = null) {
    const suffix = errorCode ? `: ${errorCode}` : ""
    super(`Bluesky XRPC ${method} failed with HTTP ${status}${suffix}.`)
    this.name = "BlueskyXrpcError"
    this.status = status
    this.errorCode = errorCode
  }
}

export class BlueskyRecordConflictError extends Error {
  constructor() {
    super("The persisted Bluesky record key already contains a different record.")
    this.name = "BlueskyRecordConflictError"
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

function safeErrorCode(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]{1,80}$/.test(value)) {
    return null
  }
  return value
}

async function parseResponseJson(response: Response): Promise<Record<string, any>> {
  try {
    const value = await response.json()
    return value && typeof value === "object" ? value as Record<string, any> : {}
  } catch {
    return {}
  }
}

function xrpcUrl(baseUrl: string, method: string, query?: URLSearchParams): string {
  const base = baseUrl.replace(/\/+$/, "")
  const suffix = query?.size ? `?${query.toString()}` : ""
  return `${base}/xrpc/${method}${suffix}`
}

async function xrpcJson(
  fetcher: typeof fetch,
  baseUrl: string,
  method: string,
  options: {
    accessJwt?: string
    body?: Record<string, unknown>
    query?: URLSearchParams
  } = {},
): Promise<Record<string, any>> {
  const headers = new Headers()
  headers.set("accept", "application/json")
  if (options.body) {
    headers.set("content-type", "application/json")
  }
  if (options.accessJwt) {
    headers.set("authorization", `Bearer ${options.accessJwt}`)
  }

  let response: Response
  try {
    response = await fetcher(xrpcUrl(baseUrl, method, options.query), {
      method: options.body ? "POST" : "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new Error(`Bluesky XRPC ${method} request failed before receiving a response.`)
  }

  const data = await parseResponseJson(response)
  if (!response.ok) {
    throw new BlueskyXrpcError(method, response.status, safeErrorCode(data.error))
  }
  return data
}

function resolvePdsUrl(didDoc: unknown): string {
  if (!didDoc || typeof didDoc !== "object") {
    return BLUESKY_ENTRYWAY
  }
  const services = (didDoc as { service?: unknown }).service
  if (!Array.isArray(services)) {
    return BLUESKY_ENTRYWAY
  }

  for (const service of services) {
    if (!service || typeof service !== "object") {
      continue
    }
    const value = service as {
      id?: unknown
      type?: unknown
      serviceEndpoint?: unknown
    }
    const isPds = (typeof value.id === "string" && value.id.endsWith("#atproto_pds"))
      || value.type === "AtprotoPersonalDataServer"
    if (!isPds || typeof value.serviceEndpoint !== "string") {
      continue
    }
    try {
      const endpoint = new URL(value.serviceEndpoint)
      if (endpoint.protocol === "https:" && !endpoint.username && !endpoint.password) {
        return endpoint.href.replace(/\/+$/, "")
      }
    } catch {
      continue
    }
  }
  return BLUESKY_ENTRYWAY
}

function s32encode(value: number): string {
  let remaining = value
  let encoded = ""
  while (remaining) {
    const index = remaining % 32
    remaining = Math.floor(remaining / 32)
    encoded = S32_CHARACTERS.charAt(index) + encoded
  }
  return encoded
}

export function createBlueskyRecordKey(now = Date.now()): string {
  const timestamp = Math.max(now * 1000, lastTidTimestamp + 1)
  lastTidTimestamp = timestamp

  if (tidClockId === null) {
    const random = new Uint16Array(1)
    crypto.getRandomValues(random)
    tidClockId = (random[0] ?? 0) % 1024
  }

  return `${s32encode(timestamp)}${s32encode(tidClockId).padStart(2, "2")}`
}

export function resolveBlueskyConfig(env?: BlueskyEnvironment | null): BlueskyConfig {
  const user = env?.BSKY_USER?.trim() ?? ""
  const password = env?.BSKY_PASSWORD?.trim() ?? ""
  if (!user && !password) {
    return { status: "disabled" }
  }
  if (!user || !password) {
    return { status: "incomplete" }
  }
  return { status: "enabled", user, password }
}

export function nextBlueskyAttemptAt(attemptCount: number, now = new Date()): string {
  const exponent = Math.max(0, Math.min(10, attemptCount - 1))
  const delay = Math.min(BLUESKY_RETRY_MAX_MS, BLUESKY_RETRY_BASE_MS * (2 ** exponent))
  return new Date(now.getTime() + delay).toISOString()
}

export function shouldQueueBlueskyShare(
  configuration: BlueskyConfig["status"],
  alreadyPublished: boolean,
): boolean {
  return configuration !== "disabled"
    && !alreadyPublished
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const isHex = entity[1]?.toLowerCase() === "x"
      const parsed = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 0x10ffff) {
        return String.fromCodePoint(parsed)
      }
      return match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function collectContentText(value: unknown, seen = new Set<unknown>()): string {
  if (typeof value === "string") {
    return value
  }
  if (!value || typeof value !== "object" || seen.has(value)) {
    return ""
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => collectContentText(item, seen)).filter(Boolean).join(" ")
  }

  const record = value as Record<string, unknown>
  const direct = [record.value, record.text, record.code]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
  const nested = [record.children, record.content, record.body]
    .map((item) => collectContentText(item, seen))
    .filter(Boolean)
    .join(" ")
  return [direct, nested].filter(Boolean).join(" ")
}

export function normalizeBlueskyText(value: unknown): string {
  const text = collectContentText(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/```[a-z0-9_-]*\s*/gi, " ")
    .replace(/[`*_~]/g, "")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+])\s+/gm, "")
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "")
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim()
}

export function truncateBlueskyText(
  value: string,
  maxGraphemes = BLUESKY_POST_MAX_GRAPHEMES,
  maxBytes = BLUESKY_POST_MAX_BYTES,
): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
  const encoder = new TextEncoder()
  const segments: string[] = []
  let bytes = 0

  for (const item of segmenter.segment(value)) {
    if (segments.length >= maxGraphemes) {
      break
    }
    const segmentBytes = encoder.encode(item.segment).byteLength
    if (bytes + segmentBytes > maxBytes) {
      break
    }
    segments.push(item.segment)
    bytes += segmentBytes
  }
  return segments.join("").trim()
}

function resolveCoverImageUrl(value: string | null | undefined, siteOrigin: string): string | null {
  if (!value) {
    return null
  }
  try {
    const url = new URL(value, siteOrigin)
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

export function buildBlueskyShareDraft(
  source: BlueskyShareSource,
  publicUrl: URL,
  options: {
    now?: Date
    siteOrigin?: string
  } = {},
): BlueskyShareDraft {
  const now = options.now ?? new Date()
  const title = truncateBlueskyText(
    normalizeBlueskyText(source.title)
    || normalizeBlueskyText(source.stem)
    || publicUrl.href,
  )
  const summary = truncateBlueskyText(
    normalizeBlueskyText(source.description)
    || normalizeBlueskyText(source.body)
    || title,
  )

  return {
    recordKey: createBlueskyRecordKey(now.getTime()),
    record: {
      $type: BLUESKY_POST_COLLECTION,
      text: summary,
      createdAt: now.toISOString(),
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: publicUrl.href,
          title,
          description: summary,
        },
      },
    },
    coverImageUrl: resolveCoverImageUrl(
      source.coverImage,
      options.siteOrigin ?? publicUrl.origin,
    ),
  }
}

export async function createBlueskySession(
  config: Extract<BlueskyConfig, { status: "enabled" }>,
  fetcher: typeof fetch = fetch,
): Promise<BlueskySession> {
  const data = await xrpcJson(fetcher, BLUESKY_ENTRYWAY, "com.atproto.server.createSession", {
    body: {
      identifier: config.user,
      password: config.password,
    },
  })
  const accessJwt = stringValue(data.accessJwt)
  const did = stringValue(data.did)
  if (!accessJwt || !did) {
    throw new Error("Bluesky createSession returned an incomplete response.")
  }
  return {
    accessJwt,
    did,
    pdsUrl: resolvePdsUrl(data.didDoc),
  }
}

async function uploadBlueskyBlob(
  session: BlueskySession,
  bytes: Uint8Array,
  mimeType: string,
  fetcher: typeof fetch,
): Promise<BlueskyBlob> {
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${session.accessJwt}`,
    "content-type": mimeType,
  })
  const uploadBody = new Uint8Array(bytes.byteLength)
  uploadBody.set(bytes)
  let response: Response
  try {
    response = await fetcher(xrpcUrl(session.pdsUrl, "com.atproto.repo.uploadBlob"), {
      method: "POST",
      headers,
      body: uploadBody.buffer,
    })
  } catch {
    throw new Error("Bluesky blob upload failed before receiving a response.")
  }
  const data = await parseResponseJson(response)
  if (!response.ok) {
    throw new BlueskyXrpcError(
      "com.atproto.repo.uploadBlob",
      response.status,
      safeErrorCode(data.error),
    )
  }
  const blob = data.blob
  if (
    !blob
    || typeof blob !== "object"
    || blob.$type !== "blob"
    || typeof blob.mimeType !== "string"
    || typeof blob.size !== "number"
    || !blob.ref
    || typeof blob.ref.$link !== "string"
  ) {
    throw new Error("Bluesky blob upload returned an incomplete response.")
  }
  return blob as BlueskyBlob
}

async function readResponseBytes(response: Response, limit: number): Promise<Uint8Array | null> {
  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > limit) {
    return null
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    return bytes.byteLength <= limit ? bytes : null
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function attachBlueskyCardThumbnail(
  session: BlueskySession,
  record: BlueskyPostRecord,
  coverImageUrl: string | null,
  fetcher: typeof fetch = fetch,
): Promise<BlueskyThumbnailResult> {
  if (!coverImageUrl || record.embed.external.thumb) {
    return { record, outcome: "skipped" }
  }

  try {
    const response = await fetcher(coverImageUrl, {
      headers: {
        accept: "image/*",
      },
    })
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
    if (!response.ok || !mimeType.startsWith("image/")) {
      return { record, outcome: "skipped" }
    }
    const bytes = await readResponseBytes(response, BLUESKY_CARD_IMAGE_MAX_BYTES)
    if (!bytes) {
      return { record, outcome: "skipped" }
    }
    const thumb = await uploadBlueskyBlob(session, bytes, mimeType, fetcher)
    return {
      outcome: "attached",
      record: {
        ...record,
        embed: {
          ...record.embed,
          external: {
            ...record.embed.external,
            thumb,
          },
        },
      },
    }
  } catch {
    return { record, outcome: "skipped" }
  }
}

function canonicalizeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

async function getBlueskyRecord(
  session: BlueskySession,
  recordKey: string,
  fetcher: typeof fetch,
): Promise<{ uri: string; cid: string | null; value: unknown } | null> {
  const query = new URLSearchParams({
    repo: session.did,
    collection: BLUESKY_POST_COLLECTION,
    rkey: recordKey,
  })
  try {
    const data = await xrpcJson(fetcher, session.pdsUrl, "com.atproto.repo.getRecord", {
      accessJwt: session.accessJwt,
      query,
    })
    const uri = stringValue(data.uri)
    if (!uri || !("value" in data)) {
      throw new Error("Bluesky getRecord returned an incomplete response.")
    }
    return {
      uri,
      cid: stringValue(data.cid),
      value: data.value,
    }
  } catch (error) {
    if (
      error instanceof BlueskyXrpcError
      && (error.errorCode === "RecordNotFound" || error.status === 404)
    ) {
      return null
    }
    throw error
  }
}

function reconcileRecord(
  existing: { uri: string; cid: string | null; value: unknown } | null,
  record: BlueskyPostRecord,
): BlueskyRecordResult | null {
  if (!existing) {
    return null
  }
  if (canonicalizeJson(existing.value) !== canonicalizeJson(record)) {
    throw new BlueskyRecordConflictError()
  }
  return {
    uri: existing.uri,
    cid: existing.cid,
  }
}

export async function createOrReconcileBlueskyPost(
  session: BlueskySession,
  recordKey: string,
  record: BlueskyPostRecord,
  fetcher: typeof fetch = fetch,
): Promise<BlueskyRecordResult> {
  const existing = reconcileRecord(
    await getBlueskyRecord(session, recordKey, fetcher),
    record,
  )
  if (existing) {
    return existing
  }

  try {
    const data = await xrpcJson(fetcher, session.pdsUrl, "com.atproto.repo.createRecord", {
      accessJwt: session.accessJwt,
      body: {
        repo: session.did,
        collection: BLUESKY_POST_COLLECTION,
        rkey: recordKey,
        record,
      },
    })
    const uri = stringValue(data.uri)
    const cid = stringValue(data.cid)
    if (!uri || !cid) {
      throw new Error("Bluesky createRecord returned an incomplete response.")
    }
    return { uri, cid }
  } catch (createError) {
    try {
      const reconciled = reconcileRecord(
        await getBlueskyRecord(session, recordKey, fetcher),
        record,
      )
      if (reconciled) {
        return reconciled
      }
    } catch (reconcileError) {
      if (reconcileError instanceof BlueskyRecordConflictError) {
        throw reconcileError
      }
    }
    throw createError
  }
}

export function sanitizeBlueskyError(error: unknown): string {
  if (error instanceof BlueskyRecordConflictError || error instanceof BlueskyXrpcError) {
    return error.message
  }
  if (error instanceof Error && error.message.startsWith("Bluesky ")) {
    return error.message
  }
  return "Bluesky sharing failed."
}
