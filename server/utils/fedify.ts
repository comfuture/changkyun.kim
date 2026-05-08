import {
  createFederationBuilder,
  MemoryKvStore,
  type NodeInfo,
  type Federation,
  type KvStore,
  type Message,
} from "@fedify/fedify"
import { WorkersKvStore, WorkersMessageQueue } from "@fedify/cfworkers"
import {
  Accept,
  Activity,
  Article,
  CryptographicKey,
  Create,
  Delete,
  Endpoints,
  Follow,
  Image,
  isActor,
  Person,
  PUBLIC_COLLECTION,
  Undo,
  Update,
  type Actor,
} from "@fedify/vocab"
import {
  ACTOR_IDENTIFIER,
  collectCreateActivities,
  buildArticleFromEntry,
  buildCreateFromEntry,
  FEDIFY_OUTBOX_PAGE_SIZE,
  fetchFedifyContentEntry,
  SITE_ORIGIN,
} from "./fedifyContent"
import packageJson from "../../package.json"
import {
  markCommentDeletedFromDelete,
  persistCommentFromCreate,
} from "./fedifyComments"
import { ensureActivityPubSchema } from "./activityPubSchema"

type CloudflareEnv = {
  FEDIFY_KV?: any
  FEDIFY_QUEUE?: any
}

export type FedifyContextData = {
  env?: CloudflareEnv
}

export type ActivityPubFollowInput = {
  actorId?: string
  resource?: string
}

export type ActivityPubFollowResult = {
  result: true
  actorId: string
  status: "accepted" | "requested"
  sent: boolean
}

export class ActivityPubFollowError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = "ActivityPubFollowError"
    this.statusCode = statusCode
  }
}

const ACTOR_PATH = `/@${ACTOR_IDENTIFIER}`
const ACTOR_URI = new URL(ACTOR_PATH, SITE_ORIGIN)
const SHARED_INBOX_URI = new URL("/inbox", SITE_ORIGIN)
const memoryKv = new MemoryKvStore()

function importPemKey(pem: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const isPublicKey = pem.includes("-----BEGIN PUBLIC KEY-----")
  const isPrivateKey = pem.includes("-----BEGIN PRIVATE KEY-----")
  if (!isPublicKey && !isPrivateKey) {
    throw new Error("Unsupported PEM key format.")
  }

  const header = isPublicKey ? "-----BEGIN PUBLIC KEY-----" : "-----BEGIN PRIVATE KEY-----"
  const footer = isPublicKey ? "-----END PUBLIC KEY-----" : "-----END PRIVATE KEY-----"
  const format = isPublicKey ? "spki" : "pkcs8"
  const binaryDer = Buffer.from(
    pem.replace(header, "").replace(footer, "").replace(/\s/g, ""),
    "base64",
  )

  return crypto.subtle.importKey(
    format,
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    isPublicKey,
    usage,
  )
}

function getDatabase() {
  return useDatabase()
}

export function getCloudflareEnv(event?: any): CloudflareEnv | undefined {
  return event?.context?.cloudflare?.env
    ?? event?.context?._platform?.cloudflare?.env
    ?? (globalThis as any).__env__
}

function makeKv(env?: CloudflareEnv): KvStore {
  return env?.FEDIFY_KV ? new WorkersKvStore(env.FEDIFY_KV) : memoryKv
}

function makeQueue(env?: CloudflareEnv) {
  if (!env?.FEDIFY_QUEUE) {
    return undefined
  }
  return new WorkersMessageQueue(env.FEDIFY_QUEUE, env.FEDIFY_KV ? { orderingKv: env.FEDIFY_KV } : undefined)
}

async function getActorKeyPair(): Promise<CryptoKeyPair | null> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT private_key, public_key FROM actor WHERE actor_id = ${ACTOR_URI.href} LIMIT 1`
  const row = rows?.[0] as { private_key?: string | null; public_key?: string | null } | undefined
  if (!row?.private_key || !row?.public_key) {
    return null
  }
  return {
    privateKey: await importPemKey(row.private_key, ["sign"]),
    publicKey: await importPemKey(row.public_key, ["verify"]),
  }
}

async function countRows(table: "followers" | "following", status = "accepted"): Promise<number> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = table === "followers"
    ? await db.sql`SELECT COUNT(*) AS count FROM followers WHERE status = ${status}`
    : await db.sql`SELECT COUNT(*) AS count FROM following WHERE status = ${status}`
  const raw = (rows?.[0] as Record<string, unknown> | undefined)?.count
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
    const { totalItems } = await collectCreateActivities({ limit: null })
    return totalItems
  } catch (error) {
    console.error("Failed to count ActivityPub local posts from content", error)
  }

  try {
    await ensureActivityPubSchema()
    const db = getDatabase()
    const { rows } = await db.sql`SELECT COUNT(*) AS count FROM activity WHERE direction = 'outbox' AND type = 'Create'`
    return countValue((rows?.[0] as Record<string, unknown> | undefined)?.count)
  } catch (error) {
    console.error("Failed to count ActivityPub local posts from outbox", error)
    return 0
  }
}

async function countLocalComments(): Promise<number> {
  try {
    await ensureActivityPubSchema()
    const db = getDatabase()
    const { rows } = await db.sql`SELECT COUNT(*) AS count FROM activitypub_comments WHERE status = 'visible'`
    return countValue((rows?.[0] as Record<string, unknown> | undefined)?.count)
  } catch (error) {
    console.error("Failed to count ActivityPub comments for NodeInfo", error)
    return 0
  }
}

async function buildNodeInfo(): Promise<NodeInfo> {
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

async function activityToPayload(activity: Activity): Promise<string> {
  return JSON.stringify(await activity.toJsonLd({ format: "compact" }))
}

function assertRemoteActorUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ActivityPubFollowError(400, "actorId must be a valid URL.")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ActivityPubFollowError(400, "actorId must use http or https.")
  }
  return url
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

async function recordFollowingRequested(actorId: string, follow: Follow): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = await activityToPayload(follow)
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

async function recordFollower(actor: Actor, follow: Follow): Promise<boolean> {
  const actorId = actor.id?.href
  if (!actorId) {
    return false
  }

  await ensureActivityPubSchema()
  const db = getDatabase()
  const existing = await db.sql`SELECT status FROM followers WHERE actor_id = ${actorId} LIMIT 1`
  const wasAccepted = (existing.rows?.[0] as { status?: string } | undefined)?.status === "accepted"
  const payload = await activityToPayload(follow)
  const activityId = follow.id?.href ?? `${ACTOR_URI.href}/follow/${crypto.randomUUID()}`

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

async function recordFollowingAccepted(actorId: string, follow: Follow): Promise<void> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const payload = await activityToPayload(follow)
  const activityId = follow.id?.href ?? `${ACTOR_URI.href}/follow/${crypto.randomUUID()}`

  await db.sql`INSERT INTO following (actor_id, activity_id, activity_payload, status)
    VALUES (${actorId}, ${activityId}, ${payload}, 'accepted')
    ON CONFLICT(actor_id) DO UPDATE SET
      activity_id = excluded.activity_id,
      activity_payload = excluded.activity_payload,
      status = 'accepted',
      updated_at = CURRENT_TIMESTAMP`
}

async function loadFollowers(): Promise<URL[]> {
  await ensureActivityPubSchema()
  const db = getDatabase()
  const { rows } = await db.sql`SELECT actor_id FROM followers WHERE status = 'accepted' ORDER BY updated_at DESC`
  return (rows ?? [])
    .map((row) => (row as { actor_id?: string | null }).actor_id)
    .filter((actorId): actorId is string => Boolean(actorId))
    .map((actorId) => new URL(actorId))
}

async function sendFollowersUpdate(ctx: { sendActivity: any }): Promise<void> {
  const actor = await buildActor(ctx as any, ACTOR_IDENTIFIER)
  if (!actor) {
    return
  }

  await ctx.sendActivity(
    { identifier: ACTOR_IDENTIFIER },
    "followers",
    new Update({
      id: new URL(`#update-${crypto.randomUUID()}`, ACTOR_URI),
      actor: ACTOR_URI,
      object: actor,
      to: PUBLIC_COLLECTION,
      cc: new URL("/@me/followers", SITE_ORIGIN),
    }),
    { preferSharedInbox: true },
  )
}

async function buildActor(ctx: { getActorUri(identifier: string): URL; getInboxUri(identifier?: string): URL; getOutboxUri(identifier: string): URL; getFollowersUri(identifier: string): URL; getFollowingUri(identifier: string): URL; getActorKeyPairs(identifier: string): Promise<CryptoKeyPair[]> }, identifier: string) {
  if (identifier !== ACTOR_IDENTIFIER) {
    return null
  }

  const keys = await ctx.getActorKeyPairs(identifier)
  const actorUri = ctx.getActorUri(identifier)
  const publicKey = keys[0]?.publicKey

  return new Person({
    id: actorUri,
    preferredUsername: ACTOR_IDENTIFIER,
    names: ["Changkyun Kim", "김창균", "金昌均"],
    summary: "Principled person who values integrity. A slow but persistent learner with deep understanding. Problem solver using data, experience, and intuition.",
    url: new URL("/about", SITE_ORIGIN),
    icon: new Image({
      mediaType: "image/jpeg",
      url: new URL("/image/avatar.jpg", SITE_ORIGIN),
    }),
    image: new Image({
      mediaType: "image/jpeg",
      url: new URL("/cdn-cgi/image/fit=crop,w=1280,h=400/image/cover.jpg", SITE_ORIGIN),
    }),
    inbox: ctx.getInboxUri(identifier),
    outbox: ctx.getOutboxUri(identifier),
    followers: ctx.getFollowersUri(identifier),
    following: ctx.getFollowingUri(identifier),
    endpoints: new Endpoints({
      sharedInbox: SHARED_INBOX_URI,
    }),
    publicKey: publicKey
      ? new CryptographicKey({
        id: new URL("#main-key", actorUri),
        owner: actorUri,
        publicKey,
      })
      : null,
    discoverable: true,
    indexable: true,
  })
}

const builder = createFederationBuilder<FedifyContextData>()

builder
  .setNodeInfoDispatcher("/nodeinfo/2.1", async () => await buildNodeInfo())

builder
  .setActorDispatcher("/@{identifier}", buildActor)
  .setKeyPairsDispatcher(async (_ctx, identifier) => {
    if (identifier !== ACTOR_IDENTIFIER) {
      return []
    }
    const keyPair = await getActorKeyPair()
    return keyPair ? [keyPair] : []
  })
  .mapHandle(async (_ctx, username) => username === ACTOR_IDENTIFIER ? ACTOR_IDENTIFIER : null)
  .mapAlias(async (_ctx, resource) => {
    const value = resource.href
    if (
      value === ACTOR_URI.href ||
      value === `acct:${ACTOR_IDENTIFIER}@${new URL(SITE_ORIGIN).host}` ||
      value === `acct:${ACTOR_IDENTIFIER}@changkyun.kim` ||
      value === `acct:changkyun.kim@changkyun.kim`
    ) {
      return { identifier: ACTOR_IDENTIFIER }
    }
    return null
  })

builder.setObjectDispatcher(Create, "/{collection}/{+path}/activity", async (_ctx, values) => {
  const collection = values.collection === "blog" || values.collection === "app" ? values.collection : null
  if (!collection) {
    return null
  }
  const entry = await fetchFedifyContentEntry(collection, `/${collection}/${values.path}`)
  return entry ? await buildCreateFromEntry(entry) : null
})

builder.setObjectDispatcher(Article, "/{collection}/{+path}", async (_ctx, values) => {
  const collection = values.collection === "blog" || values.collection === "app" ? values.collection : null
  if (!collection) {
    return null
  }
  const entry = await fetchFedifyContentEntry(collection, `/${collection}/${values.path}`)
  return entry ? await buildArticleFromEntry(entry) : null
})

builder
  .setOutboxDispatcher("/@{identifier}/outbox", async (_ctx, identifier, cursor) => {
    if (identifier !== ACTOR_IDENTIFIER) {
      return null
    }
    const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0
    const { totalItems, items } = await collectCreateActivities({ limit: FEDIFY_OUTBOX_PAGE_SIZE, offset })
    const nextOffset = offset + items.length
    return {
      items,
      nextCursor: nextOffset < totalItems ? String(nextOffset) : null,
    }
  })
  .setCounter(async () => {
    const { totalItems } = await collectCreateActivities({ limit: null })
    return totalItems
  })
  .setFirstCursor(async () => "0")

builder
  .setFollowersDispatcher("/@{identifier}/followers", async (_ctx, identifier) => {
    if (identifier !== ACTOR_IDENTIFIER) {
      return null
    }
    return { items: await loadFollowers() }
  })
  .setCounter(async () => await countRows("followers"))

builder
  .setFollowingDispatcher("/@{identifier}/following", async (_ctx, identifier) => {
    if (identifier !== ACTOR_IDENTIFIER) {
      return null
    }
    await ensureActivityPubSchema()
    const db = getDatabase()
    const { rows } = await db.sql`SELECT actor_id FROM following WHERE status IN ('accepted', 'requested') ORDER BY updated_at DESC`
    return {
      items: (rows ?? [])
        .map((row) => (row as { actor_id?: string | null }).actor_id)
        .filter((actorId): actorId is string => Boolean(actorId))
        .map((actorId) => new URL(actorId)),
    }
  })
  .setCounter(async () => await countRows("following"))

builder
  .setInboxListeners("/@{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    const actor = await follow.getActor(ctx)
    if (!isActor(actor) || !actor.id) {
      return
    }
    if (follow.objectId?.href !== ACTOR_URI.href && follow.objectId?.href !== new URL("/@me/followers", SITE_ORIGIN).href) {
      return
    }

    const isNewFollower = await recordFollower(actor, follow)
    const accept = new Accept({
      id: new URL(`#accept-${crypto.randomUUID()}`, ACTOR_URI),
      actor: ACTOR_URI,
      object: follow,
      to: actor.id,
    })

    await ctx.sendActivity({ identifier: ACTOR_IDENTIFIER }, actor, accept, { preferSharedInbox: true })

    const { items } = await collectCreateActivities({ limit: FEDIFY_OUTBOX_PAGE_SIZE })
    for (const activity of items.slice().reverse()) {
      await ctx.sendActivity({ identifier: ACTOR_IDENTIFIER }, actor, activity, { preferSharedInbox: true })
    }

    if (isNewFollower) {
      await sendFollowersUpdate(ctx)
    }
  })
  .on(Undo, async (ctx, undo) => {
    const actor = await undo.getActor(ctx)
    if (!isActor(actor) || !actor.id) {
      return
    }

    const object = await undo.getObject({
      documentLoader: ctx.documentLoader,
      contextLoader: ctx.contextLoader,
      suppressError: true,
    })
    if (object instanceof Follow) {
      const followActorId = object.actorIds[0]?.href
      const followTarget = object.objectId?.href
      if (followActorId && followActorId !== actor.id.href) {
        return
      }
      if (followTarget && followTarget !== ACTOR_URI.href && followTarget !== new URL("/@me/followers", SITE_ORIGIN).href) {
        return
      }
      const removed = await removeFollower(actor.id.href, object.id?.href ?? null)
      if (removed) {
        await sendFollowersUpdate(ctx)
      }
      return
    }

    const removed = await removeFollower(actor.id.href, undo.objectId?.href ?? null)
    if (removed) {
      await sendFollowersUpdate(ctx)
    }
  })
  .on(Accept, async (ctx, accept) => {
    const actor = await accept.getActor(ctx)
    if (!isActor(actor) || !actor.id) {
      return
    }
    const object = await accept.getObject({
      documentLoader: ctx.documentLoader,
      contextLoader: ctx.contextLoader,
      suppressError: true,
    })
    if (object instanceof Follow && object.actorIds.some((id) => id.href === ACTOR_URI.href)) {
      await recordFollowingAccepted(actor.id.href, object)
    }
  })
  .on(Create, async (ctx, create) => {
    await persistCommentFromCreate(ctx, create)
  })
  .on(Delete, async (ctx, del) => {
    await markCommentDeletedFromDelete(ctx, del)
  })
  .on(Activity, async () => {
    // Verified but unsupported activities are intentionally accepted.
  })
  .onError((_ctx, error) => {
    console.error("Fedify inbox listener failed", error)
  })
  .withIdempotency("global")

export async function createFedify(env?: CloudflareEnv): Promise<Federation<FedifyContextData>> {
  const queue = makeQueue(env)
  return await builder.build({
    kv: makeKv(env),
    queue,
    manuallyStartQueue: Boolean(queue),
    origin: SITE_ORIGIN,
    trailingSlashInsensitive: true,
    firstKnock: "draft-cavage-http-signatures-12",
    userAgent: {
      software: "changkyun.kim/2.0",
      url: SITE_ORIGIN,
    },
  })
}

export async function createFedifyContext(env?: CloudflareEnv) {
  const federation = await createFedify(env)
  return federation.createContext(new URL(SITE_ORIGIN), { env })
}

export async function followRemoteActor(input: ActivityPubFollowInput, env?: CloudflareEnv): Promise<ActivityPubFollowResult> {
  const actorIdInput = typeof input.actorId === "string" ? input.actorId.trim() : ""
  const resourceInput = typeof input.resource === "string" ? input.resource.trim() : ""
  if (!actorIdInput && !resourceInput) {
    throw new ActivityPubFollowError(400, "Either resource or actorId is required.")
  }

  const ctx = await createFedifyContext(env)
  const lookupTarget = actorIdInput ? assertRemoteActorUrl(actorIdInput) : resourceInput
  const object = await ctx.lookupObject(lookupTarget).catch(() => null)
  if (!isActor(object) || !object.id) {
    throw new ActivityPubFollowError(422, "The target did not resolve to an ActivityPub actor.")
  }
  if (!object.inboxId) {
    throw new ActivityPubFollowError(422, "The resolved actor does not advertise an inbox.")
  }
  if (object.id.href === ACTOR_URI.href) {
    throw new ActivityPubFollowError(400, "Cannot follow the local actor.")
  }

  const existingStatus = await getFollowingStatus(object.id.href)
  if (existingStatus) {
    return {
      result: true,
      actorId: object.id.href,
      status: existingStatus,
      sent: false,
    }
  }

  const followId = await followActivityUri(object.id.href)
  const follow = new Follow({
    id: followId,
    actor: ACTOR_URI,
    object: object.id,
    to: object.id,
  })

  await recordFollowingRequested(object.id.href, follow)
  try {
    await ctx.sendActivity(
      { identifier: ACTOR_IDENTIFIER },
      object,
      follow,
      { preferSharedInbox: true },
    )
  } catch (error) {
    await removeFollowingRequest(object.id.href, followId.href)
    throw error
  }

  return {
    result: true,
    actorId: object.id.href,
    status: "requested",
    sent: true,
  }
}

export async function processFedifyQueueMessage(env: CloudflareEnv | undefined, body: unknown): Promise<void> {
  const queue = makeQueue(env)
  const federation = await createFedify(env)
  if (!queue) {
    await federation.processQueuedTask({ env }, body as Message)
    return
  }
  const result = await queue.processMessage(body)
  if (!result.shouldProcess) {
    throw new Error("Fedify queue message is waiting on an ordering lock.")
  }
  try {
    await federation.processQueuedTask({ env }, result.message as Message)
  } finally {
    await result.release?.()
  }
}
