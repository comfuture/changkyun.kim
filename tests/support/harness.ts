// Shared test harness for the ActivityPub server code.
//
// - In-memory SQLite (better-sqlite3) exposed through the `useDatabase()` shim in
//   ./globals.mjs, seeded with the production Nuxt Content table layout.
// - A fake "fediverse": remote actor/object documents served from a mocked
//   `fetch`, with every POST to a remote inbox recorded.
// - Test-only RSA keys under tests/fixtures/keys (never used outside tests).
import { createHash, createSign } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire, syncBuiltinESMExports as syncBuiltins } from "node:module"
import { createApp, eventHandler, toWebHandler } from "h3"

const require = createRequire(import.meta.url)

export const SITE = "https://changkyun.kim"
export const ACTOR_ID = `${SITE}/@me`
export const PUBLIC = "https://www.w3.org/ns/activitystreams#Public"

const fixturesDir = new URL("../fixtures/", import.meta.url)

export function readFixture<T = any>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, fixturesDir), "utf8")) as T
}

export function readKey(name: string, kind: "private" | "public"): string {
  return readFileSync(new URL(`keys/${name}.${kind}.pem`, fixturesDir), "utf8")
}

export const LOCAL_KEYS = {
  privateKey: readKey("local", "private"),
  publicKey: readKey("local", "public"),
}

// Remote hosts in tests resolve to a public documentation address so DNS-based
// SSRF guards accept them without touching the network.
const dnsPromises = require("node:dns/promises")
dnsPromises.lookup = async (_hostname: string, options?: { all?: boolean }) => {
  const address = { address: "93.184.216.34", family: 4 }
  return options?.all ? [address] : address
}
syncBuiltins()

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export const sqlite = (globalThis as any).__testSqlite as import("better-sqlite3").Database

const contentDump = readFixture<{ blog: string[]; app: string[] }>("content/dump.sql.json")

function stripDumpComment(line: string): string {
  const hash = line.split(" -- ").pop() ?? ""
  return line.substring(0, line.length - hash.length - 4).trim()
}

let contentTablesReady = false

function ensureContentTables() {
  if (contentTablesReady) return
  for (const line of [...contentDump.blog, ...contentDump.app]) {
    if (line.startsWith("CREATE TABLE")) {
      sqlite.exec(stripDumpComment(line))
    }
  }
  contentTablesReady = true
}

export function seedProductionContent() {
  ensureContentTables()
  for (const line of [...contentDump.blog, ...contentDump.app]) {
    if (line.startsWith("INSERT")) {
      sqlite.exec(stripDumpComment(line))
    }
  }
}

export function insertBlogPost(input: {
  path: string
  title: string
  createdAt: string | null
  text?: string
  description?: string | null
  tags?: string[]
  draft?: boolean
  collection?: "blog" | "app"
}) {
  ensureContentTables()
  const table = input.collection === "app" ? "_content_app" : "_content_blog"
  const body = {
    type: "minimark",
    value: [["p", {}, input.text ?? `Body of ${input.title}`]],
    toc: { title: "", searchDepth: 2, depth: 2, links: [] },
  }
  sqlite.prepare(`INSERT INTO ${table} (id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags, __hash__)
    VALUES (?, ?, ?, NULL, ?, ?, 'md', ?, 'true', ?, '{}', ?, ?, ?)`).run(
    `${table}${input.path}.md`,
    input.title,
    JSON.stringify(body),
    input.createdAt,
    input.description ?? null,
    JSON.stringify(input.draft ? { draft: true } : {}),
    input.path,
    input.path.replace(/^\//, ""),
    JSON.stringify(input.tags ?? []),
    `hash-${input.path}`,
  )
}

const ACTIVITYPUB_TABLES = [
  "activity",
  "followers",
  "following",
  "actor",
  "content_delivery_state",
  "bluesky_shares",
  "activitypub_comments",
  "activitypub_reactions",
  "activitypub_feed_actors",
  "activitypub_feed_posts",
]

export async function resetDatabase(options: { content?: boolean } = {}) {
  ensureContentTables()
  sqlite.exec("DELETE FROM _content_blog; DELETE FROM _content_app;")
  const { ensureActivityPubSchema } = await import("../../server/utils/activityPubSchema.ts")
  await ensureActivityPubSchema()
  for (const table of ACTIVITYPUB_TABLES) {
    sqlite.exec(`DELETE FROM ${table}`)
  }
  sqlite.prepare("INSERT INTO actor (actor_id, private_key, public_key) VALUES (?, ?, ?)")
    .run(ACTOR_ID, LOCAL_KEYS.privateKey, LOCAL_KEYS.publicKey)
  if (options.content !== false) {
    seedProductionContent()
  }
  ;(globalThis as any).__contentQueryMode = undefined
}

export function rows<T = Record<string, any>>(query: string, ...params: unknown[]): T[] {
  return sqlite.prepare(query).all(...params) as T[]
}

// ---------------------------------------------------------------------------
// Fake fediverse
// ---------------------------------------------------------------------------

export type Delivery = {
  url: string
  method: string
  headers: Record<string, string>
  body: any
  rawBody: string
}

export type RemoteActorFixture = {
  id: string
  inbox: string
  sharedInbox?: string
  keyName: "alice" | "bob"
  document: Record<string, any>
}

function remoteActor(options: {
  id: string
  username: string
  name: string
  keyName: "alice" | "bob"
  sharedInbox?: string
}): RemoteActorFixture {
  const inbox = `${options.id}/inbox`
  const document: Record<string, any> = {
    "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
    id: options.id,
    type: "Person",
    preferredUsername: options.username,
    name: options.name,
    url: `${new URL(options.id).origin}/@${options.username}`,
    inbox,
    outbox: `${options.id}/outbox`,
    followers: `${options.id}/followers`,
    following: `${options.id}/following`,
    icon: { type: "Image", mediaType: "image/png", url: `${new URL(options.id).origin}/avatars/${options.username}.png` },
    publicKey: {
      id: `${options.id}#main-key`,
      owner: options.id,
      publicKeyPem: readKey(options.keyName, "public"),
    },
  }
  if (options.sharedInbox) {
    document.endpoints = { sharedInbox: options.sharedInbox }
  }
  return { id: options.id, inbox, sharedInbox: options.sharedInbox, keyName: options.keyName, document }
}

export const ALICE = remoteActor({
  id: "https://remote.example/users/alice",
  username: "alice",
  name: "Alice",
  keyName: "alice",
  sharedInbox: "https://remote.example/inbox",
})
export const CAROL = remoteActor({
  id: "https://remote.example/users/carol",
  username: "carol",
  name: "Carol",
  keyName: "alice",
  sharedInbox: "https://remote.example/inbox",
})
export const BOB = remoteActor({
  id: "https://other.example/users/bob",
  username: "bob",
  name: "Bob",
  keyName: "bob",
})

export class FakeFediverse {
  documents = new Map<string, { status?: number; body: unknown; contentType?: string }>()
  deliveries: Delivery[] = []
  inboxStatus = new Map<string, number>()
  /** Optional per-delivery status override (e.g. fail only Follow deliveries). */
  inboxFailure: ((delivery: Delivery) => number | undefined) | null = null
  /** When set, GET requests to the site origin are answered by the local app. */
  localApp: ((request: Request) => Promise<Response>) | null = null
  gets: string[] = []
  private originalFetch = globalThis.fetch

  constructor() {
    for (const actor of [ALICE, BOB, CAROL]) {
      this.addActor(actor)
    }
  }

  addActor(actor: RemoteActorFixture) {
    this.serve(actor.id, actor.document)
    const url = new URL(actor.id)
    const username = actor.document.preferredUsername
    this.serve(`${url.origin}/.well-known/webfinger?resource=acct:${username}@${url.host}`, {
      subject: `acct:${username}@${url.host}`,
      links: [{ rel: "self", type: "application/activity+json", href: actor.id }],
    }, "application/jrd+json")
    this.serve(`${url.origin}/.well-known/webfinger?resource=acct%3A${username}%40${url.host}`, {
      subject: `acct:${username}@${url.host}`,
      links: [{ rel: "self", type: "application/activity+json", href: actor.id }],
    }, "application/jrd+json")
  }

  serve(url: string, body: unknown, contentType = "application/activity+json", status = 200) {
    this.documents.set(url, { body, contentType, status })
  }

  install() {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request && !init ? input : new Request(input as any, init)
      // Fragments are never sent over the wire.
      const url = request.url.replace(/#.*$/, "")
      if (request.method === "POST") {
        const rawBody = await request.text()
        let body: any
        try {
          body = JSON.parse(rawBody)
        } catch {
          body = rawBody
        }
        const delivery = {
          url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body,
          rawBody,
        }
        this.deliveries.push(delivery)
        const status = this.inboxFailure?.(delivery) ?? this.inboxStatus.get(url) ?? 202
        return new Response(null, { status })
      }
      this.gets.push(url)
      if (this.localApp && new URL(url).origin === SITE) {
        return await this.localApp(new Request(url, { headers: request.headers }))
      }
      const document = this.documents.get(url)
      if (!document) {
        return new Response("Not Found", { status: 404 })
      }
      return new Response(
        typeof document.body === "string" ? document.body : JSON.stringify(document.body),
        { status: document.status ?? 200, headers: { "content-type": document.contentType ?? "application/activity+json" } },
      )
    }) as typeof fetch
    return this
  }

  restore() {
    globalThis.fetch = this.originalFetch
  }

  clear() {
    this.deliveries = []
    this.gets = []
    this.inboxStatus.clear()
    this.inboxFailure = null
  }
}

// ---------------------------------------------------------------------------
// Signing (independent draft-cavage implementation built on node:crypto)
// ---------------------------------------------------------------------------

export function signedInboxRequest(options: {
  url?: string
  body: unknown
  keyName: "alice" | "bob"
  keyId: string
  date?: Date
  digestOverride?: string
  bodyOverride?: string
}): Request {
  const url = new URL(options.url ?? `${SITE}/inbox`)
  const rawBody = typeof options.body === "string" ? options.body : JSON.stringify(options.body)
  const digest = options.digestOverride ?? `SHA-256=${createHash("sha256").update(rawBody).digest("base64")}`
  const date = (options.date ?? new Date()).toUTCString()
  const signingString = [
    `(request-target): post ${url.pathname}`,
    `host: ${url.host}`,
    `date: ${date}`,
    `digest: ${digest}`,
  ].join("\n")
  const signer = createSign("sha256")
  signer.update(signingString)
  const signature = signer.sign(readKey(options.keyName, "private"), "base64")
  return new Request(url, {
    method: "POST",
    headers: {
      host: url.host,
      date,
      digest,
      "content-type": "application/activity+json",
      signature: `keyId="${options.keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`,
    },
    body: options.bodyOverride ?? rawBody,
  })
}

// ---------------------------------------------------------------------------
// HTTP app (Nitro middleware mounted on a bare h3 app)
// ---------------------------------------------------------------------------

export const PAGE_FALLTHROUGH = "<!-- nuxt page -->"

export async function createTestApp(env: Record<string, unknown> = {}) {
  const middleware = (await import("../../server/middleware/fedify.ts")).default
  const app = createApp()
  app.use(eventHandler((event) => {
    ;(event.context as any).cloudflare = { env }
  }))
  app.use(middleware)
  app.use(eventHandler(() => PAGE_FALLTHROUGH))
  const handler = toWebHandler(app)
  return async (input: string | Request, init: RequestInit = {}) => {
    const request = typeof input === "string" ? new Request(new URL(input, SITE), init) : input
    return await handler(request)
  }
}

// ---------------------------------------------------------------------------
// Golden helpers
// ---------------------------------------------------------------------------

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const ISO_NOW = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g

/** Replaces random ids and "now" timestamps and drops LD signatures. */
export function normalizeDocument(value: unknown, options: { timestamps?: boolean } = {}): unknown {
  const text = JSON.stringify(value, (key, item) => (key === "signature" ? undefined : item))
  let normalized = text.replace(UUID, "<uuid>")
  if (options.timestamps) {
    normalized = normalized.replace(ISO_NOW, "<now>")
  }
  return JSON.parse(normalized)
}

export function deliveredTo(fediverse: FakeFediverse): string[] {
  return fediverse.deliveries.map((delivery) => delivery.url)
}

const goldenDir = new URL("../fixtures/golden/", import.meta.url)

/**
 * Compares `actual` with tests/fixtures/golden/<name>.json. Goldens were recorded
 * from the Fedify-based implementation (UPDATE_GOLDENS=1 rewrites them).
 */
export async function assertGolden(name: string, actual: unknown) {
  const { mkdirSync, writeFileSync, existsSync } = await import("node:fs")
  const { deepStrictEqual } = await import("node:assert/strict")
  const file = new URL(`${name}.json`, goldenDir)
  if (process.env.UPDATE_GOLDENS === "1" || !existsSync(file)) {
    if (process.env.UPDATE_GOLDENS !== "1") {
      throw new Error(`Missing golden ${name}.json (run with UPDATE_GOLDENS=1 to record it)`)
    }
    mkdirSync(new URL(".", file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`)
    return
  }
  deepStrictEqual(actual, JSON.parse(readFileSync(file, "utf8")))
}

export function withoutContext<T extends Record<string, any>>(document: T): Omit<T, "@context"> {
  const { "@context": _context, ...rest } = document
  return rest
}
