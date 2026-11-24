import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { before, beforeEach, describe, test } from "node:test"

import {
  ACTOR_ID,
  ALICE,
  BOB,
  CAROL,
  FakeFediverse,
  PUBLIC,
  assertGolden,
  createTestApp,
  deliveredTo,
  normalizeDocument,
  resetDatabase,
  rows,
  signedInboxRequest,
  sqlite,
  type RemoteActorFixture,
} from "./support/harness.ts"

const ARTICLE = "https://changkyun.kim/blog/2025-09/20-test"
const ARTICLE_PATH = "/blog/2025-09/20-test"

// Pleroma/Akkoma-style context; EmojiReact is not part of the AS2 vocabulary.
const EMOJI_CONTEXT = [
  "https://www.w3.org/ns/activitystreams",
  { litepub: "http://litepub.social/ns#", toot: "http://joinmastodon.org/ns#", EmojiReact: "litepub:EmojiReact", Emoji: "toot:Emoji" },
]

const fediverse = new FakeFediverse().install()
let app: Awaited<ReturnType<typeof createTestApp>>

function activityId(actor: RemoteActorFixture, kind: string) {
  return `${actor.id}/activities/${kind}-${randomUUID()}`
}

async function post(activity: Record<string, any>, options: {
  actor?: RemoteActorFixture
  path?: string
  keyName?: "alice" | "bob"
  keyId?: string
  bodyOverride?: string
  digestOverride?: string
} = {}) {
  const actor = options.actor ?? ALICE
  const body = { "@context": activity.type === "EmojiReact" ? EMOJI_CONTEXT : "https://www.w3.org/ns/activitystreams", ...activity }
  const request = signedInboxRequest({
    url: `https://changkyun.kim${options.path ?? "/inbox"}`,
    body,
    keyName: options.keyName ?? actor.keyName,
    keyId: options.keyId ?? `${actor.id}#main-key`,
    bodyOverride: options.bodyOverride,
    digestOverride: options.digestOverride,
  })
  return await app(request)
}

function note(overrides: Record<string, any> = {}, actor: RemoteActorFixture = ALICE) {
  return {
    id: `${actor.id}/statuses/${randomUUID()}`,
    type: "Note",
    attributedTo: actor.id,
    content: "<p>Great <b>post</b> &amp; thanks</p>",
    inReplyTo: ARTICLE,
    to: [PUBLIC],
    cc: [`${actor.id}/followers`],
    published: "2026-01-02T03:04:05+09:00",
    url: `${new URL(actor.id).origin}/@${actor.document.preferredUsername}/1`,
    ...overrides,
  }
}

function create(object: Record<string, any>, actor: RemoteActorFixture = ALICE, overrides: Record<string, any> = {}) {
  return {
    id: activityId(actor, "create"),
    type: "Create",
    actor: actor.id,
    object,
    to: object.to,
    cc: object.cc,
    ...overrides,
  }
}

function follow(actor: RemoteActorFixture = ALICE, id = activityId(actor, "follow")) {
  return { id, type: "Follow", actor: actor.id, object: ACTOR_ID }
}

before(async () => {
  app = await createTestApp()
  fediverse.localApp = app
})

beforeEach(async () => {
  fediverse.clear()
  await resetDatabase()
})

describe("Follow", () => {
  test("new follower is accepted, followed back and sent recent posts", async () => {
    const activity = follow()
    const response = await post(activity)
    assert.equal(response.status, 202)

    assert.deepEqual(
      rows("SELECT actor_id, activity_id, status FROM followers"),
      [{ actor_id: ALICE.id, activity_id: activity.id, status: "accepted" }],
    )
    const following = rows("SELECT actor_id, activity_id, status FROM following")
    assert.equal(following.length, 1)
    assert.equal(following[0].actor_id, ALICE.id)
    assert.equal(following[0].status, "requested")
    assert.match(following[0].activity_id, /^https:\/\/changkyun\.kim\/@me\/follow\/[0-9a-f]{64}$/)

    const types = fediverse.deliveries.map((delivery) => delivery.body.type)
    // Accept, follow-back, 3 recent Create(Article) oldest-first. Update(Person)
    // to "followers" is never delivered by Fedify (latent bug, see #528).
    assert.deepEqual(types, ["Accept", "Follow", "Create", "Create", "Create"])
    assert.deepEqual(deliveredTo(fediverse), Array(5).fill(ALICE.sharedInbox))
    assert.deepEqual(
      fediverse.deliveries.slice(2).map((delivery) => delivery.body.id),
      [
        "https://changkyun.kim/app/cube-timer/activity",
        "https://changkyun.kim/blog/2025-09/20-test/activity",
        "https://changkyun.kim/blog/2026-07/24-agentic-coding-workflow/activity",
      ],
    )

    const [accept, followBack] = fediverse.deliveries
    await assertGolden("accept", normalizeDocument({
      ...accept.body,
      object: { ...accept.body.object, id: "<follow-id>" },
    }))
    assert.equal(accept.body.object.id, activity.id)
    await assertGolden("follow-back", followBack.body && normalizeDocument(followBack.body))
    await assertGolden("delivered-create-article", normalizeDocument(fediverse.deliveries[3].body))
    assert.equal(followBack.body.id, following[0].activity_id)

    // Every delivery carries a draft-cavage HTTP signature.
    for (const delivery of fediverse.deliveries) {
      assert.match(delivery.headers.signature ?? "", /keyId="https:\/\/changkyun\.kim\/@me#main-key"/)
      assert.ok(delivery.headers.digest)
      assert.equal(delivery.headers["content-type"], "application/activity+json")
    }
  })

  test("Update(Person) wire format", async () => {
    // Fedify never delivered Update(Person) to "followers" (zero inboxes, see
    // #528), so its golden is derived by asking Fedify to send the same Update
    // that sendFollowersUpdate() builds directly to one recipient.
    const { Person, Update, PUBLIC_COLLECTION } = await import("@fedify/vocab")
    const { createFedifyContext } = await import("../server/utils/fedify.ts")
    const actorJson = await (await app("/@me")).json()
    const person = await Person.fromJsonLd(actorJson)
    const ctx = await createFedifyContext(undefined)
    const recipient = await ctx.lookupObject(ALICE.id)
    await ctx.sendActivity({ identifier: "me" }, recipient as any, new Update({
      id: new URL(`#update-${randomUUID()}`, ACTOR_ID),
      actor: new URL(ACTOR_ID),
      object: person,
      to: PUBLIC_COLLECTION,
      cc: new URL("/@me/followers", "https://changkyun.kim"),
    }), { preferSharedInbox: true })
    assert.deepEqual(deliveredTo(fediverse), [ALICE.sharedInbox])
    await assertGolden("update-person", normalizeDocument(fediverse.deliveries[0].body))
  })

  test("repeated Follow re-accepts without a second follow-back", async () => {
    await post(follow())
    fediverse.clear()
    const response = await post(follow())
    assert.equal(response.status, 202)
    assert.deepEqual(fediverse.deliveries.map((delivery) => delivery.body.type), ["Accept", "Create", "Create", "Create"])
    assert.equal(rows("SELECT * FROM followers").length, 1)
    assert.equal(rows("SELECT * FROM following").length, 1)
  })

  test("follow-back failure rolls back the following row", async () => {
    fediverse.inboxFailure = (delivery) => delivery.body?.type === "Follow" ? 500 : undefined
    const response = await post(follow())
    assert.equal(response.status, 202)
    assert.equal(rows("SELECT * FROM following").length, 0)
    // The failed follow-back may be retried with another signature spec (double knock).
    assert.deepEqual(
      fediverse.deliveries.map((delivery) => delivery.body.type).filter((type) => type !== "Follow"),
      ["Accept", "Create", "Create", "Create"],
    )
    assert.equal(rows("SELECT status FROM followers")[0]?.status, "accepted")
  })

  test("Follow of another object is ignored", async () => {
    const response = await post({ ...follow(), object: "https://changkyun.kim/@someone" })
    assert.equal(response.status, 202)
    assert.equal(rows("SELECT * FROM followers").length, 0)
    assert.equal(fediverse.deliveries.length, 0)
  })

  test("Undo(Follow) removes the follower", async () => {
    const original = follow()
    await post(original)
    fediverse.clear()
    const response = await post({ id: activityId(ALICE, "undo"), type: "Undo", actor: ALICE.id, object: original })
    assert.equal(response.status, 202)
    assert.deepEqual(rows("SELECT status, activity_id FROM followers"), [{ status: "removed", activity_id: original.id }])
    // Update(Person) goes to "followers", which Fedify resolves to zero inboxes.
    assert.equal(fediverse.deliveries.length, 0)
  })

  test("Accept(Follow) of our follow marks following as accepted", async () => {
    const followId = "https://changkyun.kim/@me/follow/abc"
    sqlite.prepare("INSERT INTO following (actor_id, activity_id, status) VALUES (?, ?, 'requested')").run(ALICE.id, followId)
    const response = await post({
      id: activityId(ALICE, "accept"),
      type: "Accept",
      actor: ALICE.id,
      object: { id: followId, type: "Follow", actor: ACTOR_ID, object: ALICE.id },
    })
    assert.equal(response.status, 202)
    const [row] = rows("SELECT status, activity_id, activity_payload FROM following")
    assert.equal(row.status, "accepted")
    assert.equal(row.activity_id, followId)
    assert.equal(JSON.parse(row.activity_payload).type, "Follow")
  })
})

describe("Create", () => {
  async function commentFor(object: Record<string, any>, actor: RemoteActorFixture = ALICE) {
    const response = await post(create(object, actor), { actor })
    assert.equal(response.status, 202)
    return rows("SELECT * FROM activitypub_comments WHERE object_id = ?", object.id)[0]
  }

  test("reply to an article on the canonical host is stored", async () => {
    const object = note()
    const activity = create(object)
    const response = await post(activity)
    assert.equal(response.status, 202)
    const [row] = rows("SELECT * FROM activitypub_comments")
    assert.equal(row.object_id, object.id)
    assert.equal(row.activity_id, activity.id)
    assert.equal(row.article_id, ARTICLE)
    assert.equal(row.article_path, ARTICLE_PATH)
    assert.equal(row.actor_id, ALICE.id)
    assert.equal(row.actor_name, "Alice")
    assert.equal(row.actor_url, "https://remote.example/@alice")
    assert.equal(row.actor_icon_url, "https://remote.example/avatars/alice.png")
    assert.equal(row.content_text, "Great post & thanks")
    assert.equal(row.content_html, object.content)
    assert.equal(row.url, object.url)
    assert.equal(row.reply_target_id, ARTICLE)
    assert.equal(row.published_at, "2026-01-01T18:04:05Z")
    assert.equal(row.status, "visible")
    const payload = JSON.parse(row.payload)
    assert.equal(payload.id, activity.id)
    assert.equal(payload.object.id, object.id)
  })

  test("reply via blog alias host and /activity suffix is stored", async () => {
    const alias = await commentFor(note({ inReplyTo: "https://changkyun.blog/2025-09/20-test" }))
    assert.equal(alias.article_path, ARTICLE_PATH)
    assert.equal(alias.reply_target_id, "https://changkyun.blog/2025-09/20-test")
    const suffixed = await commentFor(note({ inReplyTo: `${ARTICLE}/activity` }))
    assert.equal(suffixed.article_path, ARTICLE_PATH)
  })

  test("reply to an existing comment is attached to its article", async () => {
    const parent = await commentFor(note())
    const child = await commentFor(note({ inReplyTo: parent.object_id }, BOB), BOB)
    assert.equal(child.article_path, ARTICLE_PATH)
    assert.equal(child.reply_target_id, parent.object_id)
    assert.equal(child.actor_name, "Bob")
  })

  test("language-tagged content (contentMap) is read", async () => {
    const object = note({ content: undefined, contentMap: { ko: "<p>안녕하세요</p>" } })
    const row = await commentFor(object)
    assert.equal(row?.content_text, "안녕하세요")
  })

  test("non-public, non-reply and unknown-article Creates are ignored", async () => {
    const privateNote = note({ to: [`${ALICE.id}/followers`], cc: [] })
    assert.equal(await commentFor(privateNote), undefined)
    assert.equal(await commentFor(note({ inReplyTo: undefined })), undefined)
    assert.equal(await commentFor(note({ inReplyTo: "https://changkyun.kim/blog/missing" })), undefined)
    assert.equal(await commentFor(note({ inReplyTo: "https://elsewhere.example/blog/2025-09/20-test" })), undefined)
    assert.equal(rows("SELECT * FROM activitypub_comments").length, 0)
  })

  test("public post from a followed actor is mirrored into the feed", async () => {
    sqlite.prepare("INSERT INTO following (actor_id, activity_id, status) VALUES (?, ?, 'accepted')").run(ALICE.id, "https://changkyun.kim/@me/follow/x")
    const object = note({ inReplyTo: undefined, content: "<p>Hello<br>world</p>" })
    const activity = create(object)
    const response = await post(activity)
    assert.equal(response.status, 202)
    const [row] = rows("SELECT * FROM activitypub_feed_posts")
    assert.equal(row.object_id, object.id)
    assert.equal(row.activity_id, activity.id)
    assert.equal(row.object_type, "Note")
    assert.equal(row.content_text, "Hello\nworld")
    assert.equal(row.source, "inbox")
    assert.equal(row.published_at, "2026-01-01T18:04:05.000Z")
    assert.equal(row.actor_name, "Alice")
    const [feedActor] = rows("SELECT actor_id, relation, last_seen_object_id FROM activitypub_feed_actors")
    assert.deepEqual(feedActor, { actor_id: ALICE.id, relation: "following", last_seen_object_id: object.id })
  })

  test("post from an unrelated actor is not mirrored", async () => {
    const response = await post(create(note({ inReplyTo: undefined })))
    assert.equal(response.status, 202)
    assert.equal(rows("SELECT * FROM activitypub_feed_posts").length, 0)
  })

  test("duplicate activity id is processed once", async () => {
    const activity = create(note())
    assert.equal((await post(activity)).status, 202)
    sqlite.exec("DELETE FROM activitypub_comments")
    assert.equal((await post(activity)).status, 202)
    assert.equal(rows("SELECT * FROM activitypub_comments").length, 0)
  })
})

describe("reactions", () => {
  async function react(activity: Record<string, any>, actor: RemoteActorFixture = ALICE) {
    const response = await post({ actor: actor.id, object: ARTICLE, ...activity }, { actor })
    assert.equal(response.status, 202)
    return rows("SELECT * FROM activitypub_reactions WHERE actor_id = ?", actor.id)[0]
  }

  test("Like is stored as a heart", async () => {
    const id = activityId(ALICE, "like")
    const row = await react({ id, type: "Like", published: "2026-01-02T03:04:05.120Z" })
    assert.equal(row.reaction, "❤️")
    assert.equal(row.reaction_type, "Like")
    assert.equal(row.activity_id, id)
    assert.equal(row.article_path, ARTICLE_PATH)
    assert.equal(row.object_id, ARTICLE)
    assert.equal(row.published_at, "2026-01-02T03:04:05.12Z")
    assert.equal(row.actor_icon_url, "https://remote.example/avatars/alice.png")
    assert.equal(JSON.parse(row.payload).id, id)
  })

  test("EmojiReact reads content, name or tag", async () => {
    assert.equal((await react({ id: activityId(ALICE, "react"), type: "EmojiReact", content: "🎉" })).reaction, "🎉")
    assert.equal((await react({ id: activityId(BOB, "react"), type: "EmojiReact", name: "👍" }, BOB)).reaction, "👍")
    const tagged = await react({
      id: activityId(CAROL, "react"),
      type: "EmojiReact",
      content: ":blobcat:",
      tag: [{ type: "Emoji", name: ":blobcat:", icon: { type: "Image", url: "https://remote.example/emoji/blobcat.png" } }],
    }, CAROL)
    assert.equal(tagged.reaction, ":blobcat:")
    const tagOnly = await react({
      id: activityId(CAROL, "react"),
      type: "EmojiReact",
      tag: [{ type: "Emoji", name: ":wave:", icon: { type: "Image", url: "https://remote.example/emoji/wave.png" } }],
    }, CAROL)
    assert.equal(tagOnly.reaction, ":wave:")
    // One row per (article, actor).
    assert.equal(rows("SELECT * FROM activitypub_reactions").length, 3)
  })

  test("Undo(Like) and Undo(EmojiReact) delete the reaction", async () => {
    const like = { id: activityId(ALICE, "like"), type: "Like", actor: ALICE.id, object: ARTICLE }
    await react(like)
    await post({ id: activityId(ALICE, "undo"), type: "Undo", actor: ALICE.id, object: like })
    assert.equal(rows("SELECT * FROM activitypub_reactions").length, 0)

    const emoji = { id: activityId(BOB, "react"), type: "EmojiReact", actor: BOB.id, object: ARTICLE, content: "🔥" }
    await react(emoji, BOB)
    await post({ id: activityId(BOB, "undo"), type: "Undo", actor: BOB.id, object: emoji }, { actor: BOB })
    assert.equal(rows("SELECT * FROM activitypub_reactions").length, 0)
  })

  test("Undo by IRI deletes a reaction by activity id", async () => {
    const likeId = activityId(ALICE, "like")
    await react({ id: likeId, type: "Like" })
    await post({ id: activityId(ALICE, "undo"), type: "Undo", actor: ALICE.id, object: likeId })
    assert.equal(rows("SELECT * FROM activitypub_reactions").length, 0)
  })

  test("reactions to non-article targets are ignored", async () => {
    const row = await react({ id: activityId(ALICE, "like"), type: "Like", object: "https://changkyun.kim/about" })
    assert.equal(row, undefined)
  })
})

describe("Delete", () => {
  async function storeComment() {
    const object = note()
    await post(create(object))
    return object
  }

  test("by the comment owner marks it deleted", async () => {
    const object = await storeComment()
    const response = await post({ id: activityId(ALICE, "delete"), type: "Delete", actor: ALICE.id, object: object.id })
    assert.equal(response.status, 202)
    assert.equal(rows("SELECT status FROM activitypub_comments")[0].status, "deleted")
  })

  test("with a Tombstone object marks it deleted", async () => {
    const object = await storeComment()
    await post({ id: activityId(ALICE, "delete"), type: "Delete", actor: ALICE.id, object: { id: object.id, type: "Tombstone" } })
    assert.equal(rows("SELECT status FROM activitypub_comments")[0].status, "deleted")
  })

  test("by another actor is ignored", async () => {
    const object = await storeComment()
    const response = await post({ id: activityId(BOB, "delete"), type: "Delete", actor: BOB.id, object: object.id }, { actor: BOB })
    assert.equal(response.status, 202)
    assert.equal(rows("SELECT status FROM activitypub_comments")[0].status, "visible")
  })
})

describe("inbox protocol", () => {
  test("unknown activity types are accepted and ignored", async () => {
    const response = await post({ id: activityId(ALICE, "move"), type: "Move", actor: ALICE.id, object: ALICE.id, target: BOB.id })
    assert.equal(response.status, 202)
    const announce = await post({ id: activityId(ALICE, "announce"), type: "Announce", actor: ALICE.id, object: ARTICLE })
    assert.equal(announce.status, 202)
  })

  test("personal inbox accepts activities too", async () => {
    const response = await post(follow(), { path: "/@me/inbox" })
    assert.equal(response.status, 202)
    assert.equal(rows("SELECT * FROM followers").length, 1)
  })

  test("tampered body is rejected", async () => {
    const activity = follow()
    const response = await post(activity, {
      bodyOverride: JSON.stringify({ "@context": "https://www.w3.org/ns/activitystreams", ...activity, object: "https://changkyun.kim/@me/followers" }),
    })
    assert.equal(response.status >= 400 && response.status < 500, true)
    assert.equal(rows("SELECT * FROM followers").length, 0)
  })

  test("wrong digest is rejected", async () => {
    const response = await post(follow(), { digestOverride: "SHA-256=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" })
    assert.equal(response.status >= 400 && response.status < 500, true)
    assert.equal(rows("SELECT * FROM followers").length, 0)
  })

  test("signature by the wrong key is rejected", async () => {
    const response = await post(follow(), { keyName: "bob" })
    assert.equal(response.status, 401)
    assert.equal(rows("SELECT * FROM followers").length, 0)
  })

  test("signer that does not own the activity actor is rejected", async () => {
    const response = await post(follow(ALICE), { actor: BOB, keyName: "bob", keyId: `${BOB.id}#main-key` })
    assert.equal(response.status, 401)
    assert.equal(rows("SELECT * FROM followers").length, 0)
  })

  test("unsigned request is rejected", async () => {
    const response = await app(new Request("https://changkyun.kim/inbox", {
      method: "POST",
      headers: { "content-type": "application/activity+json" },
      body: JSON.stringify({ "@context": "https://www.w3.org/ns/activitystreams", ...follow() }),
    }))
    assert.equal(response.status, 401)
  })

  test("malformed JSON is rejected", async () => {
    const response = await post(follow(), { bodyOverride: "{not json" })
    assert.equal(response.status >= 400 && response.status < 500, true)
  })

  test("Delete whose signing key is gone", async () => {
    const goneActor = "https://gone.example/users/ghost"
    fediverse.serve(goneActor, { error: "gone" }, "application/activity+json", 410)
    const response = await post({ id: `${goneActor}#delete`, type: "Delete", actor: goneActor, object: goneActor }, {
      keyName: "bob",
      keyId: `${goneActor}#main-key`,
    })
    // Fedify 2.3.3 answers 401 (no unverified-activity handler is configured).
    assert.equal(response.status, 401)
  })
})
