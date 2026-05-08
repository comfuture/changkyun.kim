import {
  EmojiReact,
  isActor,
  Like,
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
}

type ReactionRow = {
  reaction: string
  count: number | bigint | string
}

type ReactionActivity = Like | EmojiReact

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

function normalizeReactionValue(value: string): string | null {
  const reaction = value.replace(/\s+/g, " ").trim()
  if (!reaction || reaction.length > 64) {
    return null
  }
  return reaction
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

async function resolveReactionActor(ctx: { documentLoader: any; contextLoader: any }, reaction: ReactionActivity): Promise<string | null> {
  const actor = await reaction.getActor({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  return isActor(actor) && actor.id ? actor.id.href : null
}

function getReactionValue(reaction: ReactionActivity): string | null {
  if (reaction instanceof Like) {
    return HEART_REACTION
  }
  return normalizeReactionValue(
    stringifyLanguageValue(reaction.content)
    || stringifyLanguageValue(reaction.name),
  )
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

  const actorId = await resolveReactionActor(ctx, reaction)
  const reactionValue = getReactionValue(reaction)
  if (!actorId || !reactionValue) {
    return false
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = JSON.stringify(await reaction.toJsonLd({ format: "compact" }))
  const publishedAt = reaction.published?.toString() ?? new Date().toISOString()
  const activityId = reaction.id?.href ?? null
  const reactionType = reaction instanceof Like ? "Like" : "EmojiReact"

  await db.sql`INSERT INTO activitypub_reactions (
    activity_id,
    article_id,
    article_path,
    actor_id,
    reaction,
    reaction_type,
    object_id,
    published_at,
    payload
  ) VALUES (
    ${activityId},
    ${target.articleId},
    ${target.articlePath},
    ${actorId},
    ${reactionValue},
    ${reactionType},
    ${target.objectId},
    ${publishedAt},
    ${payload}
  )
  ON CONFLICT(article_path, actor_id) DO UPDATE SET
    activity_id = excluded.activity_id,
    article_id = excluded.article_id,
    reaction = excluded.reaction,
    reaction_type = excluded.reaction_type,
    object_id = excluded.object_id,
    published_at = excluded.published_at,
    payload = excluded.payload,
    updated_at = CURRENT_TIMESTAMP`

  return true
}

export async function removeReactionFromUndo(
  ctx: { documentLoader: any; contextLoader: any },
  undo: { objectId: URL | null; getActor: (options: any) => Promise<unknown>; getObject: (options: any) => Promise<unknown> },
): Promise<boolean> {
  const actor = await undo.getActor({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })
  if (!isActor(actor) || !actor.id) {
    return false
  }

  const object = await undo.getObject({
    documentLoader: ctx.documentLoader,
    contextLoader: ctx.contextLoader,
    suppressError: true,
  })

  await ensureActivityPubSchema()
  const db = getDatabase()
  if (object instanceof Like || object instanceof EmojiReact) {
    const target = await resolveReactionTarget(ctx, object)
    if (!target) {
      const activityId = object.id?.href ?? undo.objectId?.href ?? null
      if (!activityId) {
        return false
      }
      const result = await db.sql`DELETE FROM activitypub_reactions
        WHERE actor_id = ${actor.id.href}
          AND activity_id = ${activityId}`
      return countValue((result as { changes?: unknown }).changes) > 0
    }

    const result = await db.sql`DELETE FROM activitypub_reactions
      WHERE actor_id = ${actor.id.href}
        AND article_path = ${target.articlePath}`
    return countValue((result as { changes?: unknown }).changes) > 0
  }

  if (!undo.objectId) {
    return false
  }
  const result = await db.sql`DELETE FROM activitypub_reactions
    WHERE actor_id = ${actor.id.href}
      AND activity_id = ${undo.objectId.href}`
  return countValue((result as { changes?: unknown }).changes) > 0
}

export async function listActivityPubReactions(articlePath: string): Promise<ActivityPubReaction[]> {
  const normalizedPath = normalizeArticlePath(articlePath)
  if (!normalizedPath.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
    return []
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT reaction, COUNT(*) AS count
    FROM activitypub_reactions
    WHERE article_path = ${normalizedPath}
    GROUP BY reaction
    ORDER BY count DESC, MIN(id) ASC`

  return ((rows ?? []) as ReactionRow[]).map((row) => ({
    reaction: row.reaction,
    count: countValue(row.count),
  }))
}
