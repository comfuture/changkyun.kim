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
