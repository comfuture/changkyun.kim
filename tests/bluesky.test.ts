import assert from "node:assert/strict"
import test from "node:test"

import {
  attachBlueskyCardThumbnail,
  BlueskyRecordConflictError,
  buildBlueskyShareDraft,
  createBlueskySession,
  createOrReconcileBlueskyPost,
  createBlueskyRecordKey,
  nextBlueskyAttemptAt,
  normalizeBlueskyText,
  resolveBlueskyConfig,
  sanitizeBlueskyError,
  shouldQueueBlueskyShare,
  truncateBlueskyText,
  type BlueskyPostRecord,
  type BlueskySession,
} from "../server/utils/bluesky.ts"
import { resolvePublicArticleUrl } from "../server/utils/fedifyContent.ts"

const session: BlueskySession = {
  accessJwt: "test-access-jwt",
  did: "did:plc:test",
  pdsUrl: "https://pds.example.com",
}

const record: BlueskyPostRecord = {
  $type: "app.bsky.feed.post",
  text: "간략한 요약",
  createdAt: "2026-07-23T00:00:00.000Z",
  embed: {
    $type: "app.bsky.embed.external",
    external: {
      uri: "https://changkyun.blog/example",
      title: "Example",
      description: "간략한 요약",
    },
  },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

test("resolves disabled, incomplete, and enabled secret configuration without exposing values", () => {
  assert.deepEqual(resolveBlueskyConfig({}), { status: "disabled" })
  assert.deepEqual(resolveBlueskyConfig({ BSKY_USER: "changkyun.kim" }), { status: "incomplete" })
  assert.deepEqual(resolveBlueskyConfig({ BSKY_PASSWORD: "app-password" }), { status: "incomplete" })
  assert.deepEqual(
    resolveBlueskyConfig({
      BSKY_USER: " changkyun.kim ",
      BSKY_PASSWORD: " app-password ",
    }),
    {
      status: "enabled",
      user: "changkyun.kim",
      password: "app-password",
    },
  )
})

test("normalizes Markdown, HTML, whitespace, and minimark-like content", () => {
  assert.equal(
    normalizeBlueskyText("## 제목\n\n[링크](https://example.com)와 <strong>강조</strong> &amp; `코드`"),
    "제목 링크와 강조 & 코드",
  )
  assert.equal(
    normalizeBlueskyText({
      type: "minimark",
      children: [
        { type: "p", children: [{ type: "text", value: "본문" }] },
        { type: "p", children: [{ type: "text", value: "요약" }] },
      ],
    }),
    "본문 요약",
  )
})

test("builds a stable summary and external-card draft with the canonical URL", () => {
  const publicUrl = new URL("https://changkyun.blog/2026/example")
  const draft = buildBlueskyShareDraft(
    {
      title: "새 글",
      description: "  **간략한**\n요약  ",
      coverImage: "/blog/example/cover.png",
    },
    publicUrl,
    {
      now: new Date("2026-07-23T00:00:00.000Z"),
      siteOrigin: "https://changkyun.kim",
    },
  )

  assert.match(draft.recordKey, /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/)
  assert.equal(draft.record.text, "간략한 요약")
  assert.equal(draft.record.createdAt, "2026-07-23T00:00:00.000Z")
  assert.deepEqual(draft.record.embed.external, {
    uri: publicUrl.href,
    title: "새 글",
    description: "간략한 요약",
  })
  assert.equal(draft.coverImageUrl, "https://changkyun.kim/blog/example/cover.png")
})

test("generates unique valid TID record keys within the same millisecond", () => {
  const now = 1784764800000
  const keys = new Set(Array.from({ length: 1100 }, () => createBlueskyRecordKey(now)))
  keys.add(createBlueskyRecordKey(now + 1))
  assert.equal(keys.size, 1101)
  for (const key of keys) {
    assert.match(key, /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/)
  }
})

test("falls back from description to body and title", () => {
  const fromBody = buildBlueskyShareDraft(
    {
      title: "제목",
      body: { children: [{ value: "본문 요약" }] },
    },
    new URL("https://changkyun.blog/body"),
  )
  assert.equal(fromBody.record.text, "본문 요약")

  const fromTitle = buildBlueskyShareDraft(
    { title: "제목만 있음" },
    new URL("https://changkyun.blog/title"),
  )
  assert.equal(fromTitle.record.text, "제목만 있음")
})

test("selects browser-facing canonical URLs for blog and app entries", () => {
  assert.equal(
    resolvePublicArticleUrl({ path: "/blog/2026/example" })?.href,
    "https://changkyun.blog/2026/example",
  )
  assert.equal(
    resolvePublicArticleUrl({ path: "/app/cube-timer" })?.href,
    "https://changkyun.kim/app/cube-timer",
  )
})

test("truncates at grapheme and UTF-8 byte limits without splitting emoji", () => {
  const korean = truncateBlueskyText("가".repeat(400))
  assert.equal(Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(korean)).length, 300)
  assert.equal(new TextEncoder().encode(korean).byteLength, 900)

  assert.equal(truncateBlueskyText("가나다", 300, 7), "가나")

  const family = "👨‍👩‍👧‍👦"
  assert.equal(truncateBlueskyText(`${family}${family}`, 1, 100), family)
})

test("creates a session and routes writes to the returned HTTPS PDS", async () => {
  let requestBody: Record<string, string> | null = null
  const fetcher: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body))
    return jsonResponse({
      accessJwt: "access",
      refreshJwt: "refresh",
      did: "did:plc:test",
      handle: "changkyun.kim",
      didDoc: {
        service: [{
          id: "did:plc:test#atproto_pds",
          type: "AtprotoPersonalDataServer",
          serviceEndpoint: "https://pds.example.com/",
        }],
      },
    })
  }

  const created = await createBlueskySession({
    status: "enabled",
    user: "changkyun.kim",
    password: "app-password",
  }, fetcher)

  assert.deepEqual(requestBody, {
    identifier: "changkyun.kim",
    password: "app-password",
  })
  assert.deepEqual(created, {
    accessJwt: "access",
    did: "did:plc:test",
    pdsUrl: "https://pds.example.com",
  })
})

test("uploads an eligible cover image and attaches the returned blob", async () => {
  const requests: string[] = []
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    if (url === "https://changkyun.kim/cover.png") {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "content-type": "image/png",
          "content-length": "3",
        },
      })
    }
    assert.equal(url, "https://pds.example.com/xrpc/com.atproto.repo.uploadBlob")
    return jsonResponse({
      blob: {
        $type: "blob",
        ref: { $link: "bafktest" },
        mimeType: "image/png",
        size: 3,
      },
    })
  }

  const result = await attachBlueskyCardThumbnail(
    session,
    record,
    "https://changkyun.kim/cover.png",
    fetcher,
  )

  assert.equal(result.outcome, "attached")
  assert.deepEqual(result.record.embed.external.thumb, {
    $type: "blob",
    ref: { $link: "bafktest" },
    mimeType: "image/png",
    size: 3,
  })
  assert.equal(requests.length, 2)
})

test("degrades oversized and non-image covers to a card without a thumbnail", async () => {
  let requests = 0
  const oversized: typeof fetch = async () => {
    requests += 1
    return new Response(new Uint8Array(), {
      headers: {
        "content-type": "image/png",
        "content-length": "1000001",
      },
    })
  }
  const oversizedResult = await attachBlueskyCardThumbnail(
    session,
    record,
    "https://changkyun.kim/large.png",
    oversized,
  )
  assert.equal(oversizedResult.outcome, "skipped")
  assert.equal(oversizedResult.record.embed.external.thumb, undefined)
  assert.equal(requests, 1)

  const nonImageResult = await attachBlueskyCardThumbnail(
    session,
    record,
    "https://changkyun.kim/not-image",
    async () => new Response("html", {
      headers: { "content-type": "text/html" },
    }),
  )
  assert.equal(nonImageResult.outcome, "skipped")
})

test("reconciles an already-created matching record without another POST", async () => {
  let calls = 0
  const fetcher: typeof fetch = async (_input, init) => {
    calls += 1
    assert.equal(init?.method, "GET")
    return jsonResponse({
      uri: "at://did:plc:test/app.bsky.feed.post/3mtest",
      cid: "bafytest",
      value: record,
    })
  }

  const result = await createOrReconcileBlueskyPost(session, "3mtestrecord2", record, fetcher)
  assert.deepEqual(result, {
    uri: "at://did:plc:test/app.bsky.feed.post/3mtest",
    cid: "bafytest",
  })
  assert.equal(calls, 1)
})

test("recovers a lost create response by reading the same persisted record key", async () => {
  let calls = 0
  const fetcher: typeof fetch = async (_input, init) => {
    calls += 1
    if (calls === 1) {
      assert.equal(init?.method, "GET")
      return jsonResponse({ error: "RecordNotFound" }, 404)
    }
    if (calls === 2) {
      assert.equal(init?.method, "POST")
      throw new TypeError("simulated connection loss")
    }
    assert.equal(init?.method, "GET")
    return jsonResponse({
      uri: "at://did:plc:test/app.bsky.feed.post/3mtest",
      cid: "bafytest",
      value: record,
    })
  }

  const result = await createOrReconcileBlueskyPost(session, "3mtestrecord2", record, fetcher)
  assert.equal(result.uri, "at://did:plc:test/app.bsky.feed.post/3mtest")
  assert.equal(calls, 3)
})

test("refuses to overwrite a different record at the persisted key", async () => {
  const fetcher: typeof fetch = async () => jsonResponse({
    uri: "at://did:plc:test/app.bsky.feed.post/3mtest",
    cid: "bafydifferent",
    value: {
      ...record,
      text: "different",
    },
  })

  await assert.rejects(
    createOrReconcileBlueskyPost(session, "3mtestrecord2", record, fetcher),
    BlueskyRecordConflictError,
  )
})

test("sanitizes unexpected errors instead of retaining credential-bearing messages", () => {
  const sanitized = sanitizeBlueskyError(new Error("app-password leaked in a transport error"))
  assert.equal(sanitized, "Bluesky sharing failed.")
  assert.equal(sanitized.includes("app-password"), false)
})

test("uses bounded exponential backoff for pending Bluesky shares", () => {
  const now = new Date("2026-07-23T00:00:00.000Z")
  assert.equal(nextBlueskyAttemptAt(1, now), "2026-07-23T00:10:00.000Z")
  assert.equal(nextBlueskyAttemptAt(2, now), "2026-07-23T00:20:00.000Z")
  assert.equal(nextBlueskyAttemptAt(3, now), "2026-07-23T00:40:00.000Z")
  assert.equal(nextBlueskyAttemptAt(20, now), "2026-07-23T06:00:00.000Z")
})

test("queues only newly published activities and never backfills an existing outbox", () => {
  assert.equal(shouldQueueBlueskyShare("enabled", false), true)
  assert.equal(shouldQueueBlueskyShare("incomplete", false), true)
  assert.equal(shouldQueueBlueskyShare("enabled", true), false)
  assert.equal(shouldQueueBlueskyShare("disabled", false), false)
})
