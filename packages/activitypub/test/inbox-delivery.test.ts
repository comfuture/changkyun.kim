import assert from "node:assert/strict"
import { before, beforeEach, describe, test } from "node:test"

import {
  CAVAGE,
  MemoryKvStore,
  RFC9421,
  deliverActivity,
  deliveryMessages,
  handleInbox,
  isQueueMessage,
  markActivityProcessed,
  resolveInboxes,
  retryDelaySeconds,
  signRequest,
  type JsonObject,
  type SigningKey,
} from "../src/index.ts"
import { FakeNetwork, actorDocument, createLoader, generateTestKeyPair, signingKey, type TestKeyPair } from "./helpers.ts"

const ALICE = "https://remote.example/users/alice"
const BOB = "https://other.example/users/bob"

let alicePair: TestKeyPair
let bobPair: TestKeyPair
let aliceKey: SigningKey
let bobKey: SigningKey
let network: FakeNetwork
let kv: MemoryKvStore
let dispatched: JsonObject[]

before(async () => {
  alicePair = generateTestKeyPair()
  bobPair = generateTestKeyPair()
  aliceKey = await signingKey(`${ALICE}#main-key`, alicePair)
  bobKey = await signingKey(`${BOB}#main-key`, bobPair)
})

beforeEach(() => {
  network = new FakeNetwork()
  network.json(ALICE, actorDocument(ALICE, alicePair))
  network.json(BOB, actorDocument(BOB, bobPair))
  kv = new MemoryKvStore()
  dispatched = []
})

async function deliver(activity: JsonObject | string, key: SigningKey = aliceKey, spec = CAVAGE, url = "https://changkyun.kim/inbox") {
  const body = typeof activity === "string" ? activity : JSON.stringify(activity)
  const request = await signRequest(new Request(url, { method: "POST", headers: { "content-type": "application/activity+json" }, body }), key, { spec })
  return await handleInbox(request, {
    loader: createLoader(network),
    kv,
    dispatch: async (item) => {
      dispatched.push(item)
    },
  })
}

describe("inbox pipeline", () => {
  test("accepts verified activities (both specs)", async () => {
    const follow = { id: `${ALICE}/follows/1`, type: "Follow", actor: ALICE, object: "https://changkyun.kim/@me" }
    assert.equal((await deliver(follow)).status, 202)
    assert.equal((await deliver({ ...follow, id: `${ALICE}/follows/2` }, aliceKey, RFC9421)).status, 202)
    assert.deepEqual(dispatched.map((item) => item.id), [`${ALICE}/follows/1`, `${ALICE}/follows/2`])
  })

  test("malformed bodies are 400", async () => {
    assert.equal((await deliver("{nope")).status, 400)
    assert.equal((await deliver({ id: "x" })).status, 400)
    assert.equal((await deliver({ id: "x", type: "Follow" })).status, 400)
    assert.equal(dispatched.length, 0)
  })

  test("unverifiable requests are 401", async () => {
    const follow = { id: `${ALICE}/follows/3`, type: "Follow", actor: ALICE, object: "https://changkyun.kim/@me" }
    const unsigned = await handleInbox(new Request("https://changkyun.kim/inbox", { method: "POST", body: JSON.stringify(follow) }), {
      loader: createLoader(network),
      kv,
      dispatch: async () => undefined,
    })
    assert.equal(unsigned.status, 401)
    // Signed by Bob's key but claiming Alice as the actor.
    assert.equal((await deliver(follow, bobKey)).status, 401)
    // A key on another origin that merely claims Alice as its owner.
    const forgedKeyId = "https://other.example/keys/forged"
    network.json(forgedKeyId, { id: forgedKeyId, owner: ALICE, publicKeyPem: bobPair.publicKeyPem })
    assert.equal((await deliver(follow, await signingKey(forgedKeyId, bobPair))).status, 401)
    // An actor document whose embedded key claims Alice as its owner.
    network.json(BOB, actorDocument(BOB, bobPair, { publicKey: { id: `${BOB}#main-key`, owner: ALICE, publicKeyPem: bobPair.publicKeyPem } }))
    assert.equal((await deliver(follow, bobKey)).status, 401)
    // Key document unreachable.
    network.routes.delete(ALICE)
    assert.equal((await deliver(follow)).status, 401)
    assert.equal(dispatched.length, 0)
  })

  test("duplicate activity ids are processed once", async () => {
    const like = { id: `${ALICE}/likes/1`, type: "Like", actor: ALICE, object: "https://changkyun.kim/blog/x" }
    await markActivityProcessed(kv, like.id)
    const response = await deliver(like)
    assert.equal(response.status, 202)
    assert.match(await response.text(), /already been processed/)
    assert.equal(dispatched.length, 0)
  })

  test("Delete from an actor whose key is gone is acknowledged and dropped", async () => {
    network.json("https://gone.example/users/ghost", { error: "gone" }, 410)
    const ghostKey = await signingKey("https://gone.example/users/ghost#main-key", bobPair)
    const del = { id: "https://gone.example/users/ghost#delete", type: "Delete", actor: "https://gone.example/users/ghost", object: "https://gone.example/users/ghost" }
    assert.equal((await deliver(del, ghostKey)).status, 202)
    assert.equal((await deliver({ ...del, type: "Update" }, ghostKey)).status, 401)
    assert.equal(dispatched.length, 0)
  })

  test("unknown recipient is 404 and dispatch failures are 500", async () => {
    const request = await signRequest(new Request("https://changkyun.kim/@nobody/inbox", { method: "POST", body: "{}" }), aliceKey)
    const notFound = await handleInbox(request, { loader: createLoader(network), kv, dispatch: async () => undefined, recipientExists: () => false })
    assert.equal(notFound.status, 404)

    const failing = await signRequest(new Request("https://changkyun.kim/inbox", {
      method: "POST",
      body: JSON.stringify({ id: `${ALICE}/x`, type: "Like", actor: ALICE, object: "y" }),
    }), aliceKey)
    const errors: unknown[] = []
    const response = await handleInbox(failing, {
      loader: createLoader(network),
      kv,
      dispatch: async () => {
        throw new Error("boom")
      },
      onError: (error) => errors.push(error),
    })
    assert.equal(response.status, 500)
    assert.equal(errors.length, 1)
  })
})

describe("delivery", () => {
  const actors: JsonObject[] = [
    { id: ALICE, type: "Person", inbox: `${ALICE}/inbox`, endpoints: { sharedInbox: "https://remote.example/inbox" } },
    { id: "https://remote.example/users/carol", type: "Person", inbox: "https://remote.example/users/carol/inbox", endpoints: { sharedInbox: "https://remote.example/inbox" } },
    { id: BOB, type: "Person", inbox: `${BOB}/inbox` },
    { id: "https://changkyun.kim/@me", type: "Person", inbox: "https://changkyun.kim/@me/inbox" },
    { id: "https://broken.example/u", type: "Person" },
  ]

  test("prefers shared inboxes, dedupes and excludes the local origin", () => {
    assert.deepEqual(resolveInboxes(actors, { excludeOrigins: ["https://changkyun.kim"] }), [
      "https://remote.example/inbox",
      `${BOB}/inbox`,
    ])
    assert.deepEqual(resolveInboxes(actors, { preferSharedInbox: false, excludeOrigins: ["https://changkyun.kim"] }), [
      `${ALICE}/inbox`,
      "https://remote.example/users/carol/inbox",
      `${BOB}/inbox`,
    ])
  })

  test("queue message shapes and legacy detection", () => {
    const activity = { id: "a", type: "Create" }
    const messages = deliveryMessages(activity, ["https://remote.example/inbox", `${BOB}/inbox`])
    assert.deepEqual(messages[0], { v: 1, type: "deliver", inbox: "https://remote.example/inbox", activity, attempt: 0 })
    assert.equal(messages.every(isQueueMessage), true)
    assert.equal(isQueueMessage({ v: 1, type: "inbox", activity }), true)
    // Fedify's own queue messages carry no `v` field.
    assert.equal(isQueueMessage({ type: "outbox", id: "x", baseUrl: "https://changkyun.kim", activity }), false)
    assert.equal(isQueueMessage({ type: "inbox", id: "x", activity, started: "2026-01-01T00:00:00Z" }), false)
    assert.equal(isQueueMessage("nope"), false)
  })

  test("classifies results", async () => {
    network.route("https://ok.example/inbox", () => new Response(null, { status: 202 }))
    network.route("https://gone.example/inbox", () => new Response(null, { status: 410 }))
    network.route("https://busy.example/inbox", () => new Response(null, { status: 503 }))
    const loader = createLoader(network, { signer: aliceKey })
    const activity = { id: "a", type: "Create" }
    assert.deepEqual(await deliverActivity(loader, "https://ok.example/inbox", activity), { ok: true, status: 202, permanent: false })
    assert.equal((await deliverActivity(loader, "https://gone.example/inbox", activity)).permanent, true)
    assert.equal((await deliverActivity(loader, "https://missing.example/inbox", activity)).permanent, true)
    const busy = await deliverActivity(loader, "https://busy.example/inbox", activity)
    assert.deepEqual({ ok: busy.ok, permanent: busy.permanent, status: busy.status }, { ok: false, permanent: false, status: 503 })
    assert.equal((await deliverActivity(loader, "http://127.0.0.1/inbox", activity)).permanent, true)

    const posted = network.requests.find((request) => request.url === "https://ok.example/inbox")!
    assert.equal(posted.headers.get("content-type"), "application/activity+json")
    assert.equal(posted.body, JSON.stringify(activity))
    assert.ok(posted.headers.get("digest"))
  })

  test("exponential backoff", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 10].map(retryDelaySeconds), [60, 240, 960, 3840, 15360, 43200, 43200])
  })
})
