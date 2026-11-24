// Queue-backed delivery and inbox processing (FEDIFY_QUEUE / FEDIFY_KV bound).
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { before, beforeEach, describe, test } from "node:test"

import {
  ACTOR_ID,
  ALICE,
  BOB,
  CAROL,
  FakeFediverse,
  createTestApp,
  resetDatabase,
  rows,
  signedInboxRequest,
  sqlite,
} from "./support/harness.ts"

class FakeQueue {
  sent: any[] = []
  async send(body: unknown) {
    this.sent.push(JSON.parse(JSON.stringify(body)))
  }
  async sendBatch(messages: { body: unknown }[]) {
    for (const message of messages) {
      await this.send(message.body)
    }
  }
  take() {
    const sent = this.sent
    this.sent = []
    return sent
  }
}

class FakeKvNamespace {
  store = new Map<string, string>()
  puts: { key: string; ttl?: number }[] = []
  async get(key: string) {
    return this.store.get(key) ?? null
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this.puts.push({ key, ttl: options?.expirationTtl })
    this.store.set(key, value)
  }
  async delete(key: string) {
    this.store.delete(key)
  }
}

const fediverse = new FakeFediverse().install()
let queue: FakeQueue
let kv: FakeKvNamespace
let env: Record<string, unknown>
let app: Awaited<ReturnType<typeof createTestApp>>
let federation: typeof import("../server/utils/fedify.ts")

function follow(actor = ALICE) {
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actor.id}/activities/follow-${randomUUID()}`,
    type: "Follow",
    actor: actor.id,
    object: ACTOR_ID,
  }
}

before(async () => {
  federation = await import("../server/utils/fedify.ts")
})

beforeEach(async () => {
  fediverse.clear()
  await resetDatabase()
  queue = new FakeQueue()
  kv = new FakeKvNamespace()
  env = { FEDIFY_QUEUE: queue, FEDIFY_KV: kv }
  app = await createTestApp(env)
})

describe("queued inbox", () => {
  test("verified activities are enqueued, then processed by the consumer", async () => {
    const activity = follow()
    const response = await app(signedInboxRequest({ body: activity, keyName: "alice", keyId: `${ALICE.id}#main-key` }))
    assert.equal(response.status, 202)
    assert.equal(rows("SELECT * FROM followers").length, 0)

    const [message] = queue.take()
    assert.equal(message.v, 1)
    assert.equal(message.type, "inbox")
    assert.equal(message.activity.id, activity.id)
    assert.equal(message.keyId, `${ALICE.id}#main-key`)

    assert.deepEqual(await federation.processQueueMessage(env as any, message, { attempts: 1 }), { action: "ack" })
    assert.equal(rows("SELECT status FROM followers")[0].status, "accepted")
    // Nothing was sent inline: one delivery message per target inbox.
    assert.equal(fediverse.deliveries.length, 0)
    const deliveries = queue.take()
    assert.deepEqual(deliveries.map((item) => [item.type, item.inbox, item.activity.type]), [
      ["deliver", ALICE.sharedInbox, "Accept"],
      ["deliver", ALICE.sharedInbox, "Follow"],
      ["deliver", ALICE.sharedInbox, "Create"],
      ["deliver", ALICE.sharedInbox, "Create"],
      ["deliver", ALICE.sharedInbox, "Create"],
      ["deliver", ALICE.sharedInbox, "Update"],
    ])
    assert.ok(deliveries.every((item) => item.v === 1 && item.attempt === 0))

    for (const delivery of deliveries) {
      assert.deepEqual(await federation.processQueueMessage(env as any, delivery, { attempts: 1 }), { action: "ack" })
    }
    assert.deepEqual(fediverse.deliveries.map((delivery) => delivery.body.type), ["Accept", "Follow", "Create", "Create", "Create", "Update"])
    assert.ok(fediverse.deliveries.every((delivery) => delivery.headers.signature))

    // The same queued activity is not processed twice.
    assert.deepEqual(await federation.processQueueMessage(env as any, message, { attempts: 1 }), { action: "ack" })
    assert.equal(queue.take().length, 0)
    // A re-delivered request is acknowledged without enqueueing again.
    const again = await app(signedInboxRequest({ body: activity, keyName: "alice", keyId: `${ALICE.id}#main-key` }))
    assert.equal(again.status, 202)
    assert.equal(queue.take().length, 0)
  })

  test("listener failures are retried with backoff", async () => {
    const message = { v: 1, type: "inbox", activity: { ...follow(), actor: "https://broken.example/users/x" } }
    fediverse.serve("https://broken.example/users/x", "not json")
    const outcome = await federation.processQueueMessage(env as any, message, { attempts: 1 })
    // An unresolvable actor is not an error (the activity is dropped).
    assert.deepEqual(outcome, { action: "ack" })

    const failing = {
      v: 1,
      type: "inbox",
      activity: { id: `${ALICE.id}/likes/${randomUUID()}`, type: "Like", actor: ALICE.id, object: "https://changkyun.kim/blog/2025-09/20-test" },
    }
    sqlite.exec("ALTER TABLE activitypub_reactions RENAME TO activitypub_reactions_hidden")
    try {
      assert.deepEqual(await federation.processQueueMessage(env as any, failing, { attempts: 2 }), { action: "retry", delaySeconds: 240 })
    } finally {
      sqlite.exec("ALTER TABLE activitypub_reactions_hidden RENAME TO activitypub_reactions")
    }
    assert.deepEqual(await federation.processQueueMessage(env as any, failing, { attempts: 3 }), { action: "ack" })
    assert.equal(rows("SELECT reaction FROM activitypub_reactions")[0].reaction, "❤️")
  })
})

describe("queued delivery", () => {
  test("\"followers\" expands to one delivery per distinct inbox", async () => {
    for (const actor of [ALICE, CAROL, BOB]) {
      sqlite.prepare("INSERT INTO followers (actor_id, activity_id, status) VALUES (?, ?, 'accepted')").run(actor.id, `${actor.id}#f`)
    }
    const ctx = await federation.createFedifyContext(env as any)
    await ctx.sendActivity("followers", { "@context": "https://www.w3.org/ns/activitystreams", id: "https://changkyun.kim/x", type: "Create", actor: ACTOR_ID, object: "https://changkyun.kim/blog/2025-09/20-test", to: "as:Public" })
    const messages = queue.take()
    assert.deepEqual(messages.map((message) => message.inbox).sort(), [ALICE.sharedInbox, BOB.inbox].sort())
    assert.equal(messages[0].activity.to, "https://www.w3.org/ns/activitystreams#Public")
  })

  test("retryable failures back off, permanent failures are dropped", async () => {
    const activity = { id: "https://changkyun.kim/@me#like-1", type: "Like", actor: ACTOR_ID, object: "https://remote.example/notes/1" }
    fediverse.inboxStatus.set("https://remote.example/inbox", 503)
    const busy = { v: 1, type: "deliver", inbox: "https://remote.example/inbox", activity, attempt: 0 }
    assert.deepEqual(await federation.processQueueMessage(env as any, busy, { attempts: 1 }), { action: "retry", delaySeconds: 60 })
    assert.deepEqual(await federation.processQueueMessage(env as any, busy, { attempts: 3 }), { action: "retry", delaySeconds: 960 })

    fediverse.inboxStatus.set("https://remote.example/inbox", 410)
    assert.deepEqual(await federation.processQueueMessage(env as any, busy, { attempts: 1 }), { action: "ack" })
    fediverse.inboxStatus.set("https://remote.example/inbox", 404)
    assert.deepEqual(await federation.processQueueMessage(env as any, busy, { attempts: 1 }), { action: "ack" })
  })

  test("double-knock result is remembered under the new KV prefix", async () => {
    fediverse.inboxFailure = (delivery) => (delivery.headers["signature-input"] ? 202 : 401)
    const activity = { id: "https://changkyun.kim/@me#like-2", type: "Like", actor: ACTOR_ID, object: "https://remote.example/notes/1" }
    const message = { v: 1, type: "deliver", inbox: "https://remote.example/inbox", activity }
    assert.deepEqual(await federation.processQueueMessage(env as any, message, { attempts: 1 }), { action: "ack" })
    assert.equal(kv.store.get("ap:v1:spec:https://remote.example"), "rfc9421")
    assert.ok(Array.from(kv.store.keys()).every((key) => key.startsWith("ap:v1:")))
  })

  test("legacy Fedify-format messages are acknowledged and dropped", async () => {
    for (const legacy of [
      { type: "outbox", id: randomUUID(), baseUrl: "https://changkyun.kim", keys: [], activity: {}, activityType: "https://www.w3.org/ns/activitystreams#Create", inbox: "https://remote.example/inbox", sharedInbox: true, started: "2026-11-01T00:00:00Z", attempt: 0, headers: {} },
      { type: "inbox", id: randomUUID(), baseUrl: "https://changkyun.kim", activity: {}, started: "2026-11-01T00:00:00Z", attempt: 0, identifier: null },
      { type: "fanout", id: randomUUID(), baseUrl: "https://changkyun.kim", keys: [], inboxes: {}, activity: {}, activityType: "Create" },
      "garbage",
      null,
    ]) {
      assert.deepEqual(await federation.processQueueMessage(env as any, legacy), { action: "ack" })
    }
    assert.equal(fediverse.deliveries.length, 0)
  })

  test("queue consumer hook acks, retries with delay, and never throws", async () => {
    const plugin = (await import("../server/plugins/fedify-cloudflare.ts")).default as any
    const hooks: Record<string, (payload: any) => Promise<void>> = {}
    plugin({ hooks: { hook: (name: string, handler: any) => { hooks[name] = handler } } })

    fediverse.inboxStatus.set("https://remote.example/inbox", 503)
    const calls: string[] = []
    const message = (body: unknown, attempts = 1) => ({
      body,
      attempts,
      ack: () => calls.push("ack"),
      retry: (options?: { delaySeconds?: number }) => calls.push(`retry:${options?.delaySeconds ?? "-"}`),
    })
    await hooks["cloudflare:queue"]({
      env,
      batch: {
        messages: [
          message({ type: "outbox", id: "legacy" }),
          message({ v: 1, type: "deliver", inbox: "https://remote.example/inbox", activity: { id: "a", type: "Like" } }, 2),
        ],
      },
    })
    assert.deepEqual(calls, ["ack", "retry:240"])
  })
})
