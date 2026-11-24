// ActivityPub federation for the single local actor, built on the in-repo
// `@changkyun/activitypub` library (formerly Fedify; the file name is kept to
// keep the diff small).
import {
  DocumentLoader,
  MemoryKvStore,
  asArray,
  deliverActivity,
  deliveryMessages,
  exportPublicKeyPem,
  firstId,
  handleInbox,
  hasType,
  idOf,
  importPrivateKeyPem,
  importPublicKeyPem,
  isActivityProcessed,
  isObject,
  isQueueMessage,
  kvFromNamespace,
  lookupObject,
  markActivityProcessed,
  resolveInboxes,
  retryDelaySeconds,
  sameOrigin,
  traverseCollection,
  type JsonObject,
  type KvStore,
  type SigningKey,
} from "@changkyun/activitypub"
import { queryCollection } from "@nuxt/content/server"
import type { H3Event } from "h3"
import {
  ACTOR_IDENTIFIER,
  AS_PUBLIC,
  collectCreateActivities,
  FEDIFY_OUTBOX_PAGE_SIZE,
  SITE_ORIGIN,
  type ActivityPubCreate,
} from "./fedifyContent"
import packageJson from "../../package.json"
import {
  loadLocalReplyCreate,
  loadLocalReplyNote,
  markCommentDeletedFromDelete,
  persistCommentFromCreate,
} from "./fedifyComments"
import {
  handleReactionUndo,
  persistReactionFromActivity,
} from "./fedifyReactions"
import { persistFeedPostFromCreate } from "./activityPubFeed"
import { ensureActivityPubSchema } from "./activityPubSchema"
import {
  ACCEPT_CONTEXT,
  ACTOR_CONTEXT,
  COLLECTION_CONTEXT,
  CREATE_CONTEXT,
  FOLLOW_CONTEXT,
  OBJECT_CONTEXT,
  UPDATE_CONTEXT,
  toDeliveryDocument,
  withActivityPubContext,
} from "./activityPubVocab"

export type CloudflareEnv = {
  FEDIFY_KV?: any
  FEDIFY_QUEUE?: any
  BSKY_USER?: string
  BSKY_PASSWORD?: string
}

export type FedifyContextData = {
  env?: CloudflareEnv
  event?: H3Event
}

export type NodeInfo = {
  software: { name: string; version: string; homepage: URL }
  protocols: string[]
  services: { inbound: string[]; outbound: string[] }
  openRegistrations: boolean
  usage: { users: { total: number }; localPosts: number; localComments: number }
  metadata: Record<string, unknown>
}

/** Recipient of `sendActivity`: an actor document, several, or the followers collection. */
export type ActivityRecipient = JsonObject | JsonObject[] | "followers"

export type ActivityPubContext = {
  env?: CloudflareEnv
  kv: KvStore
  loader: DocumentLoader
  /** Looks up an object by IRI or `@user@host` / `acct:` handle. */
  lookupObject: (identifier: string | URL) => Promise<JsonObject | null>
  /** Loads (KV-cached) an actor document; `null` if it is not an actor. */
  loadActor: (actorId: string) => Promise<JsonObject | null>
  traverseCollection: (collection: JsonObject | string) => AsyncIterable<JsonObject>
  /** Delivers an activity (queued when FEDIFY_QUEUE is bound, inline otherwise). */
  sendActivity: (recipient: ActivityRecipient, activity: JsonObject) => Promise<void>
}

const ACTOR_PATH = `/@${ACTOR_IDENTIFIER}`
const ACTOR_URI = new URL(ACTOR_PATH, SITE_ORIGIN)
const ACTOR_KEY_ID = `${ACTOR_URI.href}#main-key`
const FOLLOWERS_URI = new URL(`${ACTOR_PATH}/followers`, SITE_ORIGIN)
const FOLLOWING_URI = new URL(`${ACTOR_PATH}/following`, SITE_ORIGIN)
const OUTBOX_URI = new URL(`${ACTOR_PATH}/outbox`, SITE_ORIGIN)
const INBOX_URI = new URL(`${ACTOR_PATH}/inbox`, SITE_ORIGIN)
const SHARED_INBOX_URI = new URL("/inbox", SITE_ORIGIN)
const OUTBOX_BLOG_POST_OBJECT_PATTERN = new URL("/blog/%", SITE_ORIGIN).href
const OUTBOX_APP_POST_OBJECT_PATTERN = new URL("/app/%", SITE_ORIGIN).href
const USER_AGENT = `changkyun.kim/${packageJson.version} (+${SITE_ORIGIN})`
// New KV namespace prefix; Fedify's keys in the same namespace are left to expire.
const KV_PREFIX = "ap:v1:"
const memoryKv = new MemoryKvStore()

function getDatabase() {
  return useDatabase()
}

export function getCloudflareEnv(event?: any): CloudflareEnv | undefined {
  return event?.context?.cloudflare?.env
    ?? event?.context?._platform?.cloudflare?.env
    ?? (globalThis as any).__env__
}

function makeKv(env?: CloudflareEnv): KvStore {
  return env?.FEDIFY_KV ? kvFromNamespace(env.FEDIFY_KV, KV_PREFIX) : memoryKv
}

// ---------------------------------------------------------------------------
// Actor keys
// ---------------------------------------------------------------------------

type ActorKeys = {
  signingKey: SigningKey
  publicKeyPem: string
}

let actorKeysCache: { privatePem: string; publicPem: string; keys: Promise<ActorKeys> } | null = null

async function getActorKeys(): Promise<ActorKeys | null> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT private_key, public_key FROM actor WHERE actor_id = ${ACTOR_URI.href} LIMIT 1`
  const row = rows?.[0] as { private_key?: string | null; public_key?: string | null } | undefined
  if (!row?.private_key || !row?.public_key) {
    return null
  }
  if (actorKeysCache?.privatePem !== row.private_key || actorKeysCache.publicPem !== row.public_key) {
    const privatePem = row.private_key
    const publicPem = row.public_key
    actorKeysCache = {
      privatePem,
      publicPem,
      keys: (async () => ({
        signingKey: { keyId: ACTOR_KEY_ID, privateKey: await importPrivateKeyPem(privatePem) },
        publicKeyPem: await exportPublicKeyPem(await importPublicKeyPem(publicPem)),
      }))(),
    }
    actorKeysCache.keys.catch(() => {
      actorKeysCache = null
    })
  }
  return await actorKeysCache.keys
}

async function getActorSigningKey(): Promise<SigningKey | null> {
  return (await getActorKeys())?.signingKey ?? null
}

// ---------------------------------------------------------------------------
// Counters and NodeInfo
// ---------------------------------------------------------------------------

async function countRows(table: "followers" | "following", status = "accepted"): Promise<number> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = table === "followers"
    ? await db.sql`SELECT COUNT(*) AS count FROM followers WHERE status = ${status}`
    : await db.sql`SELECT COUNT(*) AS count FROM following WHERE status = ${status}`
  return countValue((rows?.[0] as Record<string, unknown> | undefined)?.count)
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

async function countLocalPosts(): Promise<number> {
  try {
    const db = getDatabase()
    const [blogCount, appCount] = await Promise.all([
      db.sql`SELECT COUNT(*) AS count
        FROM _content_blog
        WHERE createdAt IS NOT NULL
          AND datetime(createdAt) IS NOT NULL
          AND json_extract(meta, '$.draft') IS NOT TRUE`,
      db.sql`SELECT COUNT(*) AS count
        FROM _content_app
        WHERE createdAt IS NOT NULL
          AND datetime(createdAt) IS NOT NULL
          AND json_extract(meta, '$.draft') IS NOT TRUE`,
    ])
    return countValue((blogCount.rows?.[0] as Record<string, unknown> | undefined)?.count)
      + countValue((appCount.rows?.[0] as Record<string, unknown> | undefined)?.count)
  } catch {
    console.warn("Failed to count ActivityPub local posts from content tables; falling back to persisted outbox count.")
  }

  try {
    await ensureActivityPubSchema()
    const db = getDatabase()
    const { rows } = await db.sql`SELECT COUNT(*) AS count
      FROM activity
      WHERE direction = 'outbox'
        AND type = 'Create'
        AND (
          object LIKE ${OUTBOX_BLOG_POST_OBJECT_PATTERN}
          OR object LIKE ${OUTBOX_APP_POST_OBJECT_PATTERN}
        )`
    return countValue((rows?.[0] as Record<string, unknown> | undefined)?.count)
  } catch {
    console.warn("Failed to count ActivityPub local posts from outbox; using 0.")
    return 0
  }
}

async function countLocalPostsFromNuxtContent(event: H3Event): Promise<number> {
  const [blogCount, appCount] = await Promise.all([
    queryCollection(event, "blog").count(),
    queryCollection(event, "app").count(),
  ])
  return blogCount + appCount
}

async function countOutboxItems(event?: H3Event): Promise<number> {
  if (event) {
    try {
      return await countLocalPostsFromNuxtContent(event)
    } catch {
      console.warn("Failed to count ActivityPub outbox content through Nuxt Content; falling back to database count.")
    }
  }
  return await countLocalPosts()
}

/** Serializes NodeInfo 2.1 exactly like Fedify's `nodeInfoToJson()`. */
function nodeInfoToJson(nodeInfo: NodeInfo) {
  return {
    $schema: "http://nodeinfo.diaspora.software/ns/schema/2.1#",
    version: "2.1",
    software: {
      name: nodeInfo.software.name,
      version: nodeInfo.software.version,
      homepage: nodeInfo.software.homepage.href,
    },
    protocols: nodeInfo.protocols,
    services: nodeInfo.services,
    openRegistrations: nodeInfo.openRegistrations,
    usage: nodeInfo.usage,
    metadata: nodeInfo.metadata,
  }
}

export async function getActivityPubNodeInfoJson() {
  return nodeInfoToJson(await getActivityPubNodeInfo())
}

async function countLocalComments(): Promise<number> {
  try {
    await ensureActivityPubSchema()
    const db = getDatabase()
    const { rows } = await db.sql`SELECT COUNT(*) AS count FROM activitypub_comments WHERE status = 'visible'`
    return countValue((rows?.[0] as Record<string, unknown> | undefined)?.count)
  } catch {
    console.warn("Failed to count ActivityPub comments for NodeInfo; using 0.")
    return 0
  }
}

export async function getActivityPubNodeInfo(): Promise<NodeInfo> {
  const [localPosts, localComments] = await Promise.all([
    countLocalPosts(),
    countLocalComments(),
  ])

  return {
    software: {
      name: "changkyun-kim",
      version: packageJson.version,
      homepage: new URL(SITE_ORIGIN),
    },
    protocols: ["activitypub"],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: false,
    usage: {
      users: {
        total: 1,
      },
      localPosts,
      localComments,
    },
    metadata: {},
  }
}

async function collectCreateActivitiesSafe(options: {
  limit?: number | null
  offset?: number
} = {}): Promise<{ totalItems: number; items: ActivityPubCreate[] }> {
  try {
    return await collectCreateActivities(options)
  } catch {
    console.warn("Failed to collect ActivityPub outbox content; returning an empty collection.")
    return { totalItems: 0, items: [] }
  }
}

// ---------------------------------------------------------------------------
// Follow bookkeeping
// ---------------------------------------------------------------------------

function activityToPayload(activity: JsonObject): string {
  return JSON.stringify(activity)
}

async function followActivityUri(actorId: string): Promise<URL> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(actorId))
  const hash = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
  return new URL(`/@${ACTOR_IDENTIFIER}/follow/${hash}`, SITE_ORIGIN)
}

async function getFollowingStatus(actorId: string): Promise<"accepted" | "requested" | null> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT status FROM following WHERE actor_id = ${actorId} LIMIT 1`
  const status = (rows?.[0] as { status?: string | null } | undefined)?.status
  return status === "accepted" || status === "requested" ? status : null
}

async function recordFollowingRequested(actorId: string, follow: JsonObject): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = activityToPayload(follow)
  const activityId = idOf(follow) ?? (await followActivityUri(actorId)).href

  await db.sql`INSERT INTO following (actor_id, activity_id, activity_payload, status)
    VALUES (${actorId}, ${activityId}, ${payload}, 'requested')
    ON CONFLICT(actor_id) DO UPDATE SET
      activity_id = excluded.activity_id,
      activity_payload = excluded.activity_payload,
      status = 'requested',
      updated_at = CURRENT_TIMESTAMP`
}

const FOLLOW_PROPERTIES = ["id", "type", "actor", "object", "to", "cc", "published"]

/**
 * Loads an outgoing Follow (served at /@me/follow/{hash}). Rows written by
 * Fedify hold its compacted JSON-LD; rows written now hold the emitted JSON.
 */
async function loadFollowingActivity(activityId: string): Promise<JsonObject | null> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT actor_id, activity_id, activity_payload
    FROM following
    WHERE activity_id = ${activityId}
      AND status IN ('accepted', 'requested')
    LIMIT 1`
  const row = rows?.[0] as {
    actor_id?: string | null
    activity_id?: string | null
    activity_payload?: string | null
  } | undefined
  if (!row?.actor_id || !row.activity_id) {
    return null
  }

  if (row.activity_payload) {
    try {
      const payload = JSON.parse(row.activity_payload)
      if (isObject(payload) && hasType(payload, "Follow") && idOf(payload)) {
        const follow: JsonObject = {}
        for (const key of FOLLOW_PROPERTIES) {
          if (payload[key] !== undefined) {
            follow[key] = key === "actor" || key === "object" ? (firstId(payload[key]) ?? payload[key]) : payload[key]
          }
        }
        follow.type = "Follow"
        return follow
      }
    } catch {
      console.warn("Failed to parse persisted ActivityPub Follow; reconstructing minimal object.")
    }
  }

  return {
    id: row.activity_id,
    type: "Follow",
    actor: ACTOR_URI.href,
    object: row.actor_id,
    to: row.actor_id,
  }
}

async function removeFollowingRequest(actorId: string, activityId: string): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  await db.sql`DELETE FROM following
    WHERE actor_id = ${actorId}
      AND activity_id = ${activityId}
      AND status = 'requested'`
}

async function sendFollowBack(ctx: ActivityPubContext, actor: JsonObject): Promise<void> {
  const actorId = idOf(actor)
  if (!actorId || !idOf(actor.inbox) || actorId === ACTOR_URI.href) {
    return
  }

  let followId: URL | null = null
  try {
    const existingStatus = await getFollowingStatus(actorId)
    if (existingStatus) {
      return
    }

    followId = await followActivityUri(actorId)
    const follow = withActivityPubContext(FOLLOW_CONTEXT, {
      id: followId.href,
      type: "Follow",
      actor: ACTOR_URI.href,
      object: actorId,
      to: actorId,
    })

    await recordFollowingRequested(actorId, follow)
    await ctx.sendActivity(actor, follow)
  } catch (error) {
    if (followId) {
      await removeFollowingRequest(actorId, followId.href).catch(() => undefined)
    }
    console.error("Failed to send ActivityPub follow-back", error)
  }
}

async function recordFollower(actorId: string, follow: JsonObject): Promise<boolean> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const existing = await db.sql`SELECT status FROM followers WHERE actor_id = ${actorId} LIMIT 1`
  const wasAccepted = (existing.rows?.[0] as { status?: string } | undefined)?.status === "accepted"
  const payload = activityToPayload(follow)
  const activityId = idOf(follow) ?? `${ACTOR_URI.href}/follow/${crypto.randomUUID()}`

  await db.sql`INSERT INTO followers (actor_id, activity_id, activity_payload, status)
    VALUES (${actorId}, ${activityId}, ${payload}, 'accepted')
    ON CONFLICT(actor_id) DO UPDATE SET
      activity_id = excluded.activity_id,
      activity_payload = excluded.activity_payload,
      status = 'accepted',
      updated_at = CURRENT_TIMESTAMP`

  return !wasAccepted
}

async function removeFollower(actorId: string, followActivityId?: string | null): Promise<boolean> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const existing = await db.sql`SELECT status FROM followers WHERE actor_id = ${actorId} LIMIT 1`
  const wasAccepted = (existing.rows?.[0] as { status?: string } | undefined)?.status === "accepted"

  await db.sql`UPDATE followers
    SET status = 'removed',
        activity_id = COALESCE(${followActivityId ?? null}, activity_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE actor_id = ${actorId}`

  return wasAccepted
}

async function recordFollowingAccepted(actorId: string, follow: JsonObject): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = activityToPayload(follow)
  const activityId = idOf(follow) ?? `${ACTOR_URI.href}/follow/${crypto.randomUUID()}`

  await db.sql`INSERT INTO following (actor_id, activity_id, activity_payload, status)
    VALUES (${actorId}, ${activityId}, ${payload}, 'accepted')
    ON CONFLICT(actor_id) DO UPDATE SET
      activity_id = excluded.activity_id,
      activity_payload = excluded.activity_payload,
      status = 'accepted',
      updated_at = CURRENT_TIMESTAMP`
}

async function loadFollowerIds(): Promise<string[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT actor_id FROM followers WHERE status = 'accepted' ORDER BY updated_at DESC`
  return (rows ?? [])
    .map((row) => (row as { actor_id?: string | null }).actor_id)
    .filter((actorId): actorId is string => Boolean(actorId))
}

async function loadFollowingIds(): Promise<string[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT actor_id FROM following WHERE status IN ('accepted', 'requested') ORDER BY updated_at DESC`
  return (rows ?? [])
    .map((row) => (row as { actor_id?: string | null }).actor_id)
    .filter((actorId): actorId is string => Boolean(actorId))
}

/** Resolves each accepted follower's actor document (KV-cached) for delivery. */
async function loadFollowerActors(ctx: ActivityPubContext): Promise<JsonObject[]> {
  const actors: JsonObject[] = []
  for (const actorId of await loadFollowerIds()) {
    try {
      const actor = await ctx.loadActor(actorId)
      if (actor) {
        actors.push(actor)
      }
    } catch (error) {
      console.warn("Failed to resolve ActivityPub follower for delivery", actorId, error)
    }
  }
  return actors
}

async function sendFollowersUpdate(ctx: ActivityPubContext): Promise<void> {
  const actor = await buildActor()
  if (!actor) {
    return
  }

  await ctx.sendActivity("followers", withActivityPubContext(UPDATE_CONTEXT, {
    id: new URL(`#update-${crypto.randomUUID()}`, ACTOR_URI).href,
    type: "Update",
    actor: ACTOR_URI.href,
    cc: FOLLOWERS_URI.href,
    object: actor,
    to: AS_PUBLIC,
  }))
}

// ---------------------------------------------------------------------------
// Served documents
// ---------------------------------------------------------------------------

async function buildActor(): Promise<JsonObject | null> {
  const keys = await getActorKeys()

  return {
    id: ACTOR_URI.href,
    type: "Person",
    discoverable: true,
    indexable: true,
    inbox: INBOX_URI.href,
    ...(keys
      ? {
        publicKey: {
          id: ACTOR_KEY_ID,
          type: "CryptographicKey",
          owner: ACTOR_URI.href,
          publicKeyPem: keys.publicKeyPem,
        },
      }
      : {}),
    endpoints: {
      sharedInbox: SHARED_INBOX_URI.href,
    },
    followers: FOLLOWERS_URI.href,
    following: FOLLOWING_URI.href,
    icon: {
      type: "Image",
      mediaType: "image/jpeg",
      url: new URL("/image/avatar.jpg", SITE_ORIGIN).href,
    },
    image: {
      type: "Image",
      mediaType: "image/jpeg",
      url: new URL("/cdn-cgi/image/fit=crop,w=1280,h=400/image/cover.jpg", SITE_ORIGIN).href,
    },
    name: "김창균",
    outbox: OUTBOX_URI.href,
    preferredUsername: ACTOR_IDENTIFIER,
    summary: "Principled person who values integrity. A slow but persistent learner with deep understanding. Problem solver using data, experience, and intuition.",
    url: new URL("/about", SITE_ORIGIN).href,
  }
}

function activityJsonResponse(body: unknown, method: string, status = 200): Response {
  return new Response(method === "HEAD" ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/activity+json",
      vary: "Accept",
    },
  })
}

function notFoundResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", vary: "Accept" },
  })
}

async function buildOutboxDocument(url: URL, event?: H3Event): Promise<JsonObject> {
  const cursor = url.searchParams.get("cursor")
  if (cursor === null) {
    return withActivityPubContext(COLLECTION_CONTEXT, {
      type: "OrderedCollection",
      id: OUTBOX_URI.href,
      totalItems: await countOutboxItems(event),
      first: `${OUTBOX_URI.href}?cursor=0`,
    })
  }

  const offset = Number.parseInt(cursor, 10) || 0
  const { totalItems, items } = await collectCreateActivitiesSafe({ limit: FEDIFY_OUTBOX_PAGE_SIZE, offset })
  const nextOffset = offset + items.length
  const pageUrl = new URL(OUTBOX_URI.href)
  pageUrl.searchParams.set("cursor", cursor)
  return withActivityPubContext(COLLECTION_CONTEXT, {
    type: "OrderedCollectionPage",
    id: pageUrl.href,
    partOf: OUTBOX_URI.href,
    ...(nextOffset < totalItems ? { next: `${OUTBOX_URI.href}?cursor=${nextOffset}` } : {}),
    orderedItems: items.map((item) => withActivityPubContext(CREATE_CONTEXT, item)),
  })
}

async function buildFollowCollection(kind: "followers" | "following"): Promise<JsonObject> {
  const items = kind === "followers" ? await loadFollowerIds() : await loadFollowingIds()
  return withActivityPubContext(COLLECTION_CONTEXT, {
    type: "OrderedCollection",
    id: (kind === "followers" ? FOLLOWERS_URI : FOLLOWING_URI).href,
    totalItems: await countRows(kind),
    orderedItems: items,
  })
}

/** Serves an ActivityPub GET/HEAD for a federation path, or `null` when unknown. */
async function serveDocument(url: URL, event?: H3Event): Promise<JsonObject | null> {
  const pathname = url.pathname
  if (pathname === ACTOR_PATH) {
    const actor = await buildActor()
    return actor ? withActivityPubContext(ACTOR_CONTEXT, actor) : null
  }
  if (pathname === OUTBOX_URI.pathname) {
    return await buildOutboxDocument(url, event)
  }
  if (pathname === FOLLOWERS_URI.pathname) {
    return await buildFollowCollection("followers")
  }
  if (pathname === FOLLOWING_URI.pathname) {
    return await buildFollowCollection("following")
  }

  const reply = /^\/@([^/]+)\/replies\/([^/]+)$/.exec(pathname)
  if (reply?.[2]) {
    if (reply[1] !== ACTOR_IDENTIFIER) {
      return null
    }
    const note = await loadLocalReplyNote(reply[2])
    return note ? withActivityPubContext(OBJECT_CONTEXT, note) : null
  }

  const replyActivity = /^\/activitypub\/replies\/([^/]+)\/activity$/.exec(pathname)
  if (replyActivity?.[1]) {
    const create = await loadLocalReplyCreate(replyActivity[1])
    return create ? withActivityPubContext(CREATE_CONTEXT, create) : null
  }

  const follow = /^\/@([^/]+)\/follow\/([^/]+)$/.exec(pathname)
  if (follow?.[2]) {
    if (follow[1] !== ACTOR_IDENTIFIER) {
      return null
    }
    const activity = await loadFollowingActivity(new URL(`/@${ACTOR_IDENTIFIER}/follow/${follow[2]}`, SITE_ORIGIN).href)
    return activity ? withActivityPubContext(FOLLOW_CONTEXT, activity) : null
  }

  return null
}

// ---------------------------------------------------------------------------
// Inbox listeners
// ---------------------------------------------------------------------------

/**
 * Returns an object referenced by an activity. Embedded objects are trusted
 * when they come from the activity actor's origin; others are dereferenced
 * from their id (as Fedify did). Objects on our own origin are never fetched.
 */
async function resolveReferencedObject(ctx: ActivityPubContext, value: unknown, trustedOrigin: string | null): Promise<JsonObject | null> {
  const id = idOf(value)
  if (isObject(value) && (!id || sameOrigin(id, trustedOrigin))) {
    return value
  }
  if (!id || sameOrigin(id, SITE_ORIGIN)) {
    return isObject(value) ? value : null
  }
  try {
    return await ctx.loader.load(id)
  } catch {
    return null
  }
}

async function resolveActivityActor(ctx: ActivityPubContext, activity: JsonObject): Promise<JsonObject | null> {
  const actorId = firstId(activity.actor)
  if (!actorId) {
    return null
  }
  try {
    return await ctx.loadActor(actorId)
  } catch {
    return null
  }
}

async function onFollow(ctx: ActivityPubContext, follow: JsonObject): Promise<void> {
  const actor = await resolveActivityActor(ctx, follow)
  const actorId = idOf(actor)
  if (!actor || !actorId) {
    return
  }
  const objectId = firstId(follow.object)
  if (objectId !== ACTOR_URI.href && objectId !== FOLLOWERS_URI.href) {
    return
  }

  const isNewFollower = await recordFollower(actorId, follow)
  const { "@context": _context, signature: _signature, ...followObject } = follow
  const accept = withActivityPubContext(ACCEPT_CONTEXT, {
    id: new URL(`#accept-${crypto.randomUUID()}`, ACTOR_URI).href,
    type: "Accept",
    actor: ACTOR_URI.href,
    object: followObject,
    to: actorId,
  })

  await ctx.sendActivity(actor, accept)
  await sendFollowBack(ctx, actor)

  const { items } = await collectCreateActivitiesSafe({ limit: FEDIFY_OUTBOX_PAGE_SIZE })
  for (const activity of items.slice().reverse()) {
    await ctx.sendActivity(actor, withActivityPubContext(CREATE_CONTEXT, activity))
  }

  if (isNewFollower) {
    await sendFollowersUpdate(ctx)
  }
}

async function onUndo(ctx: ActivityPubContext, undo: JsonObject): Promise<void> {
  const actor = await resolveActivityActor(ctx, undo)
  const actorId = idOf(actor)
  if (!actor || !actorId) {
    return
  }

  const object = await resolveReferencedObject(ctx, undo.object, actorId)
  if (hasType(object, "Follow")) {
    const followActorId = firstId(object!.actor)
    const followTarget = firstId(object!.object)
    if (followActorId && followActorId !== actorId) {
      return
    }
    if (followTarget && followTarget !== ACTOR_URI.href && followTarget !== FOLLOWERS_URI.href) {
      return
    }
    const removed = await removeFollower(actorId, idOf(object) ?? null)
    if (removed) {
      await sendFollowersUpdate(ctx)
    }
    return
  }
  const reactionHandled = await handleReactionUndo(undo, { actorId, object })
  if (reactionHandled || hasType(object, "Like", "EmojiReact")) {
    return
  }

  const removed = await removeFollower(actorId, firstId(undo.object))
  if (removed) {
    await sendFollowersUpdate(ctx)
  }
}

async function onAccept(ctx: ActivityPubContext, accept: JsonObject): Promise<void> {
  const actor = await resolveActivityActor(ctx, accept)
  const actorId = idOf(actor)
  if (!actor || !actorId) {
    return
  }
  const objectId = firstId(accept.object)
  // Our own Follow is looked up locally instead of trusting the embedded copy.
  const object = objectId && sameOrigin(objectId, SITE_ORIGIN)
    ? await loadFollowingActivity(objectId)
    : await resolveReferencedObject(ctx, accept.object, actorId)
  if (hasType(object, "Follow") && asArray(object!.actor).some((id) => idOf(id) === ACTOR_URI.href)) {
    await recordFollowingAccepted(actorId, object!)
  }
}

/** Runs the listeners for one verified inbound activity. Throws on failure. */
export async function processInboxActivity(ctx: ActivityPubContext, activity: JsonObject): Promise<void> {
  if (hasType(activity, "Follow")) {
    await onFollow(ctx, activity)
  } else if (hasType(activity, "Undo")) {
    await onUndo(ctx, activity)
  } else if (hasType(activity, "Accept")) {
    await onAccept(ctx, activity)
  } else if (hasType(activity, "Create")) {
    await persistCommentFromCreate(ctx, activity)
    await persistFeedPostFromCreate(ctx, activity)
  } else if (hasType(activity, "Like", "EmojiReact")) {
    await persistReactionFromActivity(ctx, activity)
  } else if (hasType(activity, "Delete")) {
    await markCommentDeletedFromDelete(activity)
  }
  // Verified but unsupported activities are intentionally accepted.
}

// ---------------------------------------------------------------------------
// Context, delivery and queue
// ---------------------------------------------------------------------------

async function enqueue(env: CloudflareEnv, bodies: unknown[]): Promise<void> {
  const queue = env.FEDIFY_QUEUE
  for (let index = 0; index < bodies.length; index += 100) {
    const chunk = bodies.slice(index, index + 100)
    if (typeof queue.sendBatch === "function") {
      await queue.sendBatch(chunk.map((body) => ({ body })))
    } else {
      for (const body of chunk) {
        await queue.send(body)
      }
    }
  }
}

export async function createFedifyContext(env?: CloudflareEnv): Promise<ActivityPubContext> {
  const kv = makeKv(env)
  const loader = new DocumentLoader({
    userAgent: USER_AGENT,
    kv,
    signer: getActorSigningKey,
  })

  const ctx: ActivityPubContext = {
    env,
    kv,
    loader,
    lookupObject: (identifier) => lookupObject(loader, identifier),
    loadActor: (actorId) => loader.loadActor(actorId),
    traverseCollection: (collection) => traverseCollection(loader, collection),
    async sendActivity(recipient, activity) {
      const recipients = recipient === "followers"
        ? await loadFollowerActors(ctx)
        : Array.isArray(recipient) ? recipient : [recipient]
      const inboxes = resolveInboxes(recipients, { preferSharedInbox: true, excludeOrigins: [SITE_ORIGIN] })
      if (inboxes.length === 0) {
        return
      }
      const context = (activity["@context"] ?? CREATE_CONTEXT) as readonly unknown[]
      const document = toDeliveryDocument(context, activity)
      if (env?.FEDIFY_QUEUE) {
        await enqueue(env, deliveryMessages(document, inboxes))
        return
      }
      const failures: string[] = []
      for (const inbox of inboxes) {
        const result = await deliverActivity(loader, inbox, document)
        if (!result.ok) {
          failures.push(`${inbox} (${result.status ?? result.error})`)
        }
      }
      if (failures.length > 0) {
        throw new Error(`Failed to send activity ${idOf(document)} to ${failures.join(", ")}`)
      }
    },
  }
  return ctx
}

/**
 * Handles a request that the middleware classified as a federation request
 * (inbox POST, or GET/HEAD of an ActivityPub document).
 */
export async function handleFederationRequest(request: Request, options: { env?: CloudflareEnv; event?: H3Event } = {}): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "")
  }

  if (url.pathname === SHARED_INBOX_URI.pathname || url.pathname === INBOX_URI.pathname) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } })
    }
    const ctx = await createFedifyContext(options.env)
    const queued = Boolean(options.env?.FEDIFY_QUEUE)
    return await handleInbox(request, {
      loader: ctx.loader,
      kv: ctx.kv,
      onRejected: (reason, detail) => console.warn("Rejected ActivityPub inbox request", reason, detail),
      onError: (error) => console.error("ActivityPub inbox listener failed", error),
      dispatch: async (activity, meta) => {
        if (queued) {
          await enqueue(options.env!, [{ v: 1, type: "inbox", activity, keyId: meta.keyId, receivedAt: new Date().toISOString() }])
          return
        }
        await processInboxActivity(ctx, activity)
        await markActivityProcessed(ctx.kv, idOf(activity))
      },
    })
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } })
  }
  const document = await serveDocument(url, options.event)
  return document ? activityJsonResponse(document, request.method) : notFoundResponse()
}

export type QueueOutcome = { action: "ack" } | { action: "retry"; delaySeconds: number }

/**
 * Processes one Cloudflare Queue message: outgoing deliveries and queued
 * inbound activities. Messages in Fedify's old format are acknowledged and
 * dropped.
 */
export async function processQueueMessage(env: CloudflareEnv | undefined, body: unknown, options: { attempts?: number } = {}): Promise<QueueOutcome> {
  const attempts = Math.max(1, options.attempts ?? 1)
  if (!isQueueMessage(body)) {
    console.warn("Dropping ActivityPub queue message in an unsupported (legacy Fedify) format", {
      type: isObject(body) ? body.type : typeof body,
    })
    return { action: "ack" }
  }

  const ctx = await createFedifyContext(env)
  if (body.type === "deliver") {
    const result = await deliverActivity(ctx.loader, body.inbox, body.activity)
    if (result.ok) {
      return { action: "ack" }
    }
    if (result.permanent) {
      console.warn("Giving up ActivityPub delivery", body.inbox, result.status ?? result.error)
      return { action: "ack" }
    }
    console.warn("ActivityPub delivery failed; retrying", body.inbox, result.status ?? result.error)
    return { action: "retry", delaySeconds: retryDelaySeconds(attempts) }
  }

  const activityId = idOf(body.activity)
  if (await isActivityProcessed(ctx.kv, activityId)) {
    return { action: "ack" }
  }
  try {
    await processInboxActivity(ctx, body.activity)
    await markActivityProcessed(ctx.kv, activityId)
    return { action: "ack" }
  } catch (error) {
    console.error("ActivityPub inbox listener failed", error)
    return { action: "retry", delaySeconds: retryDelaySeconds(attempts) }
  }
}
