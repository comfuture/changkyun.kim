// Requests signed by an independent implementation (Fedify 2.3.3, recorded
// before it was removed) must verify.
import assert from "node:assert/strict"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { describe, test } from "node:test"

import { ALICE, FakeFediverse, readFixture, readKey } from "./support/harness.ts"

type SignedRequestFixture = {
  _note: string
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

const fixtureDir = new URL("./fixtures/http-signatures/", import.meta.url)
const SPECS = {
  "draft-cavage-http-signatures-12": "fedify-cavage.json",
  "rfc9421": "fedify-rfc9421.json",
} as const

const fediverse = new FakeFediverse().install()
void fediverse

function importPrivateKey(pem: string) {
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""), "base64")
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"])
}

async function recordFixtures() {
  const { signRequest } = await import("@fedify/fedify")
  const { Temporal } = await import("@js-temporal/polyfill")
  mkdirSync(fixtureDir, { recursive: true })
  const key = await importPrivateKey(readKey("alice", "private"))
  const body = JSON.stringify({
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${ALICE.id}/activities/follow-fixture`,
    type: "Follow",
    actor: ALICE.id,
    object: "https://changkyun.kim/@me",
  })
  for (const [spec, file] of Object.entries(SPECS)) {
    const request = new Request("https://changkyun.kim/inbox", {
      method: "POST",
      headers: { "content-type": "application/activity+json", accept: "application/activity+json" },
      body,
    })
    const signed = await signRequest(request, key, new URL(`${ALICE.id}#main-key`), {
      spec: spec as any,
      currentTime: Temporal.Instant.from("2026-11-24T00:00:00Z") as any,
    })
    const fixture: SignedRequestFixture = {
      _note: `Signed by @fedify/fedify 2.3.3 signRequest(spec: ${spec}) with tests/fixtures/keys/alice.private.pem at 2026-11-24T00:00:00Z.`,
      method: signed.method,
      url: signed.url,
      headers: Object.fromEntries(signed.headers.entries()),
      body: await signed.text(),
    }
    writeFileSync(new URL(file, fixtureDir), `${JSON.stringify(fixture, null, 2)}\n`)
  }
}

function toRequest(fixture: SignedRequestFixture, body = fixture.body) {
  return new Request(fixture.url, { method: fixture.method, headers: fixture.headers, body })
}

describe("independently signed request fixtures", () => {
  test("fixtures exist", async () => {
    if (process.env.UPDATE_GOLDENS === "1" || !existsSync(new URL(SPECS.rfc9421, fixtureDir))) {
      await recordFixtures()
    }
    for (const file of Object.values(SPECS)) {
      assert.ok(existsSync(new URL(file, fixtureDir)), file)
    }
  })

  for (const [spec, file] of Object.entries(SPECS)) {
    test(`${spec} fixture verifies and rejects tampering`, async () => {
      const { verifyRequest } = await import("@fedify/fedify")
      const fixture = readFixture<SignedRequestFixture>(`http-signatures/${file}`)
      const key = await verifyRequest(toRequest(fixture), { timeWindow: false })
      assert.equal(key?.id?.href, `${ALICE.id}#main-key`)
      const tampered = await verifyRequest(toRequest(fixture, fixture.body.replace("follow-fixture", "follow-tampered")), { timeWindow: false })
      assert.equal(tampered, null)
    })
  }
})
