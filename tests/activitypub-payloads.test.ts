// Rows written by the Fedify-based implementation must stay readable.
import assert from "node:assert/strict"
import { before, beforeEach, describe, test } from "node:test"

import {
  ACTOR_ID,
  ALICE,
  FakeFediverse,
  assertGolden,
  createTestApp,
  normalizeDocument,
  readFixture,
  resetDatabase,
  sqlite,
} from "./support/harness.ts"

const REPLY_UUID = "5d1c2a9e-8b7f-4e6d-9c3b-2a1f0e9d8c7b"
const NOW = "2026-04-05T06:07:08.123Z"

function materialize(document: unknown): any {
  return JSON.parse(JSON.stringify(document).replaceAll("<uuid>", REPLY_UUID).replaceAll("<now>", NOW))
}

const fediverse = new FakeFediverse().install()
let app: Awaited<ReturnType<typeof createTestApp>>

before(async () => {
  app = await createTestApp()
})

beforeEach(async () => {
  fediverse.clear()
  await resetDatabase()
})

describe("Fedify-written payloads", () => {
  test("local comment reply served from a Fedify payload", async () => {
    const payload = materialize(readFixture("golden/fedify-payloads/comment-reply-payload.json"))
    sqlite.prepare(`INSERT INTO activitypub_comments (
        object_id, activity_id, article_id, article_path, actor_id, content_text, url, reply_target_id, published_at, status, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)`).run(
      payload.object.id,
      payload.id,
      "https://changkyun.kim/blog/2025-09/20-test",
      "/blog/2025-09/20-test",
      ACTOR_ID,
      "Thank you!",
      payload.object.id,
      payload.object.inReplyTo,
      NOW,
      JSON.stringify(payload),
    )

    const note = await app(`/@me/replies/${REPLY_UUID}`)
    assert.equal(note.status, 200)
    await assertGolden("fedify-payloads/comment-reply-note", normalizeDocument(await note.json(), { timestamps: true }))

    const create = await app(`/activitypub/replies/${REPLY_UUID}/activity`)
    assert.equal(create.status, 200)
    await assertGolden("fedify-payloads/comment-reply-create", normalizeDocument(await create.json(), { timestamps: true }))
  })

  test("remote reply served from a Fedify outbox activity payload", async () => {
    const payload = materialize(readFixture("golden/fedify-payloads/activity-reply-payload.json"))
    sqlite.prepare("INSERT INTO activity (activity_id, actor_id, type, object, payload, direction) VALUES (?, ?, 'Create', ?, ?, 'outbox')")
      .run(payload.id, ACTOR_ID, payload.object.id, JSON.stringify(payload))

    const note = await app(`/@me/replies/${REPLY_UUID}`)
    assert.equal(note.status, 200)
    assert.deepEqual(
      normalizeDocument(await note.json(), { timestamps: true }),
      readFixture("golden/reply-remote-note-from-payload.json"),
    )
    const create = await app(`/activitypub/replies/${REPLY_UUID}/activity`)
    assert.equal(create.status, 200)
    assert.deepEqual(
      normalizeDocument(await create.json(), { timestamps: true }),
      readFixture("golden/reply-remote-create-from-payload.json"),
    )
  })

  test("outgoing Follow served from a Fedify following payload", async () => {
    const payload = readFixture("golden/fedify-payloads/following-activity-payload.json")
    sqlite.prepare("INSERT INTO following (actor_id, activity_id, activity_payload, status) VALUES (?, ?, ?, 'requested')")
      .run(ALICE.id, payload.id, JSON.stringify(payload))
    const response = await app(new URL(payload.id).pathname, { headers: { accept: "application/activity+json" } })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), readFixture("golden/follow-from-payload.json"))
  })

  test("corrupt payloads fall back to the row columns", async () => {
    sqlite.prepare(`INSERT INTO activitypub_comments (
        object_id, activity_id, article_id, article_path, actor_id, content_text, url, reply_target_id, published_at, status, payload
      ) VALUES (?, ?, ?, ?, ?, 'Fallback', ?, ?, '2026-01-02T03:04:05Z', 'visible', '{not json')`).run(
      `https://changkyun.kim/@me/replies/${REPLY_UUID}`,
      `https://changkyun.kim/activitypub/replies/${REPLY_UUID}/activity`,
      "https://changkyun.kim/blog/2025-09/20-test",
      "/blog/2025-09/20-test",
      ACTOR_ID,
      `https://changkyun.kim/@me/replies/${REPLY_UUID}`,
      "https://remote.example/users/alice/statuses/1",
    )
    const note = await (await app(`/@me/replies/${REPLY_UUID}`)).json() as any
    assert.equal(note.content, "Fallback")
    assert.equal(note.published, "2026-01-02T03:04:05Z")
  })
})

describe("timestamp normalization", () => {
  test("matches Temporal.Instant#toString()", async () => {
    const { instantFrom } = await import("../server/utils/temporal.ts")
    const normalize = (value: string) => instantFrom(value)
    assert.equal(normalize("2026-01-02T03:04:05+09:00"), "2026-01-01T18:04:05Z")
    assert.equal(normalize("2026-01-02T03:04:05.120Z"), "2026-01-02T03:04:05.12Z")
    assert.equal(normalize("2026-01-02T03:04:05.000Z"), "2026-01-02T03:04:05Z")
    assert.equal(normalize("2026-01-02T03:04:05.123456789Z"), "2026-01-02T03:04:05.123456789Z")
    assert.equal(normalize("2026-01-02T03:04Z"), "2026-01-02T03:04:00Z")
    assert.throws(() => normalize("2026-01-02"))
    assert.throws(() => normalize("not a date"))
  })
})
