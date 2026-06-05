import {
  EmojiReact,
  Image,
  isActor,
  Like,
  Link,
  type Actor,
} from "@fedify/vocab"

import {
  FEDIFY_BLOG_CANONICAL_HOSTNAMES,
  FEDIFY_BLOG_COLLECTION_PREFIX,
  fetchFedifyContentEntry,
  normalizeArticlePath,
  SITE_ORIGIN,
} from "./fedifyContent"
import { ensureActivityPubSchema } from "./activityPubSchema"

export type ActivityPubReaction = {
  reaction: string
  count: number
  actors: ActivityPubReactionActor[]
}

export type ActivityPubReactionActor = {
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
}

type ReactionCountRow = {
  reaction: string
  count: number | bigint | string
}

type ReactionActorRow = {
  reaction: string
  actor_id: string
  actor_name?: string | null
  actor_url?: string | null
  actor_icon_url?: string | null
}

type ReactionActivity = Like | EmojiReact
type ReactionValueContext = { documentLoader: any; contextLoader: any }

const HEART_REACTION = "❤️"
const SITE_HOST = new URL(SITE_ORIGIN).host.toLowerCase()
const BLOG_HOSTS = new Set(Array.from(FEDIFY_BLOG_CANONICAL_HOSTNAMES, (host) => host.toLowerCase()))

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

function countValue(raw: unknown): number {
  if (typeof raw === "number") {
    return raw
  }
  if (typeof raw === "bigint") {
    return Number(raw)
  }
  if (typeof raw === "string") {
    return Number.parseInt(raw, 10) || 0
  }
  return 0
}

function mapActorRow(actor: ReactionActorRow): ActivityPubReactionActor {
  return {
    actorId: actor.actor_id,
    actorName: actor.actor_name || actor.actor_id,
    actorUrl: actor.actor_url || actor.actor_id,
    actorIconUrl: actor.actor_icon_url || null,
  }
}

function normalizeReactionValue(value: string): string | null {
  const reaction = value.replace(/\s+/g, " ").trim()
  if (!reaction || reaction.length > 64) {
    return null
  }
  return reaction
}

function firstReactionText(...values: unknown[]): string | null {
  for (const value of values) {
    const reaction = normalizeReactionValue(stringifyLanguageValue(value))
    if (reaction) {
      return reaction
    }
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !(value instanceof URL)
    ? value as Record<string, unknown>
    : null
}

function firstJsonLdReactionValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const reaction = firstJsonLdReactionValue(item)
      if (reaction) {
        return reaction
      }
    }
    return null
  }

  const record = asRecord(value)
  if (!record) {
    return firstReactionText(value)
  }

  const directReaction = firstReactionText(record.content, record.name)
  if (directReaction) {
    return directReaction
  }

  return firstJsonLdReactionValue(record.tag)
}

async function getReactionTagValue(ctx: ReactionValueContext, reaction: ReactionActivity): Promise<string | null> {
  for await (const tag of reaction.getTags({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })) {
    const tagRecord = asRecord(tag)
    const tagReaction = firstReactionText(tagRecord?.content, tagRecord?.name)
    if (tagReaction) {
      return tagReaction
    }
  }
  return null
}

function normalizeReactionTarget(target: URL): { articleId: string; articlePath: string; objectId: string } | null {
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
    objectId: target.href,
  }
}

async function resolveReactionTarget(ctx: { documentLoader: any; contextLoader: any }, reaction: ReactionActivity) {
  const targetId = reaction.objectId
  if (targetId) {
    return normalizeReactionTarget(targetId)
  }

  const object = await reaction.getObject({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  return object?.id ? normalizeReactionTarget(object.id) : null
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

async function resolveActorProfile(ctx: { documentLoader: any; contextLoader: any }, actor: Actor): Promise<ActivityPubReactionActor | null> {
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

async function resolveReactionActor(ctx: { documentLoader: any; contextLoader: any }, reaction: ReactionActivity): Promise<ActivityPubReactionActor | null> {
  const actor = await reaction.getActor({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  return isActor(actor) ? await resolveActorProfile(ctx, actor) : null
}

async function getReactionValue(
  ctx: ReactionValueContext,
  reaction: ReactionActivity,
  payloadJsonLd: unknown,
): Promise<string | null> {
  if (reaction instanceof Like) {
    return HEART_REACTION
  }

  return firstReactionText(reaction.content, reaction.name)
    ?? await getReactionTagValue(ctx, reaction)
    ?? firstJsonLdReactionValue(payloadJsonLd)
}

export async function persistReactionFromActivity(
  ctx: { documentLoader: any; contextLoader: any },
  reaction: ReactionActivity,
): Promise<boolean> {
  const target = await resolveReactionTarget(ctx, reaction)
  if (!target) {
    return false
  }
  const entry = await fetchFedifyContentEntry("blog", target.articlePath)
  if (!entry) {
    return false
  }

  const actor = await resolveReactionActor(ctx, reaction)
  const payloadJsonLd = await reaction.toJsonLd({ format: "compact" })
  const reactionValue = await getReactionValue(ctx, reaction, payloadJsonLd)
  if (!actor || !reactionValue) {
    return false
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = JSON.stringify(payloadJsonLd)
  const publishedAt = reaction.published?.toString() ?? new Date().toISOString()
  const activityId = reaction.id?.href ?? null
  const reactionType = reaction instanceof Like ? "Like" : "EmojiReact"

  await db.sql`INSERT INTO activitypub_reactions (
    activity_id,
    article_id,
    article_path,
    actor_id,
    actor_name,
    actor_url,
    actor_icon_url,
    reaction,
    reaction_type,
    object_id,
    published_at,
    payload
  ) VALUES (
    ${activityId},
    ${target.articleId},
    ${target.articlePath},
    ${actor.actorId},
    ${actor.actorName},
    ${actor.actorUrl},
    ${actor.actorIconUrl},
    ${reactionValue},
    ${reactionType},
    ${target.objectId},
    ${publishedAt},
    ${payload}
  )
  ON CONFLICT(article_path, actor_id) DO UPDATE SET
    activity_id = excluded.activity_id,
    article_id = excluded.article_id,
    actor_name = excluded.actor_name,
    actor_url = excluded.actor_url,
    actor_icon_url = excluded.actor_icon_url,
    reaction = excluded.reaction,
    reaction_type = excluded.reaction_type,
    object_id = excluded.object_id,
    published_at = excluded.published_at,
    payload = excluded.payload,
    updated_at = CURRENT_TIMESTAMP`

  return true
}

export async function handleReactionUndo(
  ctx: { documentLoader: any; contextLoader: any },
  undo: { objectId: URL | null; getActor: (options: any) => Promise<unknown>; getObject: (options: any) => Promise<unknown> },
  options: { actorId?: string; object?: unknown } = {},
): Promise<boolean> {
  let actorId = options.actorId ?? null
  if (!actorId) {
    const actor = await undo.getActor({
      documentLoader: ctx.documentLoader,
      contextLoader: ctx.contextLoader,
      suppressError: true,
    })
    if (!isActor(actor) || !actor.id) {
      return false
    }
    actorId = actor.id.href
  }

  const object = options.object ?? await undo.getObject({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })

  await ensureActivityPubSchema()
  const db = getDatabase()
  if (object instanceof Like || object instanceof EmojiReact) {
    const activityId = object.id?.href ?? undo.objectId?.href ?? null
    if (!activityId) {
      return true
    }
    await db.sql`DELETE FROM activitypub_reactions
      WHERE actor_id = ${actorId}
        AND activity_id = ${activityId}`
    return true
  }

  if (!undo.objectId) {
    return false
  }
  const result = await db.sql`DELETE FROM activitypub_reactions
    WHERE actor_id = ${actorId}
      AND activity_id = ${undo.objectId.href}`
  return countValue((result as { changes?: unknown }).changes) > 0
}

export async function listActivityPubReactions(articlePath: string): Promise<ActivityPubReaction[]> {
  const normalizedPath = normalizeArticlePath(articlePath)
  if (!normalizedPath.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
    return []
  }

  const db = getDatabase()
  const { rows: countRows } = await db.sql`SELECT
      reaction,
      COUNT(*) AS count
    FROM activitypub_reactions
    WHERE article_path = ${normalizedPath}
    GROUP BY reaction
    ORDER BY count DESC`

  const { rows: actorRows } = await db.sql`SELECT
      reaction,
      actor_id,
      actor_name,
      actor_url,
      actor_icon_url
    FROM (
      SELECT
        reaction,
        actor_id,
        actor_name,
        actor_url,
        actor_icon_url,
        ROW_NUMBER() OVER (PARTITION BY reaction ORDER BY published_at DESC, id DESC) AS reaction_rank
      FROM activitypub_reactions
      WHERE article_path = ${normalizedPath}
    )
    WHERE reaction_rank <= 50
    ORDER BY reaction, reaction_rank ASC`

  const actorsByReaction = new Map<string, ActivityPubReactionActor[]>()
  for (const row of (actorRows ?? []) as ReactionActorRow[]) {
    const actors = actorsByReaction.get(row.reaction) ?? []
    actors.push(mapActorRow(row))
    actorsByReaction.set(row.reaction, actors)
  }

  return ((countRows ?? []) as ReactionCountRow[]).map((row) => ({
    reaction: row.reaction,
    count: countValue(row.count),
    actors: actorsByReaction.get(row.reaction) ?? [],
  }))
}
