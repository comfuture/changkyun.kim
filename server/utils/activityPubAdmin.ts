import { Create, isActor, Note, PUBLIC_COLLECTION } from "@fedify/vocab"
import { Temporal } from "@js-temporal/polyfill"

import { createFedifyContext, getCloudflareEnv } from "./fedify"
import { ACTOR_IDENTIFIER, SITE_ORIGIN } from "./fedifyContent"
import { ensureActivityPubSchema } from "./activityPubSchema"

export type AdminFollowItem = {
  id: number
  actorId: string
  activityId: string | null
  status: string
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
  activity_id: string | null
  status: string
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

export async function listActivityPubFollowersForAdmin(): Promise<AdminFollowItem[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT
    id,
    actor_id,
    activity_id,
    status,
    created_at,
    updated_at
  FROM followers
    WHERE status IN ('accepted', 'requested')
  ORDER BY updated_at DESC, id DESC`

  return ((rows ?? []) as FollowRow[]).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    activityId: row.activity_id ?? null,
    status: row.status,
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

export async function replyActivityPubCommentById(
  id: number,
  replyText: string,
  event?: unknown,
): Promise<{ actorId: string; commentObjectId: string }> {
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

  const env = getDashboardEnv(event)
  const context = await createFedifyContext(env as Parameters<typeof createFedifyContext>[0])
  const actorUri = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN)
  const targetActor = new URL(row.actor_id)
  const target = new URL(row.object_id)
  const recipient = await context.lookupObject(targetActor)
  if (!isActor(recipient) || !recipient.id) {
    throw new Error("Comment actor not found")
  }

  const reply = new Note({
    id: new URL(`#reply-${crypto.randomUUID()}`, actorUri),
    attribution: actorUri,
    content: replyText,
    mediaType: "text/plain",
    replyTarget: target,
    to: targetActor,
    cc: PUBLIC_COLLECTION,
    published: Temporal.Now.instant(),
  })

  const create = new Create({
    id: new URL(`#create-reply-${crypto.randomUUID()}`, actorUri),
    actor: actorUri,
    object: reply,
    to: targetActor,
    cc: PUBLIC_COLLECTION,
    published: Temporal.Now.instant(),
  })

  await context.sendActivity(
    { identifier: ACTOR_IDENTIFIER },
    recipient,
    create,
    { preferSharedInbox: true },
  )

  return {
    actorId: row.actor_id,
    commentObjectId: row.object_id,
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
