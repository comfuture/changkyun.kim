import {
  Create,
  Delete,
  Image,
  isActor,
  Link,
  Note,
  PUBLIC_COLLECTION,
  type Actor,
} from "@fedify/vocab"

import {
  ACTOR_IDENTIFIER,
  FEDIFY_BLOG_CANONICAL_HOSTNAMES,
  FEDIFY_BLOG_COLLECTION_PREFIX,
  fetchFedifyContentEntry,
  normalizeArticlePath,
  SITE_ORIGIN,
} from "./fedifyContent"
import { ensureActivityPubSchema } from "./activityPubSchema"

export type ActivityPubComment = {
  id: number
  objectId: string
  articleId: string
  articlePath: string
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
  contentText: string
  url: string
  publishedAt: string | null
  receivedAt: string
}

type CommentRow = {
  id: number
  object_id: string
  article_id: string
  article_path: string
  actor_id: string
  actor_name?: string | null
  actor_url?: string | null
  actor_icon_url?: string | null
  content_text: string
  url?: string | null
  published_at?: string | null
  received_at: string
}

const SITE_HOST = new URL(SITE_ORIGIN).host.toLowerCase()
const BLOG_HOSTS = new Set(Array.from(FEDIFY_BLOG_CANONICAL_HOSTNAMES, (host) => host.toLowerCase()))

type FedifyDocumentContext = {
  documentLoader: any
  contextLoader: any
  getDocumentLoader?: (identity: { identifier: string }) => any
}

function getDatabase() {
  return useDatabase()
}

function stringifyLanguageValue(value: unknown): string {
  if (!value) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "object") {
    const candidate = value as { value?: unknown; toString?: () => string }
    if (typeof candidate.value === "string") {
      return candidate.value
    }
    if (typeof candidate.toString === "function") {
      const text = candidate.toString()
      return text === "[object Object]" ? "" : text
    }
  }
  return ""
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "\u2026",
    ldquo: "\u201c",
    lt: "<",
    lsquo: "\u2018",
    mdash: "\u2014",
    middot: "\u00b7",
    nbsp: " ",
    ndash: "\u2013",
    quot: "\"",
    rdquo: "\u201d",
    rsquo: "\u2019",
  }
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase()
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16)
      return isValidUnicodeScalar(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10)
      return isValidUnicodeScalar(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return named[normalized] ?? match
  })
}

function isValidUnicodeScalar(codePoint: number): boolean {
  return Number.isInteger(codePoint)
    && codePoint >= 0
    && codePoint <= 0x10ffff
    && (codePoint < 0xd800 || codePoint > 0xdfff)
}

function findHtmlTagEnd(value: string, start: number): number {
  let quote: "\"" | "'" | null = null
  for (let index = start + 1; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === "\"" || char === "'") {
      quote = char
      continue
    }
    if (char === ">") {
      return index
    }
  }
  return -1
}

function stripHtmlTags(value: string): string {
  let text = ""
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char !== "<") {
      text += char
      continue
    }

    const tagEnd = findHtmlTagEnd(value, index)
    if (tagEnd < 0) {
      text += char
      continue
    }

    const tag = value.slice(index + 1, tagEnd).trim()
    if (/^br\b/i.test(tag) || /^\/p\b/i.test(tag)) {
      text += /^br\b/i.test(tag) ? "\n" : "\n\n"
    }
    index = tagEnd
  }
  return text
}

function htmlToText(value: string): string {
  return decodeHtmlEntities(
    stripHtmlTags(value)
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  )
}

function firstUrl(value: URL | Link | null): string | null {
  if (!value) {
    return null
  }
  if (value instanceof URL) {
    return value.href
  }
  const link = value as Link
  return link.href?.href ?? link.id?.href ?? null
}

function firstImageUrl(image: Image | URL | null): string | null {
  if (!image) {
    return null
  }
  if (image instanceof URL) {
    return image.href
  }
  return firstUrl(image.url)
}

function normalizeCommentTarget(target: URL): { articleId: string; articlePath: string } | null {
  const url = new URL(target.href)
  url.hash = ""
  const hostname = url.hostname.toLowerCase()
  let pathname = normalizeArticlePath(url.pathname)

  if (pathname.endsWith("/activity")) {
    pathname = normalizeArticlePath(pathname.slice(0, -"/activity".length))
  }

  if (hostname === SITE_HOST) {
    if (!pathname.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
      return null
    }
  } else if (BLOG_HOSTS.has(hostname)) {
    if (pathname !== FEDIFY_BLOG_COLLECTION_PREFIX && !pathname.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
      pathname = normalizeArticlePath(`${FEDIFY_BLOG_COLLECTION_PREFIX}${pathname}`)
    }
    if (!pathname.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
      return null
    }
  } else {
    return null
  }

  return {
    articleId: new URL(pathname, SITE_ORIGIN).href,
    articlePath: pathname,
  }
}

function isPublic(note: Note, create: Create): boolean {
  const publicHref = (PUBLIC_COLLECTION as URL).href
  const noteAudience = [...note.toIds, ...note.ccIds].map((url) => url.href)
  const createAudience = [...create.toIds, ...create.ccIds].map((url) => url.href)
  return noteAudience.includes(publicHref) || createAudience.includes(publicHref)
}

async function getLocalActorDocumentLoader(ctx: FedifyDocumentContext): Promise<any | null> {
  if (typeof ctx.getDocumentLoader !== "function") {
    return null
  }
  try {
    return await ctx.getDocumentLoader({ identifier: ACTOR_IDENTIFIER })
  } catch {
    return null
  }
}

async function getCreateActor(ctx: FedifyDocumentContext, create: Create): Promise<{
  actor: Actor
  documentLoader: any
} | null> {
  const actor = await create.getActor({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (isActor(actor) && actor.id) {
    return { actor, documentLoader: ctx.documentLoader }
  }

  const documentLoader = await getLocalActorDocumentLoader(ctx)
  if (!documentLoader || documentLoader === ctx.documentLoader) {
    return null
  }

  const authenticatedActor = await create.getActor({
    documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (!isActor(authenticatedActor) || !authenticatedActor.id) {
    return null
  }
  return { actor: authenticatedActor, documentLoader }
}

async function resolveActorProfile(ctx: FedifyDocumentContext, create: Create, note: Note): Promise<{
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
} | null> {
  const actorResult = await getCreateActor(ctx, create)
  if (!actorResult) {
    return null
  }
  const { actor, documentLoader } = actorResult

  const noteActorId = note.attributionId?.href
  if (noteActorId && noteActorId !== actor.id.href) {
    return null
  }

  const actorName = stringifyLanguageValue(actor.name)
    || stringifyLanguageValue(actor.preferredUsername)
    || actor.id.hostname
  const actorUrl = firstUrl(actor.url) ?? actor.id.href
  const icon = await actor.getIcon({
    documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })

  return {
    actorId: actor.id.href,
    actorName,
    actorUrl,
    actorIconUrl: firstImageUrl(icon),
  }
}

export async function persistCommentFromCreate(ctx: FedifyDocumentContext, create: Create): Promise<boolean> {
  const object = await create.getObject({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (!(object instanceof Note) || !object.id) {
    return false
  }
  if (!isPublic(object, create)) {
    return false
  }

  const target = object.replyTargetId ? normalizeCommentTarget(object.replyTargetId) : null
  if (!target) {
    return false
  }
  const entry = await fetchFedifyContentEntry("blog", target.articlePath)
  if (!entry) {
    return false
  }

  const actor = await resolveActorProfile(ctx, create, object)
  if (!actor) {
    return false
  }

  const contentHtml = stringifyLanguageValue(object.content)
  const contentText = htmlToText(contentHtml)
  if (!contentText) {
    return false
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = JSON.stringify(await create.toJsonLd({ format: "compact" }))
  const publishedAt = object.published?.toString() ?? create.published?.toString() ?? new Date().toISOString()
  const commentUrl = firstUrl(object.url) ?? object.id.href
  const activityId = create.id?.href ?? null

  await db.sql`INSERT INTO activitypub_comments (
    object_id,
    activity_id,
    article_id,
    article_path,
    actor_id,
    actor_name,
    actor_url,
    actor_icon_url,
    content_text,
    content_html,
    url,
    published_at,
    status,
    payload
  ) VALUES (
    ${object.id.href},
    ${activityId},
    ${target.articleId},
    ${target.articlePath},
    ${actor.actorId},
    ${actor.actorName},
    ${actor.actorUrl},
    ${actor.actorIconUrl},
    ${contentText},
    ${contentHtml},
    ${commentUrl},
    ${publishedAt},
    'visible',
    ${payload}
  )
  ON CONFLICT(object_id) DO UPDATE SET
    activity_id = excluded.activity_id,
    article_id = excluded.article_id,
    article_path = excluded.article_path,
    actor_id = excluded.actor_id,
    actor_name = excluded.actor_name,
    actor_url = excluded.actor_url,
    actor_icon_url = excluded.actor_icon_url,
    content_text = excluded.content_text,
    content_html = excluded.content_html,
    url = excluded.url,
    published_at = excluded.published_at,
    status = 'visible',
    payload = excluded.payload,
    updated_at = CURRENT_TIMESTAMP`

  return true
}

export async function markCommentDeletedFromDelete(ctx: FedifyDocumentContext, del: Delete): Promise<boolean> {
  const actor = await del.getActor({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (!isActor(actor) || !actor.id || !del.objectId) {
    return false
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT actor_id FROM activitypub_comments WHERE object_id = ${del.objectId.href} LIMIT 1`
  const existing = rows?.[0] as { actor_id?: string | null } | undefined
  if (!existing || existing.actor_id !== actor.id.href) {
    return false
  }

  await db.sql`UPDATE activitypub_comments
    SET status = 'deleted',
        updated_at = CURRENT_TIMESTAMP
    WHERE object_id = ${del.objectId.href}
      AND actor_id = ${actor.id.href}`
  return true
}

export async function listActivityPubComments(articlePath: string): Promise<ActivityPubComment[]> {
  const normalizedPath = normalizeArticlePath(articlePath)
  if (!normalizedPath.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
    return []
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT
      id,
      object_id,
      article_id,
      article_path,
      actor_id,
      actor_name,
      actor_url,
      actor_icon_url,
      content_text,
      url,
      published_at,
      received_at
    FROM activitypub_comments
    WHERE article_path = ${normalizedPath}
      AND status = 'visible'
    ORDER BY published_at ASC, id ASC`

  return ((rows ?? []) as CommentRow[]).map((row) => ({
    id: row.id,
    objectId: row.object_id,
    articleId: row.article_id,
    articlePath: row.article_path,
    actorId: row.actor_id,
    actorName: row.actor_name || row.actor_id,
    actorUrl: row.actor_url || row.actor_id,
    actorIconUrl: row.actor_icon_url || null,
    contentText: row.content_text,
    url: row.url || row.object_id,
    publishedAt: row.published_at || null,
    receivedAt: row.received_at,
  }))
}
