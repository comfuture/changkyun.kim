import {
  Create,
  Delete,
  Image,
  isActor,
  Link,
  Note,
  PUBLIC_COLLECTION,
} from "@fedify/vocab"
import { Temporal } from "@js-temporal/polyfill"

import {
  FEDIFY_BLOG_CANONICAL_HOSTNAMES,
  FEDIFY_BLOG_COLLECTION_PREFIX,
  ACTOR_IDENTIFIER,
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
  replyTargetId: string | null
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
  reply_target_id?: string | null
  published_at?: string | null
  received_at: string
}

const SITE_HOST = new URL(SITE_ORIGIN).host.toLowerCase()
const BLOG_HOSTS = new Set(Array.from(FEDIFY_BLOG_CANONICAL_HOSTNAMES, (host) => host.toLowerCase()))
const ACTOR_URI = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN)
const LOCAL_REPLY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type LocalReplyObjectRow = {
  object_id: string
  activity_id?: string | null
  content_text: string
  content_html?: string | null
  reply_target_id?: string | null
  published_at?: string | null
  target_actor_id?: string | null
  payload?: string | null
}

type LocalReplyActivityRow = {
  activity_id: string
  object?: string | null
  payload?: string | null
}

type LocalReplyActivityPayloadRow = {
  activity_id?: string | null
  object?: string | null
  payload?: string | null
}

function getDatabase() {
  return useDatabase()
}

function normalizeLocalReplyId(value: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }
  return LOCAL_REPLY_ID_PATTERN.test(decoded) ? decoded : null
}

function localReplyObjectHref(replyId: string): string | null {
  const normalized = normalizeLocalReplyId(replyId)
  return normalized ? new URL(`/@${ACTOR_IDENTIFIER}/replies/${normalized}`, SITE_ORIGIN).href : null
}

function localReplyActivityHref(replyId: string): string | null {
  const normalized = normalizeLocalReplyId(replyId)
  return normalized ? new URL(`/activitypub/replies/${normalized}/activity`, SITE_ORIGIN).href : null
}

export function createLocalReplyPermalinks(replyId = crypto.randomUUID()): { objectId: URL; activityId: URL } {
  const objectHref = localReplyObjectHref(replyId)
  const activityHref = localReplyActivityHref(replyId)
  if (!objectHref || !activityHref) {
    throw new Error("Invalid local reply id")
  }
  return {
    objectId: new URL(objectHref),
    activityId: new URL(activityHref),
  }
}

function parseUrl(value?: string | null): URL | null {
  if (!value) {
    return null
  }
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function parseInstant(value?: string | null): Temporal.Instant | null {
  if (!value) {
    return null
  }
  try {
    return Temporal.Instant.from(value)
  } catch {
    return null
  }
}

function firstPayloadUrl(value: unknown): URL | null {
  if (!value) {
    return null
  }
  if (typeof value === "string") {
    return parseUrl(value)
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstPayloadUrl(item)
      if (url) {
        return url
      }
    }
    return null
  }
  if (typeof value === "object") {
    const candidate = value as { id?: unknown; href?: unknown }
    if (typeof candidate.id === "string") {
      return parseUrl(candidate.id)
    }
    if (typeof candidate.href === "string") {
      return parseUrl(candidate.href)
    }
  }
  return null
}

function parsePayloadObject(value?: string | null): Record<string, unknown> | null {
  if (!value) {
    return null
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
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

async function resolveCommentTarget(target: URL): Promise<{ articleId: string; articlePath: string } | null> {
  const articleTarget = normalizeCommentTarget(target)
  if (articleTarget) {
    return articleTarget
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT article_id, article_path
    FROM activitypub_comments
    WHERE object_id = ${target.href}
    LIMIT 1`
  const parent = rows?.[0] as { article_id?: string | null; article_path?: string | null } | undefined
  if (!parent?.article_id || !parent.article_path) {
    return null
  }

  return {
    articleId: parent.article_id,
    articlePath: parent.article_path,
  }
}

function isPublic(note: Note, create: Create): boolean {
  const publicHref = (PUBLIC_COLLECTION as URL).href
  const noteAudience = [...note.toIds, ...note.ccIds].map((url) => url.href)
  const createAudience = [...create.toIds, ...create.ccIds].map((url) => url.href)
  return noteAudience.includes(publicHref) || createAudience.includes(publicHref)
}

async function resolveActorProfile(ctx: { documentLoader: any; contextLoader: any }, create: Create, note: Note): Promise<{
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
} | null> {
  const actor = await create.getActor({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (!isActor(actor) || !actor.id) {
    return null
  }

  const noteActorId = note.attributionId?.href
  if (noteActorId && noteActorId !== actor.id.href) {
    return null
  }

  const actorName = stringifyLanguageValue(actor.name)
    || stringifyLanguageValue(actor.preferredUsername)
    || actor.id.hostname
  const actorUrl = firstUrl(actor.url) ?? actor.id.href
  const icon = await actor.getIcon({
    documentLoader: ctx.documentLoader,
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

export async function persistCommentFromCreate(ctx: { documentLoader: any; contextLoader: any }, create: Create): Promise<boolean> {
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

  const replyTargetId = object.replyTargetId?.href ?? null
  const target = object.replyTargetId ? await resolveCommentTarget(object.replyTargetId) : null
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
    reply_target_id,
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
    ${replyTargetId},
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
    reply_target_id = excluded.reply_target_id,
    published_at = excluded.published_at,
    status = 'visible',
    payload = excluded.payload,
    updated_at = CURRENT_TIMESTAMP`

  return true
}

export async function persistLocalReplyComment(input: {
  objectId: string
  activityId: string | null
  articleId: string
  articlePath: string
  replyTargetId: string
  contentText: string
  contentHtml?: string | null
  url?: string | null
  publishedAt: string
  payload?: string | null
}): Promise<void> {
  await ensureActivityPubSchema()
  const actorId = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN).href
  const db = getDatabase()

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
    reply_target_id,
    published_at,
    status,
    payload
  ) VALUES (
    ${input.objectId},
    ${input.activityId},
    ${input.articleId},
    ${input.articlePath},
    ${actorId},
    'Changkyun Kim',
    ${new URL("/about", SITE_ORIGIN).href},
    ${new URL("/image/avatar.jpg", SITE_ORIGIN).href},
    ${input.contentText},
    ${input.contentHtml ?? null},
    ${input.url ?? input.objectId},
    ${input.replyTargetId},
    ${input.publishedAt},
    'visible',
    ${input.payload ?? null}
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
    reply_target_id = excluded.reply_target_id,
    published_at = excluded.published_at,
    status = 'visible',
    payload = excluded.payload,
    updated_at = CURRENT_TIMESTAMP`
}

export async function discardLocalReplyComment(objectId: string): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  await db.sql`DELETE FROM activitypub_comments
    WHERE object_id = ${objectId}
      AND actor_id = ${ACTOR_URI.href}`
}

export async function persistLocalReplyActivity(create: Create): Promise<void> {
  const activityId = create.id?.href
  const objectId = create.objectId?.href
  if (!activityId || !objectId) {
    throw new Error("Cannot persist local reply activity without id and object id.")
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = JSON.stringify(await create.toJsonLd({ format: "compact" }))

  await db.sql`INSERT INTO activity (
    activity_id,
    actor_id,
    type,
    object,
    payload,
    direction
  ) VALUES (
    ${activityId},
    ${ACTOR_URI.href},
    'Create',
    ${objectId},
    ${payload},
    'outbox'
  )
  ON CONFLICT(activity_id) DO UPDATE SET
    actor_id = excluded.actor_id,
    type = excluded.type,
    object = excluded.object,
    payload = excluded.payload,
    direction = 'outbox',
    updated_at = CURRENT_TIMESTAMP`
}

export async function discardLocalReplyActivity(activityId: string): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  await db.sql`DELETE FROM activity
    WHERE activity_id = ${activityId}
      AND actor_id = ${ACTOR_URI.href}
      AND type = 'Create'
      AND direction = 'outbox'`
}

async function loadLocalReplyObjectRow(replyId: string): Promise<LocalReplyObjectRow | null> {
  const objectHref = localReplyObjectHref(replyId)
  if (!objectHref) {
    return null
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT
      reply.object_id,
      reply.activity_id,
      reply.content_text,
      reply.content_html,
      reply.reply_target_id,
      reply.published_at,
      reply.payload,
      parent.actor_id AS target_actor_id
    FROM activitypub_comments reply
    LEFT JOIN activitypub_comments parent
      ON parent.object_id = reply.reply_target_id
    WHERE reply.object_id = ${objectHref}
      AND reply.actor_id = ${ACTOR_URI.href}
      AND reply.status = 'visible'
    LIMIT 1`

  const row = rows?.[0] as LocalReplyObjectRow | undefined
  return row?.object_id && row.content_text ? row : null
}

async function loadLocalReplyActivityRow(replyId: string): Promise<LocalReplyActivityRow | null> {
  const objectHref = localReplyObjectHref(replyId)
  const activityHref = localReplyActivityHref(replyId)
  if (!objectHref || !activityHref) {
    return null
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT activity_id, object, payload
    FROM activity
    WHERE activity_id = ${activityHref}
      AND object = ${objectHref}
      AND actor_id = ${ACTOR_URI.href}
      AND type = 'Create'
      AND direction = 'outbox'
    LIMIT 1`
  const row = rows?.[0] as LocalReplyActivityRow | undefined
  return row?.activity_id && row.payload ? row : null
}

function buildLocalReplyNote(row: LocalReplyObjectRow): Note | null {
  const objectId = parseUrl(row.object_id)
  const replyTarget = parseUrl(row.reply_target_id)
  if (!objectId || !replyTarget) {
    return null
  }

  const targetActor = parseUrl(row.target_actor_id)
  const published = parseInstant(row.published_at)
  const content = row.content_html || row.content_text

  return new Note({
    id: objectId,
    attribution: ACTOR_URI,
    content,
    mediaType: row.content_html ? "text/html" : "text/plain",
    replyTarget,
    ...(targetActor ? { to: targetActor } : {}),
    cc: PUBLIC_COLLECTION,
    ...(published ? { published } : {}),
  })
}

async function parseLocalReplyCreateFromPayload(row: LocalReplyActivityPayloadRow): Promise<Create | null> {
  const payload = parsePayloadObject(row.payload)
  if (!payload) {
    return null
  }

  try {
    const create = await Create.fromJsonLd(payload)
    const activityId = parseUrl(row.activity_id)
    const objectId = parseUrl(row.object)
    if (activityId && create.id?.href !== activityId.href) {
      return null
    }
    if (objectId && create.objectId?.href !== objectId.href) {
      return null
    }
    if (!create.actorIds.some((actorId) => actorId.href === ACTOR_URI.href)) {
      return null
    }
    return create
  } catch {
    return null
  }
}

async function buildLocalReplyNoteFromActivity(row: LocalReplyActivityPayloadRow): Promise<Note | null> {
  const create = await parseLocalReplyCreateFromPayload(row)
  if (create) {
    const object = await create.getObject({ suppressError: true })
    if (object instanceof Note) {
      return object
    }
  }

  const payload = parsePayloadObject(row.payload)
  const object = payload?.object
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return null
  }

  const note = object as Record<string, unknown>
  const objectId = firstPayloadUrl(note.id)
  const replyTarget = firstPayloadUrl(note.inReplyTo)
  const content = stringifyLanguageValue(note.content)
  if (!objectId || !replyTarget || !content) {
    return null
  }

  const targetActor = firstPayloadUrl(note.to) ?? firstPayloadUrl(payload.to)
  const published = parseInstant(
    typeof note.published === "string"
      ? note.published
      : typeof payload.published === "string"
        ? payload.published
        : null,
  )
  const mediaType = typeof note.mediaType === "string" ? note.mediaType : "text/plain"

  return new Note({
    id: objectId,
    attribution: ACTOR_URI,
    content,
    mediaType,
    replyTarget,
    ...(targetActor ? { to: targetActor } : {}),
    cc: PUBLIC_COLLECTION,
    ...(published ? { published } : {}),
  })
}

export async function loadLocalReplyNote(replyId: string): Promise<Note | null> {
  const row = await loadLocalReplyObjectRow(replyId)
  if (row) {
    if (row.payload) {
      const note = await buildLocalReplyNoteFromActivity({
        activity_id: row.activity_id ?? null,
        object: row.object_id,
        payload: row.payload,
      })
      if (note) {
        return note
      }
    }
    return buildLocalReplyNote(row)
  }
  const activityRow = await loadLocalReplyActivityRow(replyId)
  return activityRow ? await buildLocalReplyNoteFromActivity(activityRow) : null
}

export async function loadLocalReplyCreate(replyId: string): Promise<Create | null> {
  const row = await loadLocalReplyObjectRow(replyId)
  if (row) {
    if (row.payload) {
      const create = await parseLocalReplyCreateFromPayload({
        activity_id: row.activity_id ?? null,
        object: row.object_id,
        payload: row.payload,
      })
      if (create) {
        return create
      }
    }

    const note = buildLocalReplyNote(row)
    const activityId = parseUrl(row.activity_id) ?? parseUrl(localReplyActivityHref(replyId))
    if (!note || !activityId) {
      return null
    }

    const targetActor = parseUrl(row.target_actor_id)
    const published = parseInstant(row.published_at)
    return new Create({
      id: activityId,
      actor: ACTOR_URI,
      object: note,
      ...(targetActor ? { to: targetActor } : {}),
      cc: PUBLIC_COLLECTION,
      ...(published ? { published } : {}),
    })
  }

  const activityRow = await loadLocalReplyActivityRow(replyId)
  if (!activityRow) {
    return null
  }
  const create = await parseLocalReplyCreateFromPayload(activityRow)
  if (create) {
    return create
  }

  const note = await buildLocalReplyNoteFromActivity(activityRow)
  const payload = parsePayloadObject(activityRow.payload)
  const activityId = parseUrl(activityRow.activity_id)
  if (!note || !payload || !activityId) {
    return null
  }
  const targetActor = firstPayloadUrl(payload.to)
  const published = parseInstant(typeof payload.published === "string" ? payload.published : null)
  return new Create({
    id: activityId,
    actor: ACTOR_URI,
    object: note,
    ...(targetActor ? { to: targetActor } : {}),
    cc: PUBLIC_COLLECTION,
    ...(published ? { published } : {}),
  })
}

export async function markCommentDeletedFromDelete(ctx: { documentLoader: any; contextLoader: any }, del: Delete): Promise<boolean> {
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
      reply_target_id,
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
    replyTargetId: row.reply_target_id || null,
    publishedAt: row.published_at || null,
    receivedAt: row.received_at,
  }))
}
