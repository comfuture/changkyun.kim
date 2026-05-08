import {
  Article,
  Create,
  Image,
  isActor,
  Link,
  Note,
  PUBLIC_COLLECTION,
  type Actor,
} from "@fedify/vocab"

import { ensureActivityPubSchema } from "./activityPubSchema"

export type ActivityPubFeedPost = {
  id: number
  objectId: string
  activityId: string | null
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
  actorSlug: string
  objectType: string
  name: string | null
  summary: string | null
  contentText: string
  url: string
  publishedAt: string
  receivedAt: string
  source: string
  routePath: string
}

type FeedPostRow = {
  id: number
  object_id: string
  activity_id?: string | null
  actor_id: string
  actor_name: string
  actor_url: string
  actor_icon_url?: string | null
  object_type: string
  name?: string | null
  summary?: string | null
  content_text: string
  url?: string | null
  published_at: string
  received_at: string
  source: string
}

type ActorProfile = {
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
}

type ActorTarget = {
  actorId: string
  relation: "follower" | "following" | "mutual"
  lastCrawledAt: string | null
}

const CRAWL_ACTOR_LIMIT = 25
const CRAWL_ITEMS_PER_ACTOR = 20
const CRAWL_INTERVAL_MS = 30 * 60 * 1000

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

function stripHtmlTags(value: string): string {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
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

function toPublishedAt(value: unknown): string {
  const text = value?.toString?.()
  const parsed = text ? Date.parse(text) : Number.NaN
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString()
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "actor"
}

export function actorSlug(actorId: string): string {
  try {
    const url = new URL(actorId)
    const handle = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "")
    return slugPart(`${url.hostname}-${handle || "actor"}`)
  } catch {
    return slugPart(actorId)
  }
}

function toFeedPost(row: FeedPostRow): ActivityPubFeedPost {
  const slug = actorSlug(row.actor_id)
  return {
    id: row.id,
    objectId: row.object_id,
    activityId: row.activity_id ?? null,
    actorId: row.actor_id,
    actorName: row.actor_name || row.actor_id,
    actorUrl: row.actor_url || row.actor_id,
    actorIconUrl: row.actor_icon_url ?? null,
    actorSlug: slug,
    objectType: row.object_type,
    name: row.name ?? null,
    summary: row.summary ?? null,
    contentText: row.content_text,
    url: row.url || row.object_id,
    publishedAt: row.published_at,
    receivedAt: row.received_at,
    source: row.source,
    routePath: `/following/${slug}/${row.id}`,
  }
}

function isSupportedFeedObject(object: unknown): object is Note | Article {
  return object instanceof Note || object instanceof Article
}

function hasPublicAudience(object: { toIds?: URL[]; ccIds?: URL[] }, activity?: { toIds?: URL[]; ccIds?: URL[] }): boolean {
  const publicHref = (PUBLIC_COLLECTION as URL).href
  const audience = [
    ...(object.toIds ?? []),
    ...(object.ccIds ?? []),
    ...(activity?.toIds ?? []),
    ...(activity?.ccIds ?? []),
  ]
  return audience.some((url) => url.href === publicHref)
}

async function resolveActorProfile(ctx: { documentLoader: any; contextLoader: any }, actor: Actor): Promise<ActorProfile | null> {
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

async function getActorRelation(actorId: string): Promise<ActorTarget["relation"] | null> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const [followers, following] = await Promise.all([
    db.sql`SELECT 1 FROM followers WHERE actor_id = ${actorId} AND status = 'accepted' LIMIT 1`,
    db.sql`SELECT 1 FROM following WHERE actor_id = ${actorId} AND status IN ('accepted', 'requested') LIMIT 1`,
  ])
  const isFollower = Boolean(followers.rows?.length)
  const isFollowing = Boolean(following.rows?.length)
  if (isFollower && isFollowing) {
    return "mutual"
  }
  if (isFollowing) {
    return "following"
  }
  if (isFollower) {
    return "follower"
  }
  return null
}

async function upsertFeedActor(profile: ActorProfile, relation: ActorTarget["relation"], lastSeenObjectId?: string | null): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  await db.sql`INSERT INTO activitypub_feed_actors (
      actor_id,
      actor_name,
      actor_url,
      actor_icon_url,
      relation,
      last_seen_object_id,
      updated_at
    ) VALUES (
      ${profile.actorId},
      ${profile.actorName},
      ${profile.actorUrl},
      ${profile.actorIconUrl},
      ${relation},
      ${lastSeenObjectId ?? null},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(actor_id) DO UPDATE SET
      actor_name = excluded.actor_name,
      actor_url = excluded.actor_url,
      actor_icon_url = excluded.actor_icon_url,
      relation = excluded.relation,
      last_seen_object_id = COALESCE(excluded.last_seen_object_id, activitypub_feed_actors.last_seen_object_id),
      updated_at = CURRENT_TIMESTAMP`
}

async function markActorCrawled(actorId: string, relation: ActorTarget["relation"], lastSeenObjectId?: string | null): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  await db.sql`INSERT INTO activitypub_feed_actors (
      actor_id,
      relation,
      last_crawled_at,
      last_seen_object_id,
      updated_at
    ) VALUES (
      ${actorId},
      ${relation},
      ${new Date().toISOString()},
      ${lastSeenObjectId ?? null},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(actor_id) DO UPDATE SET
      relation = excluded.relation,
      last_crawled_at = excluded.last_crawled_at,
      last_seen_object_id = COALESCE(excluded.last_seen_object_id, activitypub_feed_actors.last_seen_object_id),
      updated_at = CURRENT_TIMESTAMP`
}

async function persistFeedObject(options: {
  ctx: { documentLoader: any; contextLoader: any }
  actor: Actor
  object: Note | Article
  activity?: Create | null
  source: "crawl" | "inbox"
}): Promise<boolean> {
  if (!options.actor.id || !options.object.id) {
    return false
  }
  if (!hasPublicAudience(options.object, options.activity ?? undefined)) {
    return false
  }
  const attributionId = options.object.attributionId?.href
  if (attributionId && attributionId !== options.actor.id.href) {
    return false
  }

  const relation = await getActorRelation(options.actor.id.href)
  if (!relation) {
    return false
  }

  const profile = await resolveActorProfile(options.ctx, options.actor)
  if (!profile) {
    return false
  }
  await upsertFeedActor(profile, relation, options.object.id.href)

  const contentHtml = stringifyLanguageValue(options.object.content)
  const summary = stringifyLanguageValue(options.object.summary)
  const name = stringifyLanguageValue(options.object.name)
  const contentText = htmlToText(contentHtml) || summary || name || firstUrl(options.object.url) || options.object.id.href
  const publishedAt = toPublishedAt(options.object.published ?? options.activity?.published)
  const objectUrl = firstUrl(options.object.url) ?? options.object.id.href
  const payload = JSON.stringify(await (options.activity ?? options.object).toJsonLd({ format: "compact" }))

  await ensureActivityPubSchema()
  const db = getDatabase()
  await db.sql`INSERT INTO activitypub_feed_posts (
      object_id,
      activity_id,
      actor_id,
      actor_name,
      actor_url,
      actor_icon_url,
      object_type,
      name,
      summary,
      content_text,
      content_html,
      url,
      published_at,
      source,
      visibility,
      payload
    ) VALUES (
      ${options.object.id.href},
      ${options.activity?.id?.href ?? null},
      ${profile.actorId},
      ${profile.actorName},
      ${profile.actorUrl},
      ${profile.actorIconUrl},
      ${options.object instanceof Article ? "Article" : "Note"},
      ${name || null},
      ${summary || null},
      ${contentText},
      ${contentHtml || null},
      ${objectUrl},
      ${publishedAt},
      ${options.source},
      'public',
      ${payload}
    )
    ON CONFLICT(object_id) DO UPDATE SET
      activity_id = COALESCE(excluded.activity_id, activitypub_feed_posts.activity_id),
      actor_id = excluded.actor_id,
      actor_name = excluded.actor_name,
      actor_url = excluded.actor_url,
      actor_icon_url = excluded.actor_icon_url,
      object_type = excluded.object_type,
      name = excluded.name,
      summary = excluded.summary,
      content_text = excluded.content_text,
      content_html = excluded.content_html,
      url = excluded.url,
      published_at = excluded.published_at,
      source = CASE
        WHEN activitypub_feed_posts.source = 'inbox' THEN activitypub_feed_posts.source
        ELSE excluded.source
      END,
      visibility = 'public',
      payload = excluded.payload,
      updated_at = CURRENT_TIMESTAMP`

  return true
}

export async function persistFeedPostFromCreate(ctx: { documentLoader: any; contextLoader: any }, create: Create): Promise<boolean> {
  const actor = await create.getActor({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (!isActor(actor) || !actor.id) {
    return false
  }

  const object = await create.getObject({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (!isSupportedFeedObject(object)) {
    return false
  }

  return await persistFeedObject({
    ctx,
    actor,
    object,
    activity: create,
    source: "inbox",
  })
}

async function loadActorTargets(limit: number): Promise<ActorTarget[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const [followerRows, followingRows, stateRows] = await Promise.all([
    db.sql`SELECT actor_id FROM followers WHERE status = 'accepted'`,
    db.sql`SELECT actor_id FROM following WHERE status IN ('accepted', 'requested')`,
    db.sql`SELECT actor_id, last_crawled_at FROM activitypub_feed_actors`,
  ])
  const states = new Map<string, string | null>()
  for (const row of stateRows.rows ?? []) {
    const item = row as { actor_id?: string | null; last_crawled_at?: string | null }
    if (item.actor_id) {
      states.set(item.actor_id, item.last_crawled_at ?? null)
    }
  }

  const relations = new Map<string, { follower: boolean; following: boolean }>()
  for (const row of followerRows.rows ?? []) {
    const actorId = (row as { actor_id?: string | null }).actor_id
    if (actorId) {
      relations.set(actorId, { ...(relations.get(actorId) ?? { follower: false, following: false }), follower: true })
    }
  }
  for (const row of followingRows.rows ?? []) {
    const actorId = (row as { actor_id?: string | null }).actor_id
    if (actorId) {
      relations.set(actorId, { ...(relations.get(actorId) ?? { follower: false, following: false }), following: true })
    }
  }

  const now = Date.now()
  return Array.from(relations.entries())
    .map(([actorId, relation]) => ({
      actorId,
      relation: relation.follower && relation.following ? "mutual" : relation.following ? "following" : "follower",
      lastCrawledAt: states.get(actorId) ?? null,
    }) satisfies ActorTarget)
    .filter((target) => {
      if (!target.lastCrawledAt) {
        return true
      }
      const crawledAt = Date.parse(target.lastCrawledAt)
      return Number.isNaN(crawledAt) || now - crawledAt >= CRAWL_INTERVAL_MS
    })
    .slice(0, limit)
}

export async function crawlActivityPubFeed(ctx: {
  documentLoader: any
  contextLoader: any
  lookupObject: (identifier: string | URL) => Promise<unknown>
  traverseCollection: (collection: any) => AsyncIterable<unknown>
}, options: {
  actorLimit?: number
  itemsPerActor?: number
} = {}): Promise<{ actors: number; posts: number }> {
  const actorLimit = Math.max(1, Math.min(options.actorLimit ?? CRAWL_ACTOR_LIMIT, 100))
  const itemsPerActor = Math.max(1, Math.min(options.itemsPerActor ?? CRAWL_ITEMS_PER_ACTOR, 50))
  const targets = await loadActorTargets(actorLimit)
  let crawledActors = 0
  let storedPosts = 0

  for (const target of targets) {
    const actor = await ctx.lookupObject(target.actorId).catch(() => null)
    if (!isActor(actor) || !actor.id) {
      await markActorCrawled(target.actorId, target.relation)
      continue
    }

    const profile = await resolveActorProfile(ctx, actor)
    if (profile) {
      await upsertFeedActor(profile, target.relation)
    }

    const outbox = await actor.getOutbox({
      documentLoader: ctx.documentLoader,
      contextLoader: ctx.contextLoader,
      suppressError: true,
    })
    if (!outbox) {
      await markActorCrawled(actor.id.href, target.relation)
      continue
    }

    let seen = 0
    let lastSeenObjectId: string | null = null
    for await (const item of ctx.traverseCollection(outbox)) {
      if (seen >= itemsPerActor) {
        break
      }
      seen += 1

      if (item instanceof Create) {
        const stored = await persistFeedPostFromCreate(ctx, item)
        if (stored) {
          storedPosts += 1
          lastSeenObjectId = item.objectId?.href ?? lastSeenObjectId
        }
        continue
      }

      if (isSupportedFeedObject(item)) {
        const stored = await persistFeedObject({
          ctx,
          actor,
          object: item,
          activity: null,
          source: "crawl",
        })
        if (stored) {
          storedPosts += 1
          lastSeenObjectId = item.id?.href ?? lastSeenObjectId
        }
      }
    }

    await markActorCrawled(actor.id.href, target.relation, lastSeenObjectId)
    crawledActors += 1
  }

  return { actors: crawledActors, posts: storedPosts }
}

export async function listActivityPubFeedPosts(options: {
  limit?: number
  offset?: number
} = {}): Promise<ActivityPubFeedPost[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const limit = Math.max(1, Math.min(options.limit ?? 30, 100))
  const offset = Math.max(0, options.offset ?? 0)
  const { rows } = await db.sql`SELECT
      id,
      object_id,
      activity_id,
      actor_id,
      actor_name,
      actor_url,
      actor_icon_url,
      object_type,
      name,
      summary,
      content_text,
      url,
      published_at,
      received_at,
      source
    FROM activitypub_feed_posts
    WHERE visibility = 'public'
      AND (
        EXISTS (
          SELECT 1 FROM followers
          WHERE followers.actor_id = activitypub_feed_posts.actor_id
            AND followers.status = 'accepted'
        )
        OR EXISTS (
          SELECT 1 FROM following
          WHERE following.actor_id = activitypub_feed_posts.actor_id
            AND following.status IN ('accepted', 'requested')
        )
      )
    ORDER BY datetime(published_at) DESC, id DESC
    LIMIT ${limit}
    OFFSET ${offset}`

  return ((rows ?? []) as FeedPostRow[]).map(toFeedPost)
}

export async function getActivityPubFeedPost(id: number): Promise<ActivityPubFeedPost | null> {
  if (!Number.isInteger(id) || id < 1) {
    return null
  }
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT
      id,
      object_id,
      activity_id,
      actor_id,
      actor_name,
      actor_url,
      actor_icon_url,
      object_type,
      name,
      summary,
      content_text,
      url,
      published_at,
      received_at,
      source
    FROM activitypub_feed_posts
    WHERE id = ${id}
      AND visibility = 'public'
      AND (
        EXISTS (
          SELECT 1 FROM followers
          WHERE followers.actor_id = activitypub_feed_posts.actor_id
            AND followers.status = 'accepted'
        )
        OR EXISTS (
          SELECT 1 FROM following
          WHERE following.actor_id = activitypub_feed_posts.actor_id
            AND following.status IN ('accepted', 'requested')
        )
      )
    LIMIT 1`

  const row = rows?.[0] as FeedPostRow | undefined
  return row ? toFeedPost(row) : null
}
