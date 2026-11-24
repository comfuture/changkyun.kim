import assert from "node:assert/strict"
import { before, describe, test } from "node:test"

import {
  CAVAGE,
  FetchError,
  MemoryKvStore,
  RFC9421,
  assertPublicUrl,
  lookupObject,
  parseHandle,
  traverseCollection,
  verifyRequest,
  webfinger,
  importPublicKeyPem,
  type JsonObject,
  type SigningKey,
} from "../src/index.ts"
import { FakeNetwork, actorDocument, createLoader, generateTestKeyPair, signingKey, type TestKeyPair } from "./helpers.ts"

const LOCAL_KEY_ID = "https://changkyun.kim/@me#main-key"
let localPair: TestKeyPair
let remotePair: TestKeyPair
let localKey: SigningKey

before(async () => {
  localPair = generateTestKeyPair()
  remotePair = generateTestKeyPair()
  localKey = await signingKey(LOCAL_KEY_ID, localPair)
})

async function collect(iterable: AsyncIterable<JsonObject>) {
  const items: JsonObject[] = []
  for await (const item of iterable) {
    items.push(item)
  }
  return items
}

describe("URL guard", () => {
  test("rejects non-http(s), localhost and private IP literals", () => {
    for (const url of [
      "ftp://example.com/x",
      "file:///etc/passwd",
      "http://localhost/x",
      "http://app.localhost/x",
      "http://127.0.0.1/x",
      "http://10.1.2.3/x",
      "http://172.20.0.1/x",
      "http://192.168.1.1/x",
      "http://169.254.169.254/latest",
      "http://[::1]/x",
      "http://[fd00::1]/x",
      "http://[fe80::1]/x",
      "http://[::ffff:127.0.0.1]/x",
      "https://user:pass@example.com/x",
    ]) {
      assert.throws(() => assertPublicUrl(url), FetchError, url)
    }
    assert.equal(assertPublicUrl("https://remote.example/users/a").host, "remote.example")
    assert.equal(assertPublicUrl("http://93.184.216.34/x").hostname, "93.184.216.34")
  })
})

describe("document loader", () => {
  test("signed GET with Accept and User-Agent, cached when asked", async () => {
    const network = new FakeNetwork()
    network.json("https://remote.example/users/alice", actorDocument("https://remote.example/users/alice", remotePair))
    const loader = createLoader(network, { signer: localKey })
    const actor = await loader.loadActor("https://remote.example/users/alice")
    assert.equal(actor?.id, "https://remote.example/users/alice")
    const request = network.requests[0]!
    assert.equal(request.headers.get("accept"), "application/activity+json, application/ld+json")
    assert.equal(request.headers.get("user-agent"), "test-agent/1.0")
    assert.match(request.headers.get("signature") ?? "", /keyId="https:\/\/changkyun\.kim\/@me#main-key"/)
    const verified = await verifyRequest(new Request(request.url, { headers: request.headers }), {
      resolveKey: async (keyId) => ({ keyId, ownerId: null, publicKey: await importPublicKeyPem(localPair.publicKeyPem) }),
    })
    assert.equal(verified.ok, true)

    await loader.loadActor("https://remote.example/users/alice")
    assert.equal(network.requests.length, 1)
    await loader.loadActor("https://remote.example/users/alice", { refresh: true })
    assert.equal(network.requests.length, 2)
  })

  test("follows redirects up to the limit and re-validates targets", async () => {
    const network = new FakeNetwork()
    network.route("https://remote.example/a", () => new Response(null, { status: 302, headers: { location: "/b" } }))
    network.json("https://remote.example/b", { id: "https://remote.example/b", type: "Note" })
    network.route("https://remote.example/loop", () => new Response(null, { status: 301, headers: { location: "https://remote.example/loop" } }))
    network.route("https://remote.example/evil", () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }))
    const loader = createLoader(network, { maxRedirects: 2 })
    assert.equal((await loader.load("https://remote.example/a")).id, "https://remote.example/b")
    await assert.rejects(() => loader.load("https://remote.example/loop"), FetchError)
    await assert.rejects(() => loader.load("https://remote.example/evil"), /Private addresses/)
  })

  test("enforces the response size limit", async () => {
    const network = new FakeNetwork()
    network.json("https://remote.example/big", { id: "x", content: "a".repeat(5000) })
    const loader = createLoader(network, { maxBytes: 1000 })
    await assert.rejects(() => loader.load("https://remote.example/big"), /too large/)
  })

  test("reports HTTP status on failure", async () => {
    const network = new FakeNetwork()
    network.json("https://remote.example/gone", { error: "gone" }, 410)
    const loader = createLoader(network)
    await assert.rejects(() => loader.load("https://remote.example/gone"), (error: unknown) => error instanceof FetchError && error.status === 410)
  })

  test("double-knocks to RFC 9421 and remembers the spec per origin", async () => {
    const network = new FakeNetwork()
    network.route("https://strict.example/inbox", (request) =>
      new Response(null, { status: request.headers.has("signature-input") ? 202 : 401 }))
    const kv = new MemoryKvStore()
    const loader = createLoader(network, { signer: localKey, kv })
    const first = await loader.request("https://strict.example/inbox", { method: "POST", body: "{}" })
    assert.equal(first.status, 202)
    assert.deepEqual(network.requests.map((request) => request.headers.has("signature-input")), [false, true])
    assert.equal(await loader.rememberedSpec("https://strict.example"), RFC9421)

    network.requests = []
    await loader.request("https://strict.example/inbox", { method: "POST", body: "{}" })
    assert.deepEqual(network.requests.map((request) => request.headers.has("signature-input")), [true])
    assert.equal(await loader.rememberedSpec("https://other.example"), CAVAGE)
  })

  test("resolves keys from actors and standalone key documents", async () => {
    const network = new FakeNetwork()
    network.json("https://remote.example/users/alice", actorDocument("https://remote.example/users/alice", remotePair))
    network.json("https://remote.example/keys/1", {
      id: "https://remote.example/keys/1",
      type: "CryptographicKey",
      owner: "https://remote.example/users/bob",
      publicKeyPem: remotePair.publicKeyPem,
    })
    const loader = createLoader(network)
    const actorKey = await loader.resolveKey("https://remote.example/users/alice#main-key", { refresh: false })
    assert.equal(actorKey?.ownerId, "https://remote.example/users/alice")
    const standalone = await loader.resolveKey("https://remote.example/keys/1", { refresh: false })
    assert.equal(standalone?.ownerId, "https://remote.example/users/bob")
    assert.equal(await loader.resolveKey("https://remote.example/users/alice#other-key", { refresh: false }), null)
  })
})

describe("lookup", () => {
  test("parses handles", () => {
    assert.deepEqual(parseHandle("@alice@Remote.Example"), { username: "alice", host: "remote.example" })
    assert.deepEqual(parseHandle("acct:alice@remote.example"), { username: "alice", host: "remote.example" })
    assert.deepEqual(parseHandle("alice@remote.example"), { username: "alice", host: "remote.example" })
    assert.equal(parseHandle("https://remote.example/@alice"), null)
  })

  test("WebFinger and lookupObject", async () => {
    const network = new FakeNetwork()
    network.json("https://remote.example/.well-known/webfinger?resource=acct%3Aalice%40remote.example", {
      subject: "acct:alice@remote.example",
      links: [
        { rel: "http://webfinger.net/rel/profile-page", href: "https://remote.example/@alice" },
        { rel: "self", type: "application/activity+json", href: "https://remote.example/users/alice" },
      ],
    }, 200, "application/jrd+json")
    network.json("https://remote.example/users/alice", actorDocument("https://remote.example/users/alice", remotePair))
    network.json("https://remote.example/notes/1", { id: "https://remote.example/notes/1", type: "Note" })
    const loader = createLoader(network)
    assert.equal(await webfinger(loader, "@alice@remote.example"), "https://remote.example/users/alice")
    assert.equal((await lookupObject(loader, "@alice@remote.example"))?.id, "https://remote.example/users/alice")
    assert.equal((await lookupObject(loader, "acct:alice@remote.example"))?.id, "https://remote.example/users/alice")
    assert.equal((await lookupObject(loader, new URL("https://remote.example/notes/1")))?.type, "Note")
    assert.equal(await lookupObject(loader, "https://remote.example/missing"), null)
    assert.equal(await lookupObject(loader, "@nobody@remote.example"), null)
  })
})

describe("collection traversal", () => {
  test("inline items, first page by IRI, next pages and IRI items", async () => {
    const network = new FakeNetwork()
    network.json("https://remote.example/outbox?page=1", {
      id: "https://remote.example/outbox?page=1",
      type: "OrderedCollectionPage",
      orderedItems: [{ id: "a" }, "https://remote.example/notes/b"],
      next: "https://remote.example/outbox?page=2",
    })
    network.json("https://remote.example/outbox?page=2", {
      id: "https://remote.example/outbox?page=2",
      type: "OrderedCollectionPage",
      items: [{ id: "c" }, "https://remote.example/notes/missing"],
      next: "https://remote.example/outbox?page=1",
    })
    network.json("https://remote.example/notes/b", { id: "b" })
    const loader = createLoader(network)
    const paged = await collect(traverseCollection(loader, { id: "https://remote.example/outbox", type: "OrderedCollection", first: "https://remote.example/outbox?page=1" }))
    assert.deepEqual(paged.map((item) => item.id), ["a", "b", "c"])

    const inline = await collect(traverseCollection(loader, { type: "Collection", items: [{ id: "x" }, { id: "y" }] }))
    assert.deepEqual(inline.map((item) => item.id), ["x", "y"])

    const inlineFirst = await collect(traverseCollection(loader, { type: "OrderedCollection", first: { type: "OrderedCollectionPage", orderedItems: [{ id: "z" }] } }))
    assert.deepEqual(inlineFirst.map((item) => item.id), ["z"])
  })
})
