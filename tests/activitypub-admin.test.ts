import assert from "node:assert/strict"
import { before, beforeEach, describe, test } from "node:test"

import {
  ACTOR_ID,
  ALICE,
  BOB,
  FakeFediverse,
  PUBLIC,
  assertGolden,
  createTestApp,
  deliveredTo,
  normalizeDocument,
  resetDatabase,
  rows,
  sqlite,
} from "./support/harness.ts"

const NOTE_ID = "https://remote.example/users/alice/statuses/42"
const ARTICLE_ID = "https://remote.example/users/alice/articles/7"
const CREATE_ID = `${NOTE_ID}/activity`

const remoteNote = {
  "@context": "https://www.w3.org/ns/activitystreams",
  id: NOTE_ID,
  type: "Note",
  attributedTo: ALICE.id,
  content: "<p>Hello &amp; welcome<br>to the fediverse</p>",
  url: "https://remote.example/@alice/42",
  to: [PUBLIC],
  cc: [`${ALICE.id}/followers`],
  published: "2026-03-04T05:06:07Z",
}

const remoteArticle = {
  "@context": "https://www.w3.org/ns/activitystreams",
  id: ARTICLE_ID,
  type: "Article",
  attributedTo: ALICE.id,
  name: "A long read",
  summary: "Summary text",
  content: "<p>Article body</p>",
  to: [PUBLIC],
  published: "2026-03-05T00:00:00.250Z",
}

const remoteCreate = {
  "@context": "https://www.w3.org/ns/activitystreams",
  id: CREATE_ID,
  type: "Create",
  actor: ALICE.id,
  object: { ...remoteNote, "@context": undefined },
  to: [PUBLIC],
}

const fediverse = new FakeFediverse().install()
fediverse.serve(NOTE_ID, remoteNote)
fediverse.serve(ARTICLE_ID, remoteArticle)
fediverse.serve(CREATE_ID, JSON.parse(JSON.stringify(remoteCreate)))

let admin: typeof import("../server/utils/activityPubAdmin.ts")
let app: Awaited<ReturnType<typeof createTestApp>>

function seedComment() {
  sqlite.prepare(`INSERT INTO activitypub_comments (
      object_id, activity_id, article_id, article_path, actor_id, actor_name, actor_url,
      content_text, content_html, url, reply_target_id, published_at, status
    ) VALUES (?, ?, ?, ?, ?, 'Alice', ?, 'Nice post', '<p>Nice post</p>', ?, ?, '2026-01-02T03:04:05Z', 'visible')`).run(
    "https://remote.example/users/alice/statuses/1",
    "https://remote.example/users/alice/statuses/1/activity",
    "https://changkyun.kim/blog/2025-09/20-test",
    "/blog/2025-09/20-test",
    ALICE.id,
    "https://remote.example/@alice",
    "https://remote.example/@alice/1",
    "https://changkyun.kim/blog/2025-09/20-test",
  )
  return (rows("SELECT id FROM activitypub_comments")[0] as { id: number }).id
}

before(async () => {
  admin = await import("../server/utils/activityPubAdmin.ts")
  app = await createTestApp()
  fediverse.localApp = app
})

beforeEach(async () => {
  fediverse.clear()
  await resetDatabase()
})

describe("search.query", () => {
  test("resolves a handle through WebFinger", async () => {
    for (const query of ["@alice@remote.example", "alice@remote.example", "acct:alice@remote.example"]) {
      const results = await admin.searchActivityPubForAdmin(query)
      assert.equal(results.length, 1, query)
      assert.equal(results[0].type, "actor")
    }
    await assertGolden("admin-search-actor", await admin.searchActivityPubForAdmin("@alice@remote.example"))
  })

  test("resolves an actor URL", async () => {
    const [result] = await admin.searchActivityPubForAdmin(ALICE.id)
    assert.equal(result.id, `actor:${ALICE.id}`)
    assert.deepEqual(result.actions, ["follow"])
  })

  test("resolves Note, Article and Create URLs", async () => {
    const [note] = await admin.searchActivityPubForAdmin(NOTE_ID)
    await assertGolden("admin-search-note", note)
    assert.equal(note.contentText, "Hello & welcome\nto the fediverse")
    assert.equal(note.publishedAt, "2026-03-04T05:06:07.000Z")

    const [article] = await admin.searchActivityPubForAdmin(ARTICLE_ID)
    await assertGolden("admin-search-article", article)

    const [viaCreate] = await admin.searchActivityPubForAdmin(CREATE_ID)
    assert.equal(viaCreate.objectId, NOTE_ID)
    assert.equal(viaCreate.type, "note")
  })

  test("unknown targets produce the unknown placeholder", async () => {
    const results = await admin.searchActivityPubForAdmin("https://remote.example/missing")
    assert.deepEqual(results.map((item) => item.type), ["unknown"])
  })

  test("rejects unsupported schemes and credentials", async () => {
    await assert.rejects(() => admin.searchActivityPubForAdmin("ftp://remote.example/x"))
    await assert.rejects(() => admin.searchActivityPubForAdmin("https://user:pass@remote.example/x"))
  })
})

describe("follow", () => {
  test("search.actor.follow records the request and delivers a Follow", async () => {
    const result = await admin.followActorForAdmin(ALICE.id)
    assert.equal(result.status, "requested")
    assert.equal(result.alreadyFollowing, false)
    assert.match(result.followActivityId ?? "", /^https:\/\/changkyun\.kim\/@me\/follow\/[0-9a-f]{64}$/)
    assert.deepEqual(deliveredTo(fediverse), [ALICE.sharedInbox])
    await assertGolden("follow-admin", normalizeDocument(fediverse.deliveries[0].body))

    const [row] = rows("SELECT actor_id, activity_id, status, activity_payload FROM following")
    assert.equal(row.status, "requested")
    assert.equal(row.activity_id, result.followActivityId)
    await assertGolden("fedify-payloads/following-activity-payload", JSON.parse(row.activity_payload))

    const served = await app(new URL(result.followActivityId!).pathname, { headers: { accept: "application/activity+json" } })
    assert.equal(served.status, 200)
    await assertGolden("follow-from-payload", await served.json())

    const again = await admin.followActorForAdmin(ALICE.id)
    assert.equal(again.alreadyFollowing, true)
    assert.equal(fediverse.deliveries.length, 1)
  })

  test("follower.follow follows an existing follower", async () => {
    sqlite.prepare("INSERT INTO followers (actor_id, activity_id, status) VALUES (?, ?, 'accepted')").run(BOB.id, `${BOB.id}#f`)
    const id = (rows("SELECT id FROM followers")[0] as { id: number }).id
    const result = await admin.followFollowerById(id)
    assert.equal(result.actorId, BOB.id)
    assert.deepEqual(deliveredTo(fediverse), [BOB.inbox])
  })

  test("failed delivery removes the following request", async () => {
    fediverse.inboxStatus.set(ALICE.sharedInbox!, 500)
    await assert.rejects(() => admin.followActorForAdmin(ALICE.id))
    assert.equal(rows("SELECT * FROM following").length, 0)
  })

  test("follower.unfollow marks the follower removed", async () => {
    sqlite.prepare("INSERT INTO followers (actor_id, activity_id, status) VALUES (?, ?, 'accepted')").run(BOB.id, `${BOB.id}#f`)
    const id = (rows("SELECT id FROM followers")[0] as { id: number }).id
    assert.equal(await admin.removeFollowerById(id), BOB.id)
    assert.equal(rows("SELECT status FROM followers")[0].status, "removed")
    assert.equal(await admin.removeFollowerById(id), null)
  })
})

describe("reply", () => {
  test("search.object.reply sends Create(Note) and persists the outbox activity", async () => {
    const result = await admin.replyRemoteActivityPubObject(NOTE_ID, "Thanks for sharing")
    assert.equal(result.actorId, ALICE.id)
    assert.equal(result.objectId, NOTE_ID)
    assert.match(result.replyObjectId, /^https:\/\/changkyun\.kim\/@me\/replies\/[0-9a-f-]{36}$/)
    assert.deepEqual(deliveredTo(fediverse), [ALICE.sharedInbox])
    const delivered = fediverse.deliveries[0].body
    await assertGolden("reply-remote-create", normalizeDocument(delivered, { timestamps: true }))
    assert.equal(delivered.object.id, result.replyObjectId)

    const [row] = rows("SELECT activity_id, actor_id, type, object, payload, direction FROM activity")
    assert.equal(row.object, result.replyObjectId)
    assert.equal(row.direction, "outbox")
    await assertGolden("fedify-payloads/activity-reply-payload", normalizeDocument(JSON.parse(row.payload), { timestamps: true }))

    const replyId = result.replyObjectId.split("/").pop()
    const note = await app(`/@me/replies/${replyId}`)
    assert.equal(note.status, 200)
    await assertGolden("reply-remote-note-from-payload", normalizeDocument(await note.json(), { timestamps: true }))
    const create = await app(`/activitypub/replies/${replyId}/activity`)
    assert.equal(create.status, 200)
    await assertGolden("reply-remote-create-from-payload", normalizeDocument(await create.json(), { timestamps: true }))
  })

  test("comment.reply sends Create(Note) and stores a local comment", async () => {
    const id = seedComment()
    const result = await admin.replyActivityPubCommentById(id, "Thank you!")
    assert.equal(result.commentObjectId, "https://remote.example/users/alice/statuses/1")
    assert.deepEqual(deliveredTo(fediverse), [ALICE.sharedInbox])
    await assertGolden("reply-comment-create", normalizeDocument(fediverse.deliveries[0].body, { timestamps: true }))

    const [row] = rows("SELECT * FROM activitypub_comments WHERE actor_id = ?", ACTOR_ID)
    assert.equal(row.object_id, result.replyObjectId)
    assert.equal(row.article_path, "/blog/2025-09/20-test")
    assert.equal(row.reply_target_id, "https://remote.example/users/alice/statuses/1")
    assert.equal(row.content_text, "Thank you!")
    assert.match(row.published_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/)
    await assertGolden("fedify-payloads/comment-reply-payload", normalizeDocument(JSON.parse(row.payload), { timestamps: true }))
  })

  test("failed reply delivery discards the local comment", async () => {
    const id = seedComment()
    fediverse.inboxStatus.set(ALICE.sharedInbox!, 500)
    await assert.rejects(() => admin.replyActivityPubCommentById(id, "Thank you!"))
    assert.equal(rows("SELECT * FROM activitypub_comments WHERE actor_id = ?", ACTOR_ID).length, 0)
  })
})

describe("react", () => {
  test("search.object.react sends Like for a heart and EmojiReact otherwise", async () => {
    const like = await admin.reactRemoteActivityPubObject(NOTE_ID)
    assert.deepEqual({ reaction: like.reaction, reactionType: like.reactionType }, { reaction: "❤️", reactionType: "Like" })
    await assertGolden("like-remote", normalizeDocument(fediverse.deliveries[0].body, { timestamps: true }))

    const emoji = await admin.reactRemoteActivityPubObject(NOTE_ID, " 🎉 ")
    assert.deepEqual({ reaction: emoji.reaction, reactionType: emoji.reactionType }, { reaction: "🎉", reactionType: "EmojiReact" })
    await assertGolden("emoji-react-remote", normalizeDocument(fediverse.deliveries[1].body, { timestamps: true }))
    assert.deepEqual(deliveredTo(fediverse), [ALICE.sharedInbox, ALICE.sharedInbox])
  })

  test("comment.react sends Like/EmojiReact to the comment author", async () => {
    const id = seedComment()
    await admin.reactActivityPubCommentById(id)
    await admin.reactActivityPubCommentById(id, "👏")
    await assertGolden("like-comment", normalizeDocument(fediverse.deliveries[0].body, { timestamps: true }))
    await assertGolden("emoji-react-comment", normalizeDocument(fediverse.deliveries[1].body, { timestamps: true }))
  })
})

describe("moderation", () => {
  test("comment.delete and reaction.delete", async () => {
    const id = seedComment()
    assert.equal(await admin.hideActivityPubCommentById(id), true)
    assert.equal(rows("SELECT status FROM activitypub_comments")[0].status, "deleted")
    assert.equal(await admin.hideActivityPubCommentById(9999), false)

    sqlite.prepare(`INSERT INTO activitypub_reactions (activity_id, article_id, article_path, actor_id, reaction, reaction_type, object_id, published_at)
      VALUES ('x', 'a', '/blog/a', ?, '❤️', 'Like', 'a', '2026-01-01T00:00:00Z')`).run(ALICE.id)
    const reactionId = (rows("SELECT id FROM activitypub_reactions")[0] as { id: number }).id
    assert.equal(await admin.deleteActivityPubReactionById(reactionId), true)
    assert.equal(await admin.deleteActivityPubReactionById(reactionId), false)
  })
})
