import { Article, Create, EmojiReact, Follow, Image, isActor, Like, Link, Note, PUBLIC_COLLECTION, type Actor } from "@fedify/vocab"
import { Temporal } from "@js-temporal/polyfill"

import { createFedifyContext, getCloudflareEnv } from "./fedify"
import { ACTOR_IDENTIFIER, SITE_ORIGIN } from "./fedifyContent"
import { ensureActivityPubSchema } from "./activityPubSchema"
import {
  createLocalReplyPermalinks,
  discardLocalReplyActivity,
  discardLocalReplyComment,
  persistLocalReplyActivity,
  persistLocalReplyComment,
} from "./fedifyComments"

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

function firstUrl(value: URL | Link | null): string | null {
  if (!value) {
    return null
  }
  if (value instanceof URL) {
    return value.href
  }
  return value.href?.href ?? value.id?.href ?? null
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

function toPublishedAt(value: unknown): string | null {
  const text = value?.toString?.()
  if (!text) {
    return null
  }
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? text : new Date(parsed).toISOString()
}

async function resolveActorProfile(ctx: { documentLoader: any; contextLoader: any }, actor: Actor): Promise<{
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
} | null> {
  if (!actor.id) {
    return null
  }
  const icon = await actor.getIcon({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  return {
    actorId: actor.id.href,
    actorName: stringifyLanguageValue(actor.name)
      || stringifyLanguageValue(actor.preferredUsername)
      || actor.id.hostname,
    actorUrl: firstUrl(actor.url) ?? actor.id.href,
    actorIconUrl: firstImageUrl(icon),
  }
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

async function recordFollowingRequested(actorId: string, follow: Follow): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = JSON.stringify(await follow.toJsonLd({ format: "compact" }))
  const activityId = follow.id?.href ?? (await followActivityUri(actorId)).href

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
  if (!isActor(recipient) || !recipient.id) {
    throw new Error("Actor not found")
  }

  const followId = await followActivityUri(normalizedActorId)
  const follow = new Follow({
    id: followId,
    actor: actorUri,
    object: targetActor,
    to: targetActor,
  })

  try {
    await recordFollowingRequested(normalizedActorId, follow)
    await context.sendActivity(
      { identifier: ACTOR_IDENTIFIER },
      recipient,
      follow,
      { preferSharedInbox: true },
    )
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
  if (!isActor(recipient) || !recipient.id) {
    throw new Error("Comment actor not found")
  }

  const publishedAt = Temporal.Now.instant()
  const { objectId: replyId, activityId: createId } = createLocalReplyPermalinks()
  const reply = new Note({
    id: replyId,
    attribution: actorUri,
    content: replyText,
    mediaType: "text/plain",
    replyTarget: target,
    to: targetActor,
    cc: PUBLIC_COLLECTION,
    published: publishedAt,
  })

  const create = new Create({
    id: createId,
    actor: actorUri,
    object: reply,
    to: targetActor,
    cc: PUBLIC_COLLECTION,
    published: publishedAt,
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
    publishedAt: publishedAt.toString(),
    payload: JSON.stringify(await create.toJsonLd({ format: "compact" })),
  })

  try {
    await context.sendActivity(
      { identifier: ACTOR_IDENTIFIER },
      recipient,
      create,
      { preferSharedInbox: true },
    )
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
  if (!isActor(recipient) || !recipient.id) {
    throw new Error("Comment actor not found")
  }

  const activity = reaction === "❤️"
    ? new Like({
      id: new URL(`#like-comment-${crypto.randomUUID()}`, actorUri),
      actor: actorUri,
      object: target,
      to: targetActor,
      cc: PUBLIC_COLLECTION,
      published: Temporal.Now.instant(),
    })
    : new EmojiReact({
      id: new URL(`#react-comment-${crypto.randomUUID()}`, actorUri),
      actor: actorUri,
      object: target,
      content: reaction,
      to: targetActor,
      cc: PUBLIC_COLLECTION,
      published: Temporal.Now.instant(),
    })

  await context.sendActivity(
    { identifier: ACTOR_IDENTIFIER },
    recipient,
    activity,
    { preferSharedInbox: true },
  )

  return {
    actorId: row.actor_id,
    commentObjectId: row.object_id,
    reaction,
    reactionType: reaction === "❤️" ? "Like" : "EmojiReact",
  }
}

const SEARCH_URL_PROTOCOLS = new Set(["acct:", "http:", "https:"])
const REMOTE_URL_PROTOCOLS = new Set(["http:", "https:"])
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i
const BLOCKED_IPV4_CIDRS: Array<[[number, number, number, number], number]> = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 0, 2, 0], 24],
  [[192, 88, 99, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[198, 51, 100, 0], 24],
  [[203, 0, 113, 0], 24],
  [[224, 0, 0, 0], 4],
]

function hasUrlScheme(value: string): boolean {
  return URL_SCHEME_PATTERN.test(value)
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname
}

function normalizeLookupHost(hostname: string): string {
  return stripIpv6Brackets(hostname).replace(/\.$/, "").toLowerCase()
}

function parseIpv4Address(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split(".")
  if (parts.length !== 4) {
    return null
  }

  const parsed = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      return Number.NaN
    }
    const value = Number.parseInt(part, 10)
    return value >= 0 && value <= 255 ? value : Number.NaN
  })
  return parsed.every(Number.isInteger)
    ? parsed as [number, number, number, number]
    : null
}

function ipv4ToNumber(address: [number, number, number, number]): number {
  return ((address[0] * 256 + address[1]) * 256 + address[2]) * 256 + address[3]
}

function isIpv4InCidr(
  address: [number, number, number, number],
  base: [number, number, number, number],
  prefixLength: number,
): boolean {
  const size = 2 ** (32 - prefixLength)
  const value = ipv4ToNumber(address)
  const baseValue = ipv4ToNumber(base)
  return value >= baseValue && value < baseValue + size
}

function isBlockedIpv4(hostname: string): boolean {
  const address = parseIpv4Address(hostname)
  if (!address) {
    return false
  }
  return BLOCKED_IPV4_CIDRS.some(([base, prefixLength]) => isIpv4InCidr(address, base, prefixLength))
}

function parseIpv6Address(hostname: string): number[] | null {
  const host = normalizeLookupHost(hostname)
  if (!host.includes(":")) {
    return null
  }

  const ipv4Tail = host.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  let normalized = host
  if (ipv4Tail) {
    const ipv4 = parseIpv4Address(ipv4Tail)
    if (!ipv4) {
      return null
    }
    const high = (ipv4[0] << 8) + ipv4[1]
    const low = (ipv4[2] << 8) + ipv4[3]
    normalized = `${host.slice(0, -ipv4Tail.length)}${high.toString(16)}:${low.toString(16)}`
  }

  const compressedParts = normalized.split("::")
  if (compressedParts.length > 2) {
    return null
  }

  const left = compressedParts[0] ? compressedParts[0].split(":") : []
  const right = compressedParts[1] ? compressedParts[1].split(":") : []
  if (left.includes("") || right.includes("")) {
    return null
  }

  const missing = 8 - left.length - right.length
  if ((compressedParts.length === 1 && missing !== 0) || (compressedParts.length === 2 && missing < 1)) {
    return null
  }

  const groups = [
    ...left,
    ...Array.from({ length: compressedParts.length === 2 ? missing : 0 }, () => "0"),
    ...right,
  ]
  if (groups.length !== 8) {
    return null
  }

  const parsed = groups.map((group) => /^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : Number.NaN)
  return parsed.every(Number.isInteger) ? parsed : null
}

function ipv4FromIpv6Groups(groups: number[]): [number, number, number, number] {
  const high = groups[6] ?? 0
  const low = groups[7] ?? 0
  return [high >> 8, high & 0xff, low >> 8, low & 0xff]
}

function isZeroPrefix(groups: number[], length: number): boolean {
  return groups.slice(0, length).every((group) => group === 0)
}

function isBlockedIpv6(hostname: string): boolean {
  const groups = parseIpv6Address(hostname)
  if (!groups) {
    return false
  }

  if (groups.every((group) => group === 0) || (isZeroPrefix(groups, 7) && groups[7] === 1)) {
    return true
  }
  if (isZeroPrefix(groups, 5) && groups[5] === 0xffff) {
    return isBlockedIpv4(ipv4FromIpv6Groups(groups).join("."))
  }
  if (isZeroPrefix(groups, 6) && isBlockedIpv4(ipv4FromIpv6Groups(groups).join("."))) {
    return true
  }

  const firstSegment = groups[0] ?? 0
  return (firstSegment & 0xfe00) === 0xfc00
    || (firstSegment & 0xffc0) === 0xfe80
    || (firstSegment & 0xff00) === 0xff00
    || (firstSegment === 0x2001 && groups[1] === 0x0db8)
    || (firstSegment === 0x2001 && groups[1] === 0x0002)
    || (firstSegment === 0x2001 && groups[1] === 0x0000)
    || (firstSegment === 0x0064 && groups[1] === 0xff9b && groups[2] === 0x0001)
    || firstSegment === 0x0100
}

function isBlockedLookupHostLiteral(hostname: string): boolean {
  const host = normalizeLookupHost(hostname)
  return host === "localhost"
    || host.endsWith(".localhost")
    || host === "local"
    || host.endsWith(".local")
    || isBlockedIpv4(host)
    || isBlockedIpv6(host)
}

function assertLookupUrlInput(url: URL): void {
  if (url.username || url.password) {
    throw new Error("Lookup URL credentials are not allowed")
  }
  // Fedify handles DNS-level public address validation; keep URL-literal gaps out before lookup.
  if (isBlockedLookupHostLiteral(url.hostname)) {
    throw new Error("Lookup URL host is not allowed")
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

async function resolveRemoteObjectForAdmin(targetId: string, event?: unknown): Promise<{
  object: Note | Article
  objectId: string
  actorId: string
  actor: Actor
  context: Awaited<ReturnType<typeof createFedifyContext>>
}> {
  const env = getDashboardEnv(event)
  const context = await createFedifyContext(env as Parameters<typeof createFedifyContext>[0])
  const target = normalizeSearchTarget(targetId)
  const resolved = await context.lookupObject(target)
  let object: unknown = resolved
  let actor: unknown = null

  if (resolved instanceof Create) {
    actor = await resolved.getActor({
      documentLoader: context.documentLoader,
      contextLoader: context.contextLoader,
      suppressError: true,
    })
    object = await resolved.getObject({
      documentLoader: context.documentLoader,
      contextLoader: context.contextLoader,
      suppressError: true,
    })
  }

  if (!(object instanceof Note) && !(object instanceof Article)) {
    throw new Error("Search target is not a Note or Article")
  }
  if (!object.id) {
    throw new Error("Search target has no object id")
  }

  const actorId = object.attributionId?.href ?? (isActor(actor) ? actor.id?.href : null)
  if (!actorId) {
    throw new Error("Search target actor not found")
  }

  const recipient = isActor(actor) && actor.id?.href === actorId
    ? actor
    : await context.lookupObject(normalizeRemoteUrl(actorId, "Search target actor id"))
  if (!isActor(recipient) || !recipient.id) {
    throw new Error("Search target actor not found")
  }

  return {
    object,
    objectId: object.id.href,
    actorId,
    actor: recipient,
    context,
  }
}

async function lookupRemoteObjectOrNull(
  context: Awaited<ReturnType<typeof createFedifyContext>>,
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
  object: Note | Article,
  actorProfile: { actorId: string; actorName: string; actorUrl: string } | null,
): AdminSearchItem | null {
  if (!object.id) {
    return null
  }

  const type = object instanceof Article ? "article" : "note"
  const title = stringifyLanguageValue(object.name) || null
  const summary = stringifyLanguageValue(object.summary) || null
  const contentHtml = stringifyLanguageValue(object.content)
  const contentText = htmlToText(contentHtml) || summary || title || firstUrl(object.url) || object.id.href
  return {
    id: `${type}:${object.id.href}`,
    type,
    objectId: object.id.href,
    url: firstUrl(object.url) ?? object.id.href,
    actorId: actorProfile?.actorId ?? object.attributionId?.href ?? null,
    actorName: actorProfile?.actorName ?? object.attributionId?.href ?? "unknown",
    actorUrl: actorProfile?.actorUrl ?? object.attributionId?.href ?? null,
    title,
    summary,
    contentText,
    publishedAt: toPublishedAt(object.published),
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

  if (isActor(resolved) && resolved.id) {
    const profile = await resolveActorProfile(context, resolved)
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

  let object: unknown = resolved
  let actor: unknown = null
  if (resolved instanceof Create) {
    actor = await resolved.getActor({
      documentLoader: context.documentLoader,
      contextLoader: context.contextLoader,
      suppressError: true,
    })
    object = await resolved.getObject({
      documentLoader: context.documentLoader,
      contextLoader: context.contextLoader,
      suppressError: true,
    })
  }

  if (object instanceof Note || object instanceof Article) {
    const actorId = object.attributionId?.href ?? (isActor(actor) ? actor.id?.href : null)
    const resolvedActor = actorId
      ? isActor(actor) && actor.id?.href === actorId
        ? actor
        : await lookupRemoteObjectOrNull(context, actorId, "Search result actor id")
      : null
    const profile = isActor(resolvedActor) ? await resolveActorProfile(context, resolvedActor) : null
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
  const publishedAt = Temporal.Now.instant()
  const { objectId: replyId, activityId: createId } = createLocalReplyPermalinks()
  const replyNote = new Note({
    id: replyId,
    attribution: actorUri,
    content: reply,
    mediaType: "text/plain",
    replyTarget: targetObjectUri,
    to: targetActorUri,
    cc: PUBLIC_COLLECTION,
    published: publishedAt,
  })
  const create = new Create({
    id: createId,
    actor: actorUri,
    object: replyNote,
    to: targetActorUri,
    cc: PUBLIC_COLLECTION,
    published: publishedAt,
  })

  await persistLocalReplyActivity(create)

  try {
    await target.context.sendActivity(
      { identifier: ACTOR_IDENTIFIER },
      target.actor,
      create,
      { preferSharedInbox: true },
    )
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
  const activity = reaction === "❤️"
    ? new Like({
      id: new URL(`#like-remote-${crypto.randomUUID()}`, actorUri),
      actor: actorUri,
      object: targetObjectUri,
      to: targetActorUri,
      cc: PUBLIC_COLLECTION,
      published: Temporal.Now.instant(),
    })
    : new EmojiReact({
      id: new URL(`#react-remote-${crypto.randomUUID()}`, actorUri),
      actor: actorUri,
      object: targetObjectUri,
      content: reaction,
      to: targetActorUri,
      cc: PUBLIC_COLLECTION,
      published: Temporal.Now.instant(),
    })

  await target.context.sendActivity(
    { identifier: ACTOR_IDENTIFIER },
    target.actor,
    activity,
    { preferSharedInbox: true },
  )

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
