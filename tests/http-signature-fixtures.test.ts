// Requests signed by an independent implementation (Fedify 2.3.3, recorded
// before it was removed; see the `_note` in each fixture) must verify with the
// in-repo library.
import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { importPublicKeyPem, verifyRequest } from "@changkyun/activitypub"

import { ALICE, readFixture, readKey } from "./support/harness.ts"

type SignedRequestFixture = {
  _note: string
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

const FIXTURES = {
  "draft-cavage-http-signatures-12": "fedify-cavage.json",
  "rfc9421": "fedify-rfc9421.json",
} as const

function toRequest(fixture: SignedRequestFixture, body = fixture.body) {
  return new Request(fixture.url, { method: fixture.method, headers: fixture.headers, body })
}

async function resolveAliceKey(keyId: string) {
  return { keyId, ownerId: ALICE.id, publicKey: await importPublicKeyPem(readKey("alice", "public")) }
}

describe("independently signed request fixtures", () => {
  for (const [spec, file] of Object.entries(FIXTURES)) {
    test(`${spec} fixture verifies and rejects tampering`, async () => {
      const fixture = readFixture<SignedRequestFixture>(`http-signatures/${file}`)
      const result = await verifyRequest(toRequest(fixture), { resolveKey: resolveAliceKey, timeWindowSeconds: false })
      assert.equal(result.ok, true)
      assert.equal(result.ok && result.spec, spec)
      assert.equal(result.ok && result.key.keyId, `${ALICE.id}#main-key`)

      const tampered = await verifyRequest(
        toRequest(fixture, fixture.body.replace("follow-fixture", "follow-tampered")),
        { resolveKey: resolveAliceKey, timeWindowSeconds: false },
      )
      assert.equal(tampered.ok, false)

      // Recorded on 2026-11-24: outside the default one-hour window afterwards.
      const stale = await verifyRequest(toRequest(fixture), { resolveKey: resolveAliceKey, now: new Date("2026-11-25T00:00:00Z") })
      assert.equal(stale.ok ? null : stale.reason, "expired")
    })
  }
})
