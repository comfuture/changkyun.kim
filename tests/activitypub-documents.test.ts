import assert from "node:assert/strict"
import { before, beforeEach, describe, test } from "node:test"

import {
  ACTOR_ID,
  ALICE,
  BOB,
  FakeFediverse,
  PAGE_FALLTHROUGH,
  assertGolden,
  createTestApp,
  insertBlogPost,
  readFixture,
  resetDatabase,
  sqlite,
  withoutContext,
} from "./support/harness.ts"

const AP = { accept: "application/activity+json" }
const REPLY_ID = "0b6f7e1c-3f7a-4c39-9a51-6c0a2f4f1d2e"
const FOLLOW_HASH = "d0c2e6f4b7a9e1c3d5f7a9b1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1"

const fediverse = new FakeFediverse().install()
let app: Awaited<ReturnType<typeof createTestApp>>

function seedSocialGraph() {
  const insertFollower = sqlite.prepare("INSERT INTO followers (actor_id, activity_id, status, updated_at) VALUES (?, ?, ?, ?)")
  insertFollower.run(ALICE.id, `${ALICE.id}#follow-1`, "accepted", "2026-01-02 00:00:00")
  insertFollower.run(BOB.id, `${BOB.id}#follow-1`, "accepted", "2026-01-01 00:00:00")
  insertFollower.run("https://gone.example/users/zed", "https://gone.example/users/zed#follow", "removed", "2026-01-03 00:00:00")

  const insertFollowing = sqlite.prepare("INSERT INTO following (actor_id, activity_id, activity_payload, status, updated_at) VALUES (?, ?, NULL, ?, ?)")
  insertFollowing.run(ALICE.id, `https://changkyun.kim/@me/follow/${FOLLOW_HASH}`, "accepted", "2026-01-02 00:00:00")
  insertFollowing.run(BOB.id, "https://changkyun.kim/@me/follow/bob", "requested", "2026-01-01 00:00:00")
}

function seedLocalReply() {
  const insert = sqlite.prepare(`INSERT INTO activitypub_comments (
      object_id, activity_id, article_id, article_path, actor_id, actor_name, actor_url, actor_icon_url,
      content_text, content_html, url, reply_target_id, published_at, status, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)`)
  insert.run(
    "https://remote.example/users/alice/statuses/1",
    "https://remote.example/users/alice/statuses/1/activity",
    "https://changkyun.kim/blog/2025-09/20-test",
    "/blog/2025-09/20-test",
    ALICE.id,
    "Alice",
    "https://remote.example/@alice",
    null,
    "Nice post",
    "<p>Nice post</p>",
    "https://remote.example/@alice/1",
    "https://changkyun.kim/blog/2025-09/20-test",
    "2026-01-02T03:04:05Z",
    null,
  )
  insert.run(
    `https://changkyun.kim/@me/replies/${REPLY_ID}`,
    `https://changkyun.kim/activitypub/replies/${REPLY_ID}/activity`,
    "https://changkyun.kim/blog/2025-09/20-test",
    "/blog/2025-09/20-test",
    ACTOR_ID,
    "Changkyun Kim",
    "https://changkyun.kim/about",
    "https://changkyun.kim/image/avatar.jpg",
    "Thanks!",
    null,
    `https://changkyun.kim/@me/replies/${REPLY_ID}`,
    "https://remote.example/users/alice/statuses/1",
    "2026-01-02T04:05:06.5Z",
    null,
  )
}

async function getJson(path: string, headers: Record<string, string> = AP) {
  const response = await app(path, { headers })
  return { response, body: await response.json() as any }
}

before(async () => {
  app = await createTestApp()
})

beforeEach(async () => {
  fediverse.clear()
  await resetDatabase()
  seedSocialGraph()
  seedLocalReply()
})

describe("golden documents", () => {
  test("actor", async () => {
    const { response, body } = await getJson("/@me")
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-type"), "application/activity+json")
    assert.equal(response.headers.get("vary"), "Accept")
    await assertGolden("actor", body)

    // Cross-check with production: identical except for the key material.
    const live = readFixture("live/actor.json")
    assert.deepEqual(
      { ...body, publicKey: { ...body.publicKey, publicKeyPem: "<pem>" } },
      { ...live, publicKey: { ...live.publicKey, publicKeyPem: "<pem>" } },
    )
  })

  test("outbox collection", async () => {
    const { response, body } = await getJson("/@me/outbox")
    assert.equal(response.status, 200)
    await assertGolden("outbox", body)
    assert.deepEqual(body["@context"], readFixture("live/outbox.json")["@context"])
    // Counter uses Nuxt Content (all rows, incl. entries without createdAt).
    assert.equal(body.totalItems, 4)
    assert.equal(body.first, "https://changkyun.kim/@me/outbox?cursor=0")
  })

  test("outbox first page", async () => {
    const { response, body } = await getJson("/@me/outbox?cursor=0")
    assert.equal(response.status, 200)
    await assertGolden("outbox-page-0", body)

    const live = readFixture("live/outbox-page-0.json")
    assert.deepEqual(body["@context"], live["@context"])
    const liveItem = live.orderedItems.find((item: any) => item.id.endsWith("/2025-09/20-test/activity"))
    const item = body.orderedItems.find((entry: any) => entry.id.endsWith("/2025-09/20-test/activity"))
    assert.deepEqual(withoutContext(item), withoutContext(liveItem))
    assert.deepEqual(body.orderedItems[0]["@context"], live.orderedItems[0]["@context"])
    assert.equal(body.next, undefined)
  })

  test("outbox pages link with next when more than 20 items remain", async () => {
    await resetDatabase({ content: false })
    for (let index = 0; index < 23; index += 1) {
      const day = String(index + 1).padStart(2, "0")
      insertBlogPost({ path: `/blog/2026-01/${day}-post`, title: `Post ${day}`, createdAt: `2026-01-${day}` })
    }
    const first = await getJson("/@me/outbox?cursor=0")
    assert.equal(first.body.orderedItems.length, 20)
    assert.equal(first.body.next, "https://changkyun.kim/@me/outbox?cursor=20")
    assert.equal(first.body.orderedItems[0].id, "https://changkyun.kim/blog/2026-01/23-post/activity")
    const second = await getJson("/@me/outbox?cursor=20")
    assert.equal(second.body.orderedItems.length, 3)
    assert.equal(second.body.next, undefined)
    await assertGolden("outbox-page-20", second.body)
  })

  test("followers", async () => {
    const { body } = await getJson("/@me/followers")
    await assertGolden("followers", body)
    assert.deepEqual(body["@context"], readFixture("live/followers.json")["@context"])
    assert.equal(body.totalItems, 2)
    assert.deepEqual(body.orderedItems, [ALICE.id, BOB.id])
  })

  test("following lists accepted and requested, counts accepted", async () => {
    const { body } = await getJson("/@me/following")
    await assertGolden("following", body)
    assert.equal(body.totalItems, 1)
    assert.deepEqual(body.orderedItems, [ALICE.id, BOB.id])
  })

  test("Article and Create(Article) match production", async () => {
    for (const slug of ["2025-09/20-test", "2026-07/24-agentic-coding-workflow"]) {
      const article = await getJson(`/blog/${slug}`)
      assert.equal(article.response.status, 200)
      assert.equal(article.response.headers.get("content-type"), "application/activity+json")
      assert.equal(article.response.headers.get("vary"), "Accept")
      const name = slug.replace("/", "-")
      await assertGolden(`article-${name}`, article.body)
      assert.deepEqual(article.body, readFixture(`live/article-${name}.json`))

      const create = await getJson(`/blog/${slug}/activity`)
      assert.equal(create.response.status, 200)
      await assertGolden(`create-article-${name}`, create.body)
      assert.deepEqual(create.body, readFixture(`live/article-${name}-activity.json`))
    }
  })

  test("app Article", async () => {
    const { response, body } = await getJson("/app/cube-timer")
    assert.equal(response.status, 200)
    assert.equal(body.type, "Article")
    assert.equal(body.id, "https://changkyun.kim/app/cube-timer")
    assert.deepEqual(body.url, "https://changkyun.kim/app/cube-timer")
  })

  test("local reply Note and Create(Note) built from columns", async () => {
    const note = await getJson(`/@me/replies/${REPLY_ID}`)
    assert.equal(note.response.status, 200)
    await assertGolden("local-reply-note", note.body)

    const create = await getJson(`/activitypub/replies/${REPLY_ID}/activity`)
    assert.equal(create.response.status, 200)
    await assertGolden("local-reply-create", create.body)
  })

  test("outgoing Follow reconstructed without payload", async () => {
    const { response, body } = await getJson(`/@me/follow/${FOLLOW_HASH}`)
    assert.equal(response.status, 200)
    await assertGolden("follow-minimal", body)
  })
})

describe("NodeInfo", () => {
  test("nodeinfo 2.1 JSON", async () => {
    const { getActivityPubNodeInfoJson } = await import("../server/utils/fedify.ts")
    const body = JSON.parse(JSON.stringify(await getActivityPubNodeInfoJson()))
    await assertGolden("nodeinfo-2.1", body)
    const live = readFixture("live/nodeinfo-2.1.json")
    assert.deepEqual(
      { ...body, usage: { ...(body as any).usage, localPosts: 0, localComments: 0 } },
      { ...live, usage: { ...live.usage, localPosts: 0, localComments: 0 } },
    )
  })
})

describe("content negotiation and routing", () => {
  test("/@me and local reply URLs are ActivityPub without an AP Accept header", async () => {
    for (const path of ["/@me", `/@me/replies/${REPLY_ID}`, `/activitypub/replies/${REPLY_ID}/activity`]) {
      for (const headers of [{}, { accept: "text/html" }]) {
        const response = await app(path, { headers })
        assert.equal(response.status, 200, path)
        assert.equal(response.headers.get("content-type"), "application/activity+json", path)
        assert.equal(((await response.json()) as any).id.startsWith("https://changkyun.kim/"), true)
      }
    }
  })

  test("ld+json with the activitystreams profile is treated as ActivityPub", async () => {
    const response = await app("/blog/2025-09/20-test", {
      headers: { accept: "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"" },
    })
    assert.equal(response.status, 200)
    assert.equal(((await response.json()) as any).type, "Article")
  })

  test("non-ActivityPub Accept on content and collection paths falls through to the page", async () => {
    for (const path of ["/blog/2025-09/20-test", "/blog/2025-09/20-test/activity", "/@me/outbox", "/@me/followers"]) {
      const response = await app(path, { headers: { accept: "text/html" } })
      assert.equal(await response.text(), PAGE_FALLTHROUGH, path)
    }
  })

  test("blog alias host is rewritten to /blog/...", async () => {
    const article = await app(new Request("https://changkyun.blog/2025-09/20-test", {
      headers: { ...AP, host: "changkyun.blog" },
    }))
    assert.equal(article.status, 200)
    assert.equal(((await article.json()) as any).id, "https://changkyun.kim/blog/2025-09/20-test")

    const create = await app(new Request("https://www.changkyun.blog/2025-09/20-test/activity/", {
      headers: { ...AP, host: "www.changkyun.blog" },
    }))
    assert.equal(create.status, 200)
    assert.equal(((await create.json()) as any).id, "https://changkyun.kim/blog/2025-09/20-test/activity")

    const actor = await app(new Request("https://changkyun.blog/@me", { headers: { host: "changkyun.blog" } }))
    assert.equal(actor.status, 200)
    assert.equal(((await actor.json()) as any).id, ACTOR_ID)
  })

  test("trailing slashes are ignored", async () => {
    const article = await getJson("/blog/2025-09/20-test/")
    assert.equal(article.response.status, 200)
    assert.equal(article.body.id, "https://changkyun.kim/blog/2025-09/20-test")

    const outbox = await getJson("/@me/outbox/")
    assert.equal(outbox.response.status, 200)
    assert.equal(outbox.body.id, "https://changkyun.kim/@me/outbox")
  })

  test("unknown content path returns the ActivityPub 404 body", async () => {
    const { response, body } = await getJson("/blog/does-not-exist")
    assert.equal(response.status, 404)
    assert.equal(response.headers.get("content-type"), "application/activity+json")
    assert.deepEqual(body, { error: true, statusCode: 404, statusMessage: "ActivityPub object not found" })

    const reply = await app("/@me/replies/00000000-0000-4000-8000-000000000000", { headers: AP })
    assert.equal(reply.status, 404)
    const follow = await app("/@me/follow/unknown", { headers: AP })
    assert.equal(follow.status, 404)
  })

  test("drafts are not served", async () => {
    insertBlogPost({ path: "/blog/2026-02/01-draft", title: "Draft", createdAt: "2026-02-01", draft: true })
    const response = await app("/blog/2026-02/01-draft", { headers: AP })
    assert.equal(response.status, 404)
  })

  test("HEAD returns headers without a body", async () => {
    const response = await app("/blog/2025-09/20-test", { method: "HEAD", headers: AP })
    // The middleware returns `null` for HEAD, which h3 turns into 204.
    assert.equal(response.status, 204)
    assert.equal(response.headers.get("content-type"), "application/activity+json")
    assert.equal(await response.text(), "")
  })

  test("Article falls back to the content database when Nuxt Content is unavailable", async () => {
    ;(globalThis as any).__contentQueryMode = "throw"
    const { response, body } = await getJson("/blog/2025-09/20-test")
    assert.equal(response.status, 200)
    assert.deepEqual(body, readFixture("live/article-2025-09-20-test.json"))
  })
})
