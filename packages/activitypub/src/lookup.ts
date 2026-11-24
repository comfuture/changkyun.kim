// WebFinger, object lookup and collection traversal.

import { FetchError, type DocumentLoader } from "./loader.ts"
import { asArray, idOf, isActor, isObject, type JsonObject } from "./vocab.ts"

const HANDLE_PATTERN = /^@?([^@\s/]+)@([^@\s/]+)$/

/** Parses `@user@host`, `user@host` and `acct:user@host`. */
export function parseHandle(value: string): { username: string; host: string } | null {
  const trimmed = value.trim().replace(/^acct:/i, "")
  const match = HANDLE_PATTERN.exec(trimmed)
  if (!match?.[1] || !match[2]) {
    return null
  }
  return { username: match[1], host: match[2].toLowerCase() }
}

/** Resolves an account handle to its ActivityPub actor IRI via WebFinger. */
export async function webfinger(loader: DocumentLoader, handle: string): Promise<string | null> {
  const parsed = parseHandle(handle)
  if (!parsed) {
    return null
  }
  const url = new URL(`https://${parsed.host}/.well-known/webfinger`)
  url.searchParams.set("resource", `acct:${parsed.username}@${parsed.host}`)
  let document: JsonObject
  try {
    document = await loader.fetchJson(url, { accept: "application/jrd+json, application/json", sign: false })
  } catch (error) {
    if (error instanceof FetchError) {
      return null
    }
    throw error
  }
  for (const link of asArray(document.links)) {
    if (!isObject(link) || link.rel !== "self" || typeof link.href !== "string") {
      continue
    }
    const type = typeof link.type === "string" ? link.type : ""
    if (type.includes("activity+json") || (type.includes("ld+json") && type.includes("activitystreams"))) {
      return link.href
    }
  }
  return null
}

/**
 * Looks up an object by IRI or account handle. Actors are served from the
 * KV cache. Returns `null` when the object cannot be found.
 */
export async function lookupObject(loader: DocumentLoader, identifier: string | URL): Promise<JsonObject | null> {
  const value = String(identifier).trim()
  let target: string | null = value
  if (/^acct:/i.test(value) || (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && parseHandle(value))) {
    target = await webfinger(loader, value)
    if (!target) {
      return null
    }
  }
  try {
    const document = await loader.load(target, { cache: false })
    if (isActor(document)) {
      await loader.remember(target, document)
    }
    return document
  } catch (error) {
    if (error instanceof FetchError) {
      return null
    }
    throw error
  }
}

async function resolve(loader: DocumentLoader, value: unknown): Promise<JsonObject | null> {
  if (isObject(value)) {
    return value
  }
  if (typeof value === "string") {
    try {
      return await loader.load(value)
    } catch {
      return null
    }
  }
  return null
}

function pageItems(page: JsonObject): unknown[] {
  return page.orderedItems !== undefined ? asArray(page.orderedItems) : asArray(page.items)
}

/**
 * Iterates the items of a (possibly paged) collection: inline `orderedItems`
 * / `items`, then `first` and every `next` page (inline or by IRI). IRI items
 * are dereferenced; items that fail to load are skipped.
 */
export async function* traverseCollection(
  loader: DocumentLoader,
  collection: JsonObject | string,
  options: { maxPages?: number } = {},
): AsyncGenerator<JsonObject> {
  const maxPages = options.maxPages ?? 20
  const root = await resolve(loader, collection)
  if (!root) {
    return
  }
  const seen = new Set<string>()
  let page: JsonObject | null = root
  let pages = 0
  while (page && pages < maxPages) {
    const pageId = idOf(page)
    if (pageId) {
      if (seen.has(pageId)) {
        break
      }
      seen.add(pageId)
    }
    pages += 1
    for (const item of pageItems(page)) {
      const resolved = await resolve(loader, item)
      if (resolved) {
        yield resolved
      }
    }
    const next: unknown = page === root ? (root.first ?? root.next) : page.next
    page = next === undefined || next === null ? null : await resolve(loader, next)
  }
}
