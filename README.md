# changkyun.kim

> logs

## Build Setup

```bash
# install dependencies
$ pnpm install

# serve with hot reload at localhost:3000
$ pnpm dev

# build for production and launch server
$ pnpm build
$ pnpm start

# generate static project
$ pnpm generate
```

For detailed explanation on how things work, check out [Nuxt.js docs](https://nuxtjs.org).

## ActivityPub operation

This site exposes a single ActivityPub actor:

```text
@me@changkyun.kim
https://changkyun.kim/@me
```

From another Fediverse server, search for `@me@changkyun.kim` and follow the result. The WebFinger endpoint also accepts the actor URL.

The site has no login-only admin UI or public follow endpoint. When a remote ActivityPub actor follows `@me@changkyun.kim`, the inbox accepts the Follow and sends a follow-back request from the local actor. Accepted followers and follow-back targets are used as the source set for the public following feed.

Remote posts are collected in two ways:

- Public `Create<Note>` and `Create<Article>` activities delivered to the inbox are stored immediately.
- The scheduled `ap:crawlFeed` task crawls public outboxes from connected actors and stores missing posts.

Stored posts are exposed at `/following/`; `/feed` redirects there. Individual items are readable under `/following/:actor/:id`.

Only allow follows or relay-style actors from sources you trust, because they can increase inbound traffic and affect what appears in the following feed.

## Bluesky auto-sharing

New `blog` and `app` entries published by `ap:publishNewContent` can also create one link-card post on a configured Bluesky account. The Bluesky post contains a short plain-text summary and an external card that links to the browser-facing canonical URL. A usable cover image is uploaded as the card thumbnail; missing, invalid, failed, or oversized images fall back to the same card without a thumbnail.

This is a one-way, create-only notification. Existing content is not backfilled, and later article edits/deletes, reposts, replies/comments, likes/reactions, and follows do not update Bluesky.

Create a dedicated Bluesky app password, then store the handle and app password as Cloudflare secrets without committing either value:

```bash
pnpm exec wrangler secret put BSKY_USER
pnpm exec wrangler secret put BSKY_PASSWORD
```

When both secrets are absent, Bluesky sharing is disabled and ActivityPub publication continues unchanged. When only one secret is present, new shares remain pending and the task reports a redacted configuration error. Authentication, upload, rate-limit, and create failures also leave a durable pending row with bounded exponential backoff; they do not roll back or block ActivityPub publication.

Operators can inspect delivery state without exposing credentials or session tokens:

```bash
pnpm exec wrangler d1 execute changkyun-kim --remote \
  --command "SELECT source_url, status, attempt_count, next_attempt_at, last_error, at_uri FROM bluesky_shares ORDER BY created_at DESC LIMIT 20"
```

`pending` rows will be retried by the scheduled publication task. `conflict` means the persisted AT Protocol record key resolves to different content and requires operator investigation. Successful rows retain their AT URI and CID for deduplication and auditing.

## Local ActivityPub Admin CLI

원격 로그인 없이 ActivityPub 반응을 관리하려면 로컬 워크스페이스 패키지인 `packages/admin`을 사용합니다.
기본 실행은 배포 도메인(`https://changkyun.kim`)을 대상으로 하는 TUI입니다.

```bash
pnpm admin
```

상세한 키 관리, 복구, 비대화형 명령은 `packages/admin/README.md`를 참고하세요.
