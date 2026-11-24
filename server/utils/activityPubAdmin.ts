import {
  firstId,
  firstUrl as firstJsonUrl,
  hasType,
  idOf,
  isActor,
  languageValue,
  stringValue,
  type JsonObject,
} from "@changkyun/activitypub"

import { createFedifyContext, getCloudflareEnv, type ActivityPubContext } from "./fedify"
import { ACTOR_IDENTIFIER, AS_PUBLIC, SITE_ORIGIN } from "./fedifyContent"
import { ensureActivityPubSchema } from "./activityPubSchema"
import {
  actorProfileFromDocument,
  createLocalReplyPermalinks,
  discardLocalReplyActivity,
  discardLocalReplyComment,
  persistLocalReplyActivity,
  persistLocalReplyComment,
  resolveActivityObject,
} from "./fedifyComments"
import { currentInstant } from "./temporal.ts"
import { CREATE_CONTEXT, EMOJI_REACT_CONTEXT, FOLLOW_CONTEXT, LIKE_CONTEXT, withActivityPubContext } from "./activityPubVocab"

export type AdminFollowItem = {
  id: number
  actorId: string
  actorName: string
  actorUrl: string
  activityId: string | null
  status: string
  followingStatus: "accepted" | "requested" | null
  createdAt: string
  updatedAt: string
}

export type AdminCommentItem = {
  id: number
  objectId: string
  articlePath: string
  actorId: string
  actorName: string
  actorUrl: string
  contentText: string
  publishedAt: string | null
  receivedAt: string
  status: string
}

export type AdminReactionItem = {
  id: number
  articlePath: string
  actorId: string
  actorName: string
  actorUrl: string
  reaction: string
  reactionType: string
  objectId: string
  publishedAt: string
  receivedAt: string
}

export type AdminSearchItem = {
  id: string
  type: "actor" | "article" | "note" | "unknown"
  objectId: string
  url: string
  actorId: string | null
  actorName: string
  actorUrl: string | null
  title: string | null
  summary: string | null
  contentText: string
  publishedAt: string | null
  actions: string[]
}

type CommentRow = {
  id: number
  object_id: string
  article_path: string
  actor_id: string
  actor_name?: string | null
  actor_url?: string | null
  content_text: string
  published_at?: string | null
  received_at: string
  status: string
}

type FollowRow = {
  id: number
  actor_id: string
  actor_name?: string | null
  actor_url?: string | null
  activity_id: string | null
  status: string
  following_status?: string | null
  created_at: string
  updated_at: string
}

type ReactionRow = {
  id: number
  article_path: string
  actor_id: string
  actor_name?: string | null
  actor_url?: string | null
  reaction: string
  reaction_type: string
  object_id: string
  published_at: string
  received_at: string
}

type DbChangeResult = {
  changes?: unknown
}

function getDatabase() {
  return useDatabase()
}

function nowInstant(): string {
  return currentInstant()
}

function normalizeRowsChanged(value: unknown): number {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  if (typeof value === "string") {
    return Number.parseInt(value, 10) || 0
  }
  return 0
}

function getDashboardEnv(env?: unknown) {
  const eventEnv = getCloudflareEnv(env)
  if (eventEnv) {
    return eventEnv
  }
  return {
    ...(typeof process !== "undefined" && process?.env ? process.env : {}),
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
    hellip: "...",
    ldquo: "\"",
    lt: "<",
    lsquo: "'",
    mdash: "-",
    middot: ".",
    nbsp: " ",
    ndash: "-",
    quot: "\"",
    rdquo: "\"",
    rsquo: "'",
  }
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase()
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16)
      return Number.isInteger(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10)
      return Number.isInteger(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return named[normalized] ?? match
  })
}

function htmlToText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*\/p\s*>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  )
}

function toPublishedAt(value: unknown): string | null {
  const text = typeof value === "string" ? value : undefined
  if (!text) {
    return null
  }
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? text : new Date(parsed).toISOString()
}

function resolveActorProfile(actor: JsonObject): {
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
} | null {
  return actorProfileFromDocument(actor)
}

export async function listActivityPubFollowersForAdmin(): Promise<AdminFollowItem[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT
    followers.id,
    followers.actor_id,
    activitypub_feed_actors.actor_name,
    activitypub_feed_actors.actor_url,
    followers.activity_id,
    followers.status,
    following.status AS following_status,
    followers.created_at,
    followers.updated_at
  FROM followers
  LEFT JOIN activitypub_feed_actors
    ON activitypub_feed_actors.actor_id = followers.actor_id
  LEFT JOIN following
    ON following.actor_id = followers.actor_id
    AND following.status IN ('accepted', 'requested')
  WHERE followers.status IN ('accepted', 'requested')
  ORDER BY followers.updated_at DESC, followers.id DESC`

  return ((rows ?? []) as FollowRow[]).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name || row.actor_id,
    actorUrl: row.actor_url || row.actor_id,
    activityId: row.activity_id ?? null,
    status: row.status,
    followingStatus: row.following_status === "accepted" || row.following_status === "requested"
      ? row.following_status
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function listActivityPubCommentsForAdmin(options: { includeDeleted?: boolean } = {}): Promise<AdminCommentItem[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const rows = options.includeDeleted
    ? await db.sql`SELECT
        id,
        object_id,
        article_path,
        actor_id,
        actor_name,
        actor_url,
        content_text,
        published_at,
        received_at,
        status
      FROM activitypub_comments
      ORDER BY published_at DESC, received_at DESC, id DESC`
    : await db.sql`SELECT
        id,
        object_id,
        article_path,
        actor_id,
        actor_name,
        actor_url,
        content_text,
        published_at,
        received_at,
        status
      FROM activitypub_comments
      WHERE status = 'visible'
      ORDER BY published_at DESC, received_at DESC, id DESC`

  return ((rows.rows ?? []) as CommentRow[]).map((row) => ({
    id: row.id,
    objectId: row.object_id,
    articlePath: row.article_path,
    actorId: row.actor_id,
    actorName: row.actor_name || row.actor_id,
    actorUrl: row.actor_url || row.actor_id,
    contentText: row.content_text,
    publishedAt: row.published_at ?? null,
    receivedAt: row.received_at,
    status: row.status,
  }))
}

export async function listActivityPubReactionsForAdmin(): Promise<AdminReactionItem[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT
      id,
      article_path,
      actor_id,
      actor_name,
      actor_url,
      reaction,
      reaction_type,
      object_id,
      published_at,
      received_at
    FROM activitypub_reactions
    ORDER BY received_at DESC, id DESC`

  return ((rows ?? []) as ReactionRow[]).map((row) => ({
    id: row.id,
    articlePath: row.article_path,
    actorId: row.actor_id,
    actorName: row.actor_name || row.actor_id,
    actorUrl: row.actor_url || row.actor_id,
    reaction: row.reaction,
    reactionType: row.reaction_type,
    objectId: row.object_id,
    publishedAt: row.published_at,
    receivedAt: row.received_at,
  }))
}

export async function hideActivityPubCommentById(id: number): Promise<boolean> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const result = await db.sql`UPDATE activitypub_comments
    SET status = 'deleted',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}` as DbChangeResult
  return normalizeRowsChanged((result as any)?.changes) > 0
}

export async function deleteActivityPubReactionById(id: number): Promise<boolean> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const result = await db.sql`DELETE FROM activitypub_reactions
    WHERE id = ${id}` as DbChangeResult
  return normalizeRowsChanged((result as any)?.changes) > 0
}

export async function removeFollowerById(id: number): Promise<string | null> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const row = await db.sql`SELECT actor_id
    FROM followers
    WHERE id = ${id}
      AND status IN ('accepted', 'requested')
    LIMIT 1`
  const actorId = (row.rows?.[0] as { actor_id?: string | null } | undefined)?.actor_id ?? null
  if (!actorId) {
    return null
  }

  await db.sql`UPDATE followers
    SET status = 'removed',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}`

  return actorId
}

async function followActivityUri(actorId: string): Promise<URL> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(actorId))
  const hash = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return new URL(`/@${ACTOR_IDENTIFIER}/follow/${hash}`, SITE_ORIGIN)
}

async function recordFollowingRequested(actorId: string, follow: JsonObject): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = JSON.stringify(follow)
  const activityId = idOf(follow) ?? (await followActivityUri(actorId)).href

  await db.sql`INSERT INTO following (actor_id, activity_id, activity_payload, status)
    VALUES (${actorId}, ${activityId}, ${payload}, 'requested')
    ON CONFLICT(actor_id) DO UPDATE SET
      activity_id = excluded.activity_id,
      activity_payload = excluded.activity_payload,
      status = 'requested',
      updated_at = CURRENT_TIMESTAMP`
}

async function removeFollowingRequest(actorId: string, activityId: string): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  await db.sql`DELETE FROM following
    WHERE actor_id = ${actorId}
      AND activity_id = ${activityId}
      AND status = 'requested'`
}

export async function followActorForAdmin(
  actorId: string,
  event?: unknown,
): Promise<{ actorId: string; followActivityId: string | null; status: "accepted" | "requested"; alreadyFollowing: boolean }> {
  const targetActor = normalizeRemoteUrl(actorId, "Actor id")
  const normalizedActorId = targetActor.href

  await ensureActivityPubSchema()
  const db = getDatabase()
  const existingRows = await db.sql`SELECT activity_id, status
    FROM following
    WHERE actor_id = ${normalizedActorId}
      AND status IN ('accepted', 'requested')
    LIMIT 1`
  const existing = existingRows.rows?.[0] as { activity_id?: string | null; status?: string | null } | undefined
  if (existing?.status === "accepted" || existing?.status === "requested") {
    return {
      actorId: normalizedActorId,
      followActivityId: existing.activity_id ?? null,
      status: existing.status,
      alreadyFollowing: true,
    }
  }

  const env = getDashboardEnv(event)
  const context = await createFedifyContext(env as Parameters<typeof createFedifyContext>[0])
  const actorUri = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN)
  const recipient = await context.lookupObject(targetActor)
  if (!isActor(recipient)) {
    throw new Error("Actor not found")
  }

  const followId = await followActivityUri(normalizedActorId)
  const follow = withActivityPubContext(FOLLOW_CONTEXT, {
    id: followId.href,
    type: "Follow",
    actor: actorUri.href,
    object: targetActor.href,
    to: targetActor.href,
  })

  try {
    await recordFollowingRequested(normalizedActorId, follow)
    await context.sendActivity(recipient, follow)
  } catch (error) {
    await removeFollowingRequest(normalizedActorId, followId.href).catch(() => undefined)
    throw error
  }

  return {
    actorId: normalizedActorId,
    followActivityId: followId.href,
    status: "requested",
    alreadyFollowing: false,
  }
}

export async function followFollowerById(
  id: number,
  event?: unknown,
): Promise<{ actorId: string; followActivityId: string | null; status: "accepted" | "requested"; alreadyFollowing: boolean }> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const followerRows = await db.sql`SELECT actor_id
    FROM followers
    WHERE id = ${id}
      AND status IN ('accepted', 'requested')
    LIMIT 1`
  const actorId = (followerRows.rows?.[0] as { actor_id?: string | null } | undefined)?.actor_id ?? null
  if (!actorId) {
    throw new Error("Follower not found")
  }

  return await followActorForAdmin(actorId, event)
}

export async function replyActivityPubCommentById(
  id: number,
  replyText: string,
  event?: unknown,
): Promise<{ actorId: string; commentObjectId: string; replyObjectId: string }> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT actor_id, object_id, article_id, article_path
    FROM activitypub_comments
    WHERE id = ${id}
      AND status = 'visible'
    LIMIT 1`
  const row = rows?.[0] as {
    actor_id?: string
    object_id?: string
    article_id?: string
    article_path?: string
  } | undefined
  if (!row?.actor_id || !row.object_id || !row.article_id || !row.article_path) {
    throw new Error("Comment not found")
  }

  const env = getDashboardEnv(event)
  const context = await createFedifyContext(env as Parameters<typeof createFedifyContext>[0])
  const actorUri = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN)
  const targetActor = new URL(row.actor_id)
  const target = new URL(row.object_id)
  const recipient = await context.lookupObject(targetActor)
  if (!isActor(recipient)) {
    throw new Error("Comment actor not found")
  }

  const publishedAt = nowInstant()
  const { objectId: replyId, activityId: createId } = createLocalReplyPermalinks()
  const create = buildReplyCreate({
    replyId,
    createId,
    content: replyText,
    inReplyTo: target,
    to: targetActor,
    published: publishedAt,
    actor: actorUri,
  })

  await persistLocalReplyComment({
    objectId: replyId.href,
    activityId: createId.href,
    articleId: row.article_id,
    articlePath: row.article_path,
    replyTargetId: row.object_id,
    contentText: replyText,
    contentHtml: null,
    url: replyId.href,
    publishedAt,
    payload: JSON.stringify(create),
  })

  try {
    await context.sendActivity(recipient, create)
  } catch (error) {
    await discardLocalReplyComment(replyId.href).catch((cleanupError) => {
      console.warn("Failed to discard undelivered local reply comment.", cleanupError)
    })
    throw error
  }

  return {
    actorId: row.actor_id,
    commentObjectId: row.object_id,
    replyObjectId: replyId.href,
  }
}

export async function reactActivityPubCommentById(
  id: number,
  reactionText = "❤️",
  event?: unknown,
): Promise<{ actorId: string; commentObjectId: string; reaction: string; reactionType: "Like" | "EmojiReact" }> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT actor_id, object_id
    FROM activitypub_comments
    WHERE id = ${id}
      AND status = 'visible'
    LIMIT 1`
  const row = rows?.[0] as { actor_id?: string; object_id?: string } | undefined
  if (!row?.actor_id || !row.object_id) {
    throw new Error("Comment not found")
  }

  const reaction = reactionText.replace(/\s+/g, " ").trim() || "❤️"
  const env = getDashboardEnv(event)
  const context = await createFedifyContext(env as Parameters<typeof createFedifyContext>[0])
  const actorUri = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN)
  const targetActor = new URL(row.actor_id)
  const target = new URL(row.object_id)
  const recipient = await context.lookupObject(targetActor)
  if (!isActor(recipient)) {
    throw new Error("Comment actor not found")
  }

  const activity = buildReaction({ kind: "comment", reaction, actor: actorUri, object: target, to: targetActor })
  await context.sendActivity(recipient, activity)

  return {
    actorId: row.actor_id,
    commentObjectId: row.object_id,
    reaction,
    reactionType: reaction === "❤️" ? "Like" : "EmojiReact",
  }
}

function buildReplyCreate(input: {
  replyId: URL
  createId: URL
  content: string
  inReplyTo: URL
  to: URL
  published: string
  actor: URL
}): JsonObject {
  const note = {
    id: input.replyId.href,
    type: "Note",
    attributedTo: input.actor.href,
    cc: AS_PUBLIC,
    content: input.content,
    inReplyTo: input.inReplyTo.href,
    mediaType: "text/plain",
    published: input.published,
    to: input.to.href,
  }
  return withActivityPubContext(CREATE_CONTEXT, {
    id: input.createId.href,
    type: "Create",
    actor: input.actor.href,
    cc: AS_PUBLIC,
    object: note,
    published: input.published,
    to: input.to.href,
  })
}

function buildReaction(input: { kind: "comment" | "remote"; reaction: string; actor: URL; object: URL; to: URL }): JsonObject {
  const published = nowInstant()
  if (input.reaction === "❤️") {
    return withActivityPubContext(LIKE_CONTEXT, {
      id: new URL(`#like-${input.kind}-${crypto.randomUUID()}`, input.actor).href,
      type: "Like",
      actor: input.actor.href,
      cc: AS_PUBLIC,
      object: input.object.href,
      published,
      to: input.to.href,
    })
  }
  return withActivityPubContext(EMOJI_REACT_CONTEXT, {
    id: new URL(`#react-${input.kind}-${crypto.randomUUID()}`, input.actor).href,
    type: "EmojiReact",
    actor: input.actor.href,
    cc: AS_PUBLIC,
    content: input.reaction,
    object: input.object.href,
    published,
    to: input.to.href,
  })
}

function isNoteOrArticle(value: unknown): value is JsonObject {
  return hasType(value, "Note", "Article") && idOf(value) !== null
}

const SEARCH_URL_PROTOCOLS = new Set(["acct:", "http:", "https:"])
const REMOTE_URL_PROTOCOLS = new Set(["http:", "https:"])
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

function hasUrlScheme(value: string): boolean {
  return URL_SCHEME_PATTERN.test(value)
}

function assertLookupUrlInput(url: URL): void {
  if (url.username || url.password) {
    throw new Error("Lookup URL credentials are not allowed")
  }
}

function normalizeRemoteUrl(value: string, label: string): URL {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} is required`)
  }

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(`${label} must be an http(s) URL`)
  }
  if (!REMOTE_URL_PROTOCOLS.has(url.protocol)) {
    throw new Error(`${label} must be an http(s) URL`)
  }
  assertLookupUrlInput(url)
  return url
}

function normalizeSearchTarget(value: string): string | URL {
  const query = value.trim()
  if (hasUrlScheme(query)) {
    let url: URL
    try {
      url = new URL(query)
    } catch {
      throw new Error("Search query URL is invalid")
    }
    if (!SEARCH_URL_PROTOCOLS.has(url.protocol)) {
      throw new Error("Search query supports actor handles, acct:, http:, or https: URLs")
    }
    if (REMOTE_URL_PROTOCOLS.has(url.protocol)) {
      assertLookupUrlInput(url)
      return url
    }
    return query
  }

  try {
    return new URL(query)
  } catch {
    return query
  }
}

async function unwrapCreate(context: ActivityPubContext, resolved: JsonObject | null): Promise<{ object: unknown; actor: JsonObject | null }> {
  if (!resolved || !hasType(resolved, "Create")) {
    return { object: resolved, actor: null }
  }
  const actorId = firstId(resolved.actor)
  const actor = actorId ? await context.loadActor(actorId).catch(() => null) : null
  const object = await resolveActivityObject(context, resolved)
  return { object, actor }
}

async function resolveRemoteObjectForAdmin(targetId: string, event?: unknown): Promise<{
  object: JsonObject
  objectId: string
  actorId: string
  actor: JsonObject
  context: ActivityPubContext
}> {
  const env = getDashboardEnv(event)
  const context = await createFedifyContext(env as Parameters<typeof createFedifyContext>[0])
  const target = normalizeSearchTarget(targetId)
  const resolved = await context.lookupObject(target)
  const { object, actor } = await unwrapCreate(context, resolved)

  if (!hasType(object, "Note", "Article")) {
    throw new Error("Search target is not a Note or Article")
  }
  if (!isNoteOrArticle(object)) {
    throw new Error("Search target has no object id")
  }

  const actorId = firstId(object.attributedTo) ?? (isActor(actor) ? idOf(actor) : null)
  if (!actorId) {
    throw new Error("Search target actor not found")
  }

  const recipient = isActor(actor) && idOf(actor) === actorId
    ? actor
    : await context.lookupObject(normalizeRemoteUrl(actorId, "Search target actor id"))
  if (!isActor(recipient)) {
    throw new Error("Search target actor not found")
  }

  return {
    object,
    objectId: idOf(object)!,
    actorId,
    actor: recipient,
    context,
  }
}

async function lookupRemoteObjectOrNull(
  context: ActivityPubContext,
  value: string,
  label: string,
) {
  try {
    return await context.lookupObject(normalizeRemoteUrl(value, label))
  } catch {
    return null
  }
}

function createSearchObjectItem(
  object: JsonObject,
  actorProfile: { actorId: string; actorName: string; actorUrl: string } | null,
): AdminSearchItem | null {
  const objectId = idOf(object)
  if (!objectId) {
    return null
  }

  const type = hasType(object, "Article") ? "article" : "note"
  const title = stringifyLanguageValue(languageValue(object, "name")) || null
  const summary = stringifyLanguageValue(languageValue(object, "summary")) || null
  const contentHtml = stringifyLanguageValue(languageValue(object, "content"))
  const objectUrl = firstJsonUrl(object.url)
  const contentText = htmlToText(contentHtml) || summary || title || objectUrl || objectId
  const attributionId = firstId(object.attributedTo)
  return {
    id: `${type}:${objectId}`,
    type,
    objectId,
    url: objectUrl ?? objectId,
    actorId: actorProfile?.actorId ?? attributionId ?? null,
    actorName: actorProfile?.actorName ?? attributionId ?? "unknown",
    actorUrl: actorProfile?.actorUrl ?? attributionId ?? null,
    title,
    summary,
    contentText,
    publishedAt: toPublishedAt(stringValue(object, "published")),
    actions: ["reply", "like", "react"],
  }
}

export async function searchActivityPubForAdmin(query: string, event?: unknown): Promise<AdminSearchItem[]> {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    throw new Error("Search query is required")
  }

  const env = getDashboardEnv(event)
  const context = await createFedifyContext(env as Parameters<typeof createFedifyContext>[0])
  const resolved = await context.lookupObject(normalizeSearchTarget(normalizedQuery))
  const results: AdminSearchItem[] = []

  if (isActor(resolved)) {
    const profile = resolveActorProfile(resolved)
    if (profile) {
      results.push({
        id: `actor:${profile.actorId}`,
        type: "actor",
        objectId: profile.actorId,
        url: profile.actorUrl,
        actorId: profile.actorId,
        actorName: profile.actorName,
        actorUrl: profile.actorUrl,
        title: profile.actorName,
        summary: null,
        contentText: profile.actorId,
        publishedAt: null,
        actions: ["follow"],
      })
    }
    return results
  }

  const { object, actor } = await unwrapCreate(context, resolved)

  if (isNoteOrArticle(object)) {
    const actorId = firstId(object.attributedTo) ?? (isActor(actor) ? idOf(actor) : null)
    const resolvedActor = actorId
      ? isActor(actor) && idOf(actor) === actorId
        ? actor
        : await lookupRemoteObjectOrNull(context, actorId, "Search result actor id")
      : null
    const profile = isActor(resolvedActor) ? resolveActorProfile(resolvedActor) : null
    const item = createSearchObjectItem(object, profile)
    if (item) {
      results.push(item)
    }
  }

  if (results.length === 0) {
    results.push({
      id: `unknown:${normalizedQuery}`,
      type: "unknown",
      objectId: normalizedQuery,
      url: normalizedQuery,
      actorId: null,
      actorName: "unknown",
      actorUrl: null,
      title: null,
      summary: null,
      contentText: "지원 가능한 ActivityPub 액터, Article, Note를 찾지 못했습니다.",
      publishedAt: null,
      actions: [],
    })
  }

  return results
}

export async function replyRemoteActivityPubObject(
  targetId: string,
  replyText: string,
  event?: unknown,
): Promise<{ actorId: string; objectId: string; replyObjectId: string }> {
  const reply = replyText.trim()
  if (!reply) {
    throw new Error("Reply text is required")
  }

  const target = await resolveRemoteObjectForAdmin(targetId, event)
  const targetObjectUri = normalizeRemoteUrl(target.objectId, "Search target object id")
  const targetActorUri = normalizeRemoteUrl(target.actorId, "Search target actor id")
  const actorUri = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN)
  const publishedAt = nowInstant()
  const { objectId: replyId, activityId: createId } = createLocalReplyPermalinks()
  const create = buildReplyCreate({
    replyId,
    createId,
    content: reply,
    inReplyTo: targetObjectUri,
    to: targetActorUri,
    published: publishedAt,
    actor: actorUri,
  })

  await persistLocalReplyActivity(create)

  try {
    await target.context.sendActivity(target.actor, create)
  } catch (error) {
    await discardLocalReplyActivity(createId.href).catch((cleanupError) => {
      console.warn("Failed to discard undelivered local reply activity.", cleanupError)
    })
    throw error
  }

  return {
    actorId: target.actorId,
    objectId: target.objectId,
    replyObjectId: replyId.href,
  }
}

export async function reactRemoteActivityPubObject(
  targetId: string,
  reactionText = "❤️",
  event?: unknown,
): Promise<{ actorId: string; objectId: string; reaction: string; reactionType: "Like" | "EmojiReact" }> {
  const target = await resolveRemoteObjectForAdmin(targetId, event)
  const targetObjectUri = normalizeRemoteUrl(target.objectId, "Search target object id")
  const targetActorUri = normalizeRemoteUrl(target.actorId, "Search target actor id")
  const actorUri = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN)
  const reaction = reactionText.replace(/\s+/g, " ").trim() || "❤️"
  const activity = buildReaction({ kind: "remote", reaction, actor: actorUri, object: targetObjectUri, to: targetActorUri })
  await target.context.sendActivity(target.actor, activity)

  return {
    actorId: target.actorId,
    objectId: target.objectId,
    reaction,
    reactionType: reaction === "❤️" ? "Like" : "EmojiReact",
  }
}

export async function getAdminDashboardData(includeDeleted = false) {
  const [followers, comments, reactions] = await Promise.all([
    listActivityPubFollowersForAdmin(),
    listActivityPubCommentsForAdmin({ includeDeleted }),
    listActivityPubReactionsForAdmin(),
  ])

  return { followers, comments, reactions }
}
