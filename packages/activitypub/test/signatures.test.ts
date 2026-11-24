import assert from "node:assert/strict"
import { createHash, createSign } from "node:crypto"
import { before, describe, test } from "node:test"

import {
  CAVAGE,
  KeyFetchError,
  RFC9421,
  createContentDigest,
  createDigest,
  importPublicKeyPem,
  parseSignatureInput,
  signRequest,
  verifyContentDigest,
  verifyDigest,
  verifyRequest,
  type KeyResolver,
  type SigningKey,
} from "../src/index.ts"
import { generateTestKeyPair, signingKey, type TestKeyPair } from "./helpers.ts"

const KEY_ID = "https://remote.example/users/alice#main-key"
const BODY = JSON.stringify({ id: "https://remote.example/activities/1", type: "Follow" })

let alice: TestKeyPair
let mallory: TestKeyPair
let aliceKey: SigningKey

function resolverFor(pair: TestKeyPair, ownerId = "https://remote.example/users/alice"): KeyResolver {
  return async (keyId) => ({ keyId, ownerId, publicKey: await importPublicKeyPem(pair.publicKeyPem) })
}

function inboxRequest(body = BODY) {
  return new Request("https://changkyun.kim/inbox", {
    method: "POST",
    headers: { "content-type": "application/activity+json" },
    body,
  })
}

function withBody(request: Request, body: string) {
  return new Request(request.url, { method: request.method, headers: request.headers, body })
}

before(() => {
  alice = generateTestKeyPair()
  mallory = generateTestKeyPair()
})

before(async () => {
  aliceKey = await signingKey(KEY_ID, alice)
})

describe("digests", () => {
  test("Digest header", async () => {
    const digest = await createDigest("hello")
    assert.equal(digest, `SHA-256=${createHash("sha256").update("hello").digest("base64")}`)
    assert.equal(await verifyDigest(digest, "hello"), true)
    assert.equal(await verifyDigest(digest, "hello!"), false)
    assert.equal(await verifyDigest(`sha-512=${createHash("sha512").update("x").digest("base64")}`, "x"), true)
    assert.equal(await verifyDigest("MD5=abc", "x"), false)
    assert.equal(await verifyDigest(null, "x"), false)
  })

  test("Content-Digest header", async () => {
    const digest = await createContentDigest("hello")
    assert.equal(digest, `sha-256=:${createHash("sha256").update("hello").digest("base64")}:`)
    assert.equal(await verifyContentDigest(digest, "hello"), true)
    assert.equal(await verifyContentDigest(digest, "bye"), false)
  })
})

describe("draft-cavage-http-signatures-12", () => {
  test("sign → verify round trip", async () => {
    const signed = await signRequest(inboxRequest(), aliceKey, { spec: CAVAGE })
    assert.match(signed.headers.get("signature") ?? "", /headers="\(request-target\) host date digest"/)
    const result = await verifyRequest(signed, { resolveKey: resolverFor(alice) })
    assert.equal(result.ok, true)
    assert.equal(result.ok && result.spec, CAVAGE)
    assert.equal(result.ok && result.key.keyId, KEY_ID)
  })

  test("signed GET has no digest", async () => {
    const signed = await signRequest(new Request("https://remote.example/users/bob"), aliceKey, { spec: CAVAGE })
    assert.equal(signed.headers.has("digest"), false)
    assert.match(signed.headers.get("signature") ?? "", /headers="\(request-target\) host date"/)
    assert.equal((await verifyRequest(signed, { resolveKey: resolverFor(alice) })).ok, true)
  })

  test("verifies a request signed by node:crypto (hs2019, Authorization header)", async () => {
    const date = new Date().toUTCString()
    const digest = `SHA-256=${createHash("sha256").update(BODY).digest("base64")}`
    const signingString = `(request-target): post /inbox\nhost: changkyun.kim\ndate: ${date}\ndigest: ${digest}`
    const signature = createSign("sha256").update(signingString).sign(alice.privateKeyPem, "base64")
    const request = new Request("https://changkyun.kim/inbox", {
      method: "POST",
      headers: {
        host: "changkyun.kim",
        date,
        digest,
        authorization: `Signature keyId="${KEY_ID}",algorithm="hs2019",headers="(request-target) host date digest",signature="${signature}"`,
      },
      body: BODY,
    })
    assert.equal((await verifyRequest(request, { resolveKey: resolverFor(alice) })).ok, true)
  })

  test("tampered body, wrong digest, wrong key, stale date and unsupported algorithm fail", async () => {
    const signed = await signRequest(inboxRequest(), aliceKey, { spec: CAVAGE })
    const tampered = await verifyRequest(withBody(signed, BODY.replace("Follow", "Undo")), { resolveKey: resolverFor(alice) })
    assert.deepEqual(tampered.ok ? null : tampered.reason, "digest")

    const headers = new Headers(signed.headers)
    headers.set("digest", "SHA-256=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    const wrongDigest = await verifyRequest(new Request(signed.url, { method: "POST", headers, body: BODY }), { resolveKey: resolverFor(alice) })
    assert.equal(wrongDigest.ok ? null : wrongDigest.reason, "digest")

    const wrongKey = await verifyRequest(signed.clone(), { resolveKey: resolverFor(mallory) })
    assert.equal(wrongKey.ok ? null : wrongKey.reason, "invalid")

    const stale = await signRequest(inboxRequest(), aliceKey, { spec: CAVAGE, now: new Date(Date.now() - 2 * 60 * 60 * 1000) })
    const staleResult = await verifyRequest(stale, { resolveKey: resolverFor(alice) })
    assert.equal(staleResult.ok ? null : staleResult.reason, "expired")
    assert.equal((await verifyRequest(stale.clone(), { resolveKey: resolverFor(alice), timeWindowSeconds: false })).ok, true)

    const algorithm = new Headers(signed.headers)
    algorithm.set("signature", (signed.headers.get("signature") ?? "").replace("rsa-sha256", "ed25519"))
    const algorithmResult = await verifyRequest(new Request(signed.url, { method: "POST", headers: algorithm, body: BODY }), { resolveKey: resolverFor(alice) })
    assert.equal(algorithmResult.ok ? null : algorithmResult.reason, "algorithm")
  })

  test("requires (request-target) and the digest to be signed", async () => {
    const date = new Date().toUTCString()
    const signingString = `host: changkyun.kim\ndate: ${date}`
    const signature = createSign("sha256").update(signingString).sign(alice.privateKeyPem, "base64")
    const request = new Request("https://changkyun.kim/inbox", {
      method: "POST",
      headers: { host: "changkyun.kim", date, signature: `keyId="${KEY_ID}",headers="host date",signature="${signature}"` },
      body: BODY,
    })
    const result = await verifyRequest(request, { resolveKey: resolverFor(alice) })
    assert.equal(result.ok ? null : result.reason, "headers")
  })

  test("missing signature", async () => {
    const result = await verifyRequest(inboxRequest(), { resolveKey: resolverFor(alice) })
    assert.equal(result.ok ? null : result.reason, "missing")
  })
})

describe("RFC 9421", () => {
  test("sign → verify round trip", async () => {
    const signed = await signRequest(inboxRequest(), aliceKey, { spec: RFC9421 })
    assert.match(signed.headers.get("signature-input") ?? "", /^sig1=\("@method" "@target-uri" "@authority" "host" "date" "content-digest"\);alg="rsa-v1_5-sha256";keyid="[^"]+";created=\d+$/)
    const result = await verifyRequest(signed, { resolveKey: resolverFor(alice) })
    assert.equal(result.ok, true)
    assert.equal(result.ok && result.spec, RFC9421)
  })

  test("tampered body, wrong key and wrong target fail", async () => {
    const signed = await signRequest(inboxRequest(), aliceKey, { spec: RFC9421 })
    const tampered = await verifyRequest(withBody(signed, `${BODY} `), { resolveKey: resolverFor(alice) })
    assert.equal(tampered.ok ? null : tampered.reason, "digest")
    const wrongKey = await verifyRequest(signed.clone(), { resolveKey: resolverFor(mallory) })
    assert.equal(wrongKey.ok ? null : wrongKey.reason, "invalid")
    const moved = new Request("https://changkyun.kim/@me/inbox", { method: "POST", headers: signed.headers, body: BODY })
    assert.equal((await verifyRequest(moved, { resolveKey: resolverFor(alice) })).ok, false)
  })

  test("parses Signature-Input dictionaries with several labels", () => {
    const inputs = parseSignatureInput(`a=("@method" "@path");keyid="k1";created=1, b=("@method" "@target-uri" "content-digest");alg="rsa-v1_5-sha256";keyid="k2"`)
    assert.deepEqual(inputs.map((input) => input.label), ["a", "b"])
    assert.deepEqual(inputs[1]!.components, ["@method", "@target-uri", "content-digest"])
    assert.equal(inputs[1]!.params.keyid, "k2")
    assert.equal(inputs[0]!.raw, `("@method" "@path");keyid="k1";created=1`)
  })
})

describe("key resolution", () => {
  test("re-fetches the key once when the cached key does not verify (rotation)", async () => {
    const signed = await signRequest(inboxRequest(), aliceKey, { spec: CAVAGE })
    const calls: boolean[] = []
    const result = await verifyRequest(signed, {
      resolveKey: async (keyId, { refresh }) => {
        calls.push(refresh)
        const pair = refresh ? alice : mallory
        return { keyId, ownerId: null, publicKey: await importPublicKeyPem(pair.publicKeyPem) }
      },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(calls, [false, true])
  })

  test("gone keys are reported as keyGone", async () => {
    const signed = await signRequest(inboxRequest(), aliceKey, { spec: CAVAGE })
    const result = await verifyRequest(signed, {
      resolveKey: async () => {
        throw new KeyFetchError("gone", 410)
      },
    })
    assert.deepEqual(result, { ok: false, reason: "keyGone", keyId: KEY_ID, status: 410 })
  })

  test("PKCS#1 public keys are accepted", async () => {
    const signed = await signRequest(inboxRequest(), aliceKey, { spec: CAVAGE })
    const result = await verifyRequest(signed, {
      resolveKey: async (keyId) => ({ keyId, ownerId: null, publicKey: await importPublicKeyPem(alice.pkcs1PublicKeyPem) }),
    })
    assert.equal(result.ok, true)
  })
})
