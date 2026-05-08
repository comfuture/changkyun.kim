import { queryCollection } from "@nuxt/content/server"
import { checksums } from "#content/manifest"
import { createError, getHeader, getRequestURL, readRawBody, setHeader, setResponseStatus } from "h3"
import type { H3Event } from "h3"
import embeddedContentDumps from "#content-dump-generated"

import { createFedify, getCloudflareEnv } from "../utils/fedify"
import {
  buildArticleFromEntry,
  buildCreateFromEntry,
  FEDIFY_BLOG_CANONICAL_HOSTNAMES,
  FEDIFY_BLOG_COLLECTION_PREFIX,
  fetchFedifyContentEntry,
  normalizeArticlePath,
  SITE_ORIGIN,
  type FedifyContentEntry,
} from "../utils/fedifyContent"

const BLOG_HOSTS = new Set(Array.from(FEDIFY_BLOG_CANONICAL_HOSTNAMES, (host) => host.toLowerCase()))
const ACTIVITY_SUFFIX = "/activity"
const CONTENT_COLUMNS = [
  "id",
  "title",
  "body",
  "coverImage",
  "createdAt",
  "description",
  "extension",
  "meta",
  "navigation",
  "path",
  "seo",
  "stem",
  "tags",
  "__hash__",
] as const
const dumpEntryCache = new Map<string, Promise<Map<string, FedifyContentEntry>>>()
const contentSyncCache = new Map<string, Promise<void>>()

type EventWithFetch = H3Event & {
  $fetch?: <T = unknown>(request: string, options?: {
    body?: unknown
    headers?: Record<string, string | undefined>
    method?: string
    query?: Record<string, string | number | undefined>
    responseType?: "text"
  }) => Promise<T>
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  first: <T = Record<string, unknown>>() => Promise<T | null>
  run: () => Promise<unknown>
}

type D1Database = {
  prepare: (query: string) => D1PreparedStatement
  batch: (statements: D1PreparedStatement[]) => Promise<unknown[]>
}

type ContentSyncEnv = {
  ASSETS?: {
    fetch: (request: Request | string) => Promise<Response>
  }
  DB?: D1Database
}

type EventWithCloudflarePlatform = H3Event & {
  context: H3Event["context"] & {
    cloudflare?: unknown
    _platform?: {
      cloudflare?: unknown
    }
  }
}

function acceptsActivityPub(acceptHeader?: string | null): boolean {
  if (!acceptHeader) {
    return false
  }
  const normalized = acceptHeader.toLowerCase()
  return normalized.includes("application/activity+json")
    || normalized.includes("activity+json")
    || (normalized.includes("ld+json") && normalized.includes("activitystreams"))
    || (normalized.includes("json") && normalized.includes("profile=") && normalized.includes("activitystreams"))
}

function isFederationRequest(method: string, pathname: string, accept?: string | null): boolean {
  if ((pathname === "/inbox" || pathname === "/@me/inbox") && method === "POST") {
    return true
  }
  if (pathname === "/@me" || pathname.startsWith("/@me/")) {
    return acceptsActivityPub(accept)
  }
  if ((pathname.startsWith("/blog/") || pathname.startsWith("/app/")) && acceptsActivityPub(accept)) {
    return true
  }
  if (pathname.endsWith("/activity") && acceptsActivityPub(accept)) {
    return true
  }
  return false
}

function exposeCloudflareContextForNuxtContent(event: H3Event) {
  const context = event.context as EventWithCloudflarePlatform["context"]
  if (!context.cloudflare && context._platform?.cloudflare) {
    context.cloudflare = context._platform.cloudflare
  }
}

function toFedifyUrl(url: URL): URL {
  const fedifyUrl = new URL(url.href)
  fedifyUrl.protocol = "https:"
  fedifyUrl.host = new URL(SITE_ORIGIN).host

  const hostname = url.hostname.toLowerCase()
  if (BLOG_HOSTS.has(hostname)) {
    let pathname = url.pathname || "/"
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.replace(/\/+$/, "")
    }
    const isReservedFederationPath = pathname.startsWith("/.well-known/")
      || pathname === "/inbox"
      || pathname === "/@me"
      || pathname.startsWith("/@me/")
    if (
      pathname !== "/"
      && !isReservedFederationPath
      && pathname !== FEDIFY_BLOG_COLLECTION_PREFIX
      && !pathname.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)
    ) {
      fedifyUrl.pathname = `${FEDIFY_BLOG_COLLECTION_PREFIX}${pathname}`
    }
  }

  return fedifyUrl
}

function isDraftEntry(entry: FedifyContentEntry | null): boolean {
  return entry?.draft === true
}

function resolveContentRequestPath(url: URL): {
  collection: "blog" | "app"
  path: string
  wantsCreateActivity: boolean
} | null {
  let pathname = normalizeArticlePath(url.pathname)
  let wantsCreateActivity = false

  if (pathname !== "/" && pathname.endsWith(ACTIVITY_SUFFIX)) {
    wantsCreateActivity = true
    pathname = normalizeArticlePath(pathname.slice(0, -ACTIVITY_SUFFIX.length))
  }

  if (pathname.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
    return {
      collection: "blog",
      path: pathname,
      wantsCreateActivity,
    }
  }
  if (pathname.startsWith("/app/")) {
    return {
      collection: "app",
      path: pathname,
      wantsCreateActivity,
    }
  }
  return null
}

function resolveContentSyncTarget(pathname: string): { collection: "blog" | "app", path?: string } | null {
  const normalized = normalizeArticlePath(pathname)
  if (normalized.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
    return { collection: "blog", path: normalized }
  }
  if (normalized.startsWith("/app/")) {
    return { collection: "app", path: normalized }
  }
  if (normalized === FEDIFY_BLOG_COLLECTION_PREFIX || normalized.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/tag`)) {
    return { collection: "blog" }
  }
  if (normalized === "/__nuxt_content/blog/query") {
    return { collection: "blog" }
  }
  if (normalized === "/__nuxt_content/app/query") {
    return { collection: "app" }
  }
  return null
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"))
  }
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function decompressSqlDump(value: string): Promise<string[]> {
  const stream = new Response(new Blob([base64ToBytes(value.trim())]))
    .body
    ?.pipeThrough(new DecompressionStream("gzip"))
  return JSON.parse(await new Response(stream).text())
}

async function loadContentDumpLines(event: H3Event, collection: "blog" | "app"): Promise<string[]> {
  try {
    return await decompressSqlDump(await fetchContentDump(event, collection))
  } catch (error) {
    const embeddedDump = embeddedContentDumps[collection]
    if (embeddedDump) {
      return await decompressSqlDump(embeddedDump)
    }
    throw error
  }
}

async function fetchContentDump(event: H3Event, collection: "blog" | "app"): Promise<string> {
  const dumpPaths = [
    `/dump.${collection}.sql`,
    `/__nuxt_content/${collection}/sql_dump.txt`,
  ]
  const requestUrl = getRequestURL(event)
  const env = getCloudflareEnv(event) as ContentSyncEnv | undefined

  for (const dumpPath of dumpPaths) {
    const dumpUrl = new URL(dumpPath, requestUrl)
    const assetResponse = await env?.ASSETS?.fetch(new Request(dumpUrl, {
      headers: { accept: "text/plain" },
    }))
    if (assetResponse?.ok) {
      return await assetResponse.text()
    }
  }

  for (const dumpPath of dumpPaths) {
    const response = await fetch(new URL(dumpPath, requestUrl), {
      headers: { accept: "text/plain" },
      signal: AbortSignal.timeout(3_000),
    }).catch(() => null)
    if (response?.ok) {
      return await response.text()
    }
  }

  const internalFetch = (event as EventWithFetch).$fetch
  if (internalFetch) {
    for (const dumpPath of dumpPaths) {
      const value = await internalFetch<string | undefined>(dumpPath, {
        responseType: "text",
        headers: { "content-type": "text/plain" },
        query: { v: checksums[collection] },
      }).catch(() => undefined)
      if (typeof value === "string" && value.trim()) {
        return value
      }
    }
  }

  if (requestUrl.origin !== SITE_ORIGIN) {
    for (const dumpPath of dumpPaths) {
      const canonicalResponse = await fetch(new URL(dumpPath, SITE_ORIGIN), {
        headers: { accept: "text/plain" },
        signal: AbortSignal.timeout(3_000),
      }).catch(() => null)
      if (canonicalResponse?.ok) {
        return await canonicalResponse.text()
      }
    }
  }

  throw createError({
    statusCode: 500,
    statusMessage: `Unable to fetch Nuxt Content dump for ${collection}`,
  })
}

function parseSqlValues(statement: string): unknown[] | null {
  const start = statement.indexOf(" VALUES (")
  const end = statement.lastIndexOf("); --")
  if (start < 0 || end < 0) {
    return null
  }

  const source = statement.slice(start + " VALUES (".length, end)
  const values: unknown[] = []
  let index = 0

  while (index < source.length) {
    while (source[index] === " ") {
      index += 1
    }

    if (source[index] === "'") {
      index += 1
      let value = ""
      while (index < source.length) {
        const char = source[index]
        if (char === "'") {
          if (source[index + 1] === "'") {
            value += "'"
            index += 2
            continue
          }
          index += 1
          break
        }
        value += char
        index += 1
      }
      values.push(value)
    } else {
      const next = source.indexOf(",", index)
      const raw = source.slice(index, next < 0 ? source.length : next).trim()
      values.push(raw.toUpperCase() === "NULL" ? null : raw)
      index = next < 0 ? source.length : next
    }

    while (source[index] === " ") {
      index += 1
    }
    if (source[index] === ",") {
      index += 1
    }
  }

  return values
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function toDumpEntry(values: unknown[]): FedifyContentEntry | null {
  const row = Object.fromEntries(CONTENT_COLUMNS.map((column, index) => [column, values[index]]))
  const path = typeof row.path === "string" ? row.path : null
  if (!path) {
    return null
  }

  const meta = parseJson(row.meta) as { draft?: boolean } | null
  const tags = parseJson(row.tags)
  return {
    id: typeof row.id === "string" ? row.id : null,
    _id: typeof row.id === "string" ? row.id : null,
    path,
    _path: path,
    body: parseJson(row.body),
    title: typeof row.title === "string" ? row.title : null,
    stem: typeof row.stem === "string" ? row.stem : null,
    description: typeof row.description === "string" ? row.description : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    draft: Boolean(meta && typeof meta === "object" && meta.draft === true),
    tags: Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  }
}

async function loadDumpEntries(event: H3Event, collection: "blog" | "app"): Promise<Map<string, FedifyContentEntry>> {
  const cached = dumpEntryCache.get(collection)
  if (cached) {
    return await cached
  }

  const promise = (async () => {
    const lines = await loadContentDumpLines(event, collection)
    const tableName = collection === "blog" ? "_content_blog" : "_content_app"
    const entries = new Map<string, FedifyContentEntry>()

    for (const line of lines) {
      if (!line.startsWith(`INSERT INTO ${tableName} VALUES (`)) {
        continue
      }
      const values = parseSqlValues(line)
      const entry = values ? toDumpEntry(values) : null
      if (entry?.path && !entry.draft) {
        entries.set(normalizeArticlePath(entry.path), entry)
      }
    }
    return entries
  })().catch((error) => {
    dumpEntryCache.delete(collection)
    throw error
  })

  dumpEntryCache.set(collection, promise)
  return await promise
}

async function fetchContentEntryFromDump(
  event: H3Event,
  collection: "blog" | "app",
  path: string,
): Promise<FedifyContentEntry | null> {
  const entries = await loadDumpEntries(event, collection)
  return entries.get(normalizeArticlePath(path)) ?? null
}

function getDumpStatement(line: string): string | null {
  const hash = line.split(" -- ").pop()
  if (!hash) {
    return null
  }
  const statement = line.substring(0, line.length - hash.length - 4).trim()
  return statement || null
}

function isReadyValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true"
}

async function contentChecksumIsCurrent(db: D1Database, collection: "blog" | "app"): Promise<boolean> {
  const row = await db.prepare("SELECT version, ready FROM _content_info WHERE id = ? LIMIT 1")
    .bind(`checksum_${collection}`)
    .first<{ version?: string | null, ready?: unknown }>()
    .catch(() => null)

  return row?.version === checksums[collection] && isReadyValue(row.ready)
}

async function importContentDump(db: D1Database, collection: "blog" | "app", lines: string[]): Promise<void> {
  const checksumId = `checksum_${collection}`
  const deleteChecksum = () => db.prepare("DELETE FROM _content_info WHERE id = ?")
    .bind(checksumId)
    .run()
    .catch(() => undefined)

  await deleteChecksum()

  try {
    const statements: D1PreparedStatement[] = []
    for (const line of lines) {
      const statement = getDumpStatement(line)
      if (!statement) {
        continue
      }
      statements.push(db.prepare(statement))
    }

    if (statements.length > 0) {
      await db.batch(statements)
    }

    await db.prepare("INSERT INTO _content_info (id, version, ready) VALUES (?, ?, 1)")
      .bind(checksumId, checksums[collection])
      .run()
  } catch (error) {
    await deleteChecksum()
    throw error
  }
}

async function ensureContentD1Synced(
  event: H3Event,
  collection: "blog" | "app",
): Promise<void> {
  const env = getCloudflareEnv(event) as ContentSyncEnv | undefined
  const db = env?.DB
  if (!db) {
    return
  }

  const cacheKey = collection
  const cached = contentSyncCache.get(cacheKey)
  if (cached) {
    return await cached
  }

  const promise = (async () => {
    if (await contentChecksumIsCurrent(db, collection)) {
      return
    }

    await importContentDump(db, collection, await loadContentDumpLines(event, collection))
  })().catch((error) => {
    contentSyncCache.delete(cacheKey)
    console.error("Failed to prepare Nuxt Content D1 cache", error)
    throw error
  })

  contentSyncCache.set(cacheKey, promise)
  return await promise
}

async function maybeHandleContentObject(event: H3Event, url: URL): Promise<unknown> {
  if (event.method !== "GET" && event.method !== "HEAD") {
    return undefined
  }

  const requestPath = resolveContentRequestPath(url)
  if (!requestPath) {
    return undefined
  }

  let entry: FedifyContentEntry | null = null
  try {
    entry = await queryCollection(event, requestPath.collection)
      .path(requestPath.path)
      .first() as FedifyContentEntry | null
    if (isDraftEntry(entry)) {
      entry = null
    }
  } catch (error) {
    console.error("Failed to query Nuxt Content for ActivityPub object", error)
  }

  if (!entry) {
    try {
      entry = await fetchFedifyContentEntry(requestPath.collection, requestPath.path)
    } catch (error) {
      console.error("Failed to query content database for ActivityPub object", error)
    }
  }

  if (!entry) {
    try {
      entry = await fetchContentEntryFromDump(event, requestPath.collection, requestPath.path)
    } catch (error) {
      console.error("Failed to read Nuxt Content dump for ActivityPub object", error)
    }
  }

  if (!entry) {
    setHeader(event, "content-type", "application/activity+json")
    setHeader(event, "vary", "Accept")
    setResponseStatus(event, 404)

    if (event.method === "HEAD") {
      return null
    }
    return {
      error: true,
      statusCode: 404,
      statusMessage: "ActivityPub object not found",
    }
  }

  const object = requestPath.wantsCreateActivity
    ? await buildCreateFromEntry(entry)
    : await buildArticleFromEntry(entry)
  if (!object) {
    return undefined
  }

  setHeader(event, "content-type", "application/activity+json")
  setHeader(event, "vary", "Accept")

  if (event.method === "HEAD") {
    return null
  }
  return await object.toJsonLd({ format: "compact" })
}

export default defineEventHandler(async (event) => {
  exposeCloudflareContextForNuxtContent(event)

  const url = getRequestURL(event)
  const fedifyUrl = toFedifyUrl(url)
  const accept = getHeader(event, "accept")
  const isFederation = isFederationRequest(event.method, fedifyUrl.pathname, accept)
  const syncTarget = resolveContentSyncTarget(url.pathname)
    ?? (isFederation ? resolveContentSyncTarget(fedifyUrl.pathname) : null)

  if (syncTarget && (event.method === "GET" || event.method === "HEAD" || event.method === "POST")) {
    await ensureContentD1Synced(event, syncTarget.collection)
  }

  if (!isFederation) {
    return
  }

  const contentObject = await maybeHandleContentObject(event, fedifyUrl)
  if (contentObject !== undefined) {
    return contentObject
  }

  const headers = new Headers(event.headers)
  headers.set("host", fedifyUrl.host)

  const body = event.method === "GET" || event.method === "HEAD"
    ? undefined
    : await readRawBody(event)

  const request = new Request(fedifyUrl, {
    method: event.method,
    headers,
    body,
  })

  const federation = await createFedify(getCloudflareEnv(event))
  return await federation.fetch(request, {
    contextData: { env: getCloudflareEnv(event) },
  })
})
