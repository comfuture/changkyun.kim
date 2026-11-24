import assert from "node:assert/strict"
import { before, beforeEach, describe, test } from "node:test"

import {
  ALICE,
  BOB,
  CAROL,
  FakeFediverse,
  PUBLIC,
  createTestApp,
  insertBlogPost,
  normalizeDocument,
  readFixture,
  resetDatabase,
  rows,
  sqlite,
} from "./support/harness.ts"

const fediverse = new FakeFediverse().install()

function addFollower(actorId: string) {
  sqlite.prepare("INSERT INTO followers (actor_id, activity_id, status) VALUES (?, ?, 'accepted')").run(actorId, `${actorId}#follow`)
}

function taskEvent(env: Record<string, unknown> = {}) {
  return { context: { cloudflare: { env } } }
}

before(async () => {
  fediverse.localApp = await createTestApp()
})

beforeEach(async () => {
  fediverse.clear()
  await resetDatabase()
})

describe("ap:publishNewContent", () => {
  async function runPublish() {
    const task = (await import("../server/tasks/ap/publishNewContent.ts")).default as any
    return await task.run(taskEvent())
  }

  test("persists Create activities, advances state and is idempotent", async () => {
    addFollower(ALICE.id)
    addFollower(CAROL.id)
    addFollower(BOB.id)
    sqlite.prepare("INSERT INTO followers (actor_id, activity_id, status) VALUES (?, ?, 'removed')").run("https://gone.example/users/zed", "z")

    const result = await runPublish()
    assert.equal(result.result, true)
    assert.equal(result.published, 3)
    assert.deepEqual(result.bluesky.queued, 0)

    const outbox = rows("SELECT activity_id, actor_id, type, object, direction FROM activity ORDER BY id")
    assert.deepEqual(outbox.map((row) => row.activity_id), [
      "https://changkyun.kim/blog/2025-09/20-test/activity",
      "https://changkyun.kim/blog/2026-07/24-agentic-coding-workflow/activity",
      "https://changkyun.kim/app/cube-timer/activity",
    ])
    assert.ok(outbox.every((row) => row.type === "Create" && row.direction === "outbox" && row.actor_id === "https://changkyun.kim/@me"))
    const payload = JSON.parse(rows("SELECT payload FROM activity ORDER BY id")[0].payload)
    assert.equal(payload.type, "Create")
    assert.equal(payload.object.id, "https://changkyun.kim/blog/2025-09/20-test")

    const state = rows("SELECT collection, last_document_path, last_activity_id, last_published_at FROM content_delivery_state ORDER BY collection")
    assert.deepEqual(state, [
      {
        collection: "app",
        last_document_path: "/app/cube-timer",
        last_activity_id: "https://changkyun.kim/app/cube-timer/activity",
        last_published_at: "2023-03-30T00:00:00Z",
      },
      {
        collection: "blog",
        last_document_path: "/blog/2026-07/24-agentic-coding-workflow",
        last_activity_id: "https://changkyun.kim/blog/2026-07/24-agentic-coding-workflow/activity",
        last_published_at: "2026-07-24T00:00:00Z",
      },
    ])

    // One delivery per Create and distinct follower inbox (Alice and Carol share
    // a shared inbox; the removed follower is skipped). Fedify resolved
    // "followers" to zero inboxes, so nothing was delivered before #528.
    const expected = outbox.flatMap((row) => [ALICE.sharedInbox, BOB.inbox].map((inbox) => `${row.activity_id} -> ${inbox}`))
    assert.deepEqual(
      fediverse.deliveries.map((delivery) => `${delivery.body.id} -> ${delivery.url}`).sort(),
      expected.sort(),
    )
    assert.deepEqual(normalizeDocument(fediverse.deliveries.find((delivery) => delivery.body.id.endsWith("/2025-09/20-test/activity"))!.body), readFixture("golden/delivered-create-article.json"))

    fediverse.clear()
    const again = await runPublish()
    assert.equal(again.published, 0)
    assert.equal(rows("SELECT * FROM activity").length, 3)
    assert.deepEqual(fediverse.deliveries, [])
  })

  test("only publishes entries newer than the delivery state", async () => {
    addFollower(BOB.id)
    await runPublish()
    insertBlogPost({ path: "/blog/2026-08/01-new", title: "New", createdAt: "2026-08-01" })
    fediverse.clear()
    const result = await runPublish()
    assert.equal(result.published, 1)
    assert.equal(rows("SELECT activity_id FROM activity ORDER BY id DESC LIMIT 1")[0].activity_id, "https://changkyun.kim/blog/2026-08/01-new/activity")
  })

  test("adopts legacy activity ids instead of re-publishing", async () => {
    sqlite.prepare("INSERT INTO activity (activity_id, actor_id, type, object, direction) VALUES (?, ?, 'Create', ?, 'outbox')")
      .run("https://changkyun.kim/blog/2025-09/20-test#create", "https://changkyun.kim/@me", "https://changkyun.kim/blog/2025-09/20-test")
    const result = await runPublish()
    assert.equal(result.published, 2)
    const ids = rows("SELECT activity_id FROM activity ORDER BY id").map((row) => row.activity_id)
    assert.equal(ids[0], "https://changkyun.kim/blog/2025-09/20-test/activity")
  })
})

describe("ap:crawlFeed", () => {
  const OUTBOX = `${ALICE.id}/outbox`

  function publicNote(index: number, overrides: Record<string, unknown> = {}) {
    return {
      id: `${ALICE.id}/statuses/${index}`,
      type: "Note",
      attributedTo: ALICE.id,
      content: `<p>Post ${index}</p>`,
      to: [PUBLIC],
      cc: [`${ALICE.id}/followers`],
      published: `2026-02-${String(index).padStart(2, "0")}T00:00:00Z`,
      ...overrides,
    }
  }

  function createOf(object: Record<string, any>) {
    return { id: `${object.id}/activity`, type: "Create", actor: ALICE.id, object, to: object.to, cc: object.cc }
  }

  beforeEach(() => {
    fediverse.serve(OUTBOX, {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: OUTBOX,
      type: "OrderedCollection",
      totalItems: 5,
      first: `${OUTBOX}?page=1`,
    })
    fediverse.serve(`${OUTBOX}?page=1`, {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${OUTBOX}?page=1`,
      type: "OrderedCollectionPage",
      partOf: OUTBOX,
      next: `${OUTBOX}?page=2`,
      orderedItems: [
        createOf(publicNote(5)),
        createOf(publicNote(4, { to: [`${ALICE.id}/followers`], cc: [] })),
        { id: `${ALICE.id}/statuses/99/activity`, type: "Announce", actor: ALICE.id, object: "https://elsewhere.example/notes/1", to: [PUBLIC] },
      ],
    })
    fediverse.serve(`${OUTBOX}?page=2`, {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${OUTBOX}?page=2`,
      type: "OrderedCollectionPage",
      partOf: OUTBOX,
      orderedItems: [
        createOf(publicNote(3, { type: "Article", name: "Article three", summary: "Sum" })),
        createOf(publicNote(2)),
        createOf(publicNote(1)),
      ],
    })
  })

  test("walks paged outboxes and stores public posts of connected actors", async () => {
    sqlite.prepare("INSERT INTO following (actor_id, activity_id, status) VALUES (?, ?, 'accepted')").run(ALICE.id, "https://changkyun.kim/@me/follow/a")
    addFollower(ALICE.id)
    const task = (await import("../server/tasks/ap/crawlFeed.ts")).default as any
    const result = await task.run(taskEvent())
    assert.deepEqual(result, { result: true, actors: 1, posts: 4 })

    const posts = rows("SELECT object_id, object_type, name, summary, content_text, source, published_at FROM activitypub_feed_posts ORDER BY object_id")
    assert.deepEqual(posts.map((post) => post.object_id), [1, 2, 3, 5].map((index) => `${ALICE.id}/statuses/${index}`))
    const article = posts.find((post) => post.object_type === "Article")
    assert.deepEqual(article, {
      object_id: `${ALICE.id}/statuses/3`,
      object_type: "Article",
      name: "Article three",
      summary: "Sum",
      content_text: "Post 3",
      source: "inbox",
      published_at: "2026-02-03T00:00:00.000Z",
    })
    const [feedActor] = rows("SELECT actor_id, relation, last_crawled_at, last_seen_object_id, actor_name FROM activitypub_feed_actors")
    assert.equal(feedActor.relation, "mutual")
    assert.equal(feedActor.actor_name, "Alice")
    assert.equal(feedActor.last_seen_object_id, `${ALICE.id}/statuses/1`)
    assert.ok(feedActor.last_crawled_at)

    // A second run within the crawl interval skips the actor.
    const again = await task.run(taskEvent())
    assert.deepEqual(again, { result: true, actors: 0, posts: 0 })
  })

  test("respects per-actor item and actor limits", async () => {
    sqlite.prepare("INSERT INTO following (actor_id, activity_id, status) VALUES (?, ?, 'accepted')").run(ALICE.id, "https://changkyun.kim/@me/follow/a")
    sqlite.prepare("INSERT INTO following (actor_id, activity_id, status) VALUES (?, ?, 'requested')").run(BOB.id, "https://changkyun.kim/@me/follow/b")
    const { crawlActivityPubFeed } = await import("../server/utils/activityPubFeed.ts")
    const { createFedifyContext } = await import("../server/utils/fedify.ts")
    const ctx = await createFedifyContext(undefined)
    const result = await crawlActivityPubFeed(ctx as any, { itemsPerActor: 2, actorLimit: 1 })
    assert.deepEqual(result, { actors: 1, posts: 1 })
    assert.equal(rows("SELECT * FROM activitypub_feed_posts").length, 1)
  })

  test("unreachable actors are marked crawled", async () => {
    addFollower("https://gone.example/users/nobody")
    const task = (await import("../server/tasks/ap/crawlFeed.ts")).default as any
    const result = await task.run(taskEvent())
    assert.deepEqual(result, { result: true, actors: 0, posts: 0 })
    const [state] = rows("SELECT actor_id, last_crawled_at FROM activitypub_feed_actors")
    assert.equal(state.actor_id, "https://gone.example/users/nobody")
    assert.ok(state.last_crawled_at)
  })
})
