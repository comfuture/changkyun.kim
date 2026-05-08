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

To make the local actor follow another ActivityPub actor, call the authenticated operation endpoint with the same secret used for publishing:

```bash
curl -sS -X POST 'https://changkyun.kim/__activitypub/follow' \
  -H "authorization: Bearer $ACTIVITYPUB_PUBLISH_TOKEN" \
  -H 'content-type: application/json' \
  --data '{"resource":"acct:user@example.com"}'
```

You can also pass an actor URL directly:

```bash
curl -sS -X POST 'https://changkyun.kim/__activitypub/follow' \
  -H "authorization: Bearer $ACTIVITYPUB_PUBLISH_TOKEN" \
  -H 'content-type: application/json' \
  --data '{"actorId":"https://example.com/users/user"}'
```

Only add relays or shared actors that you trust, because following them can increase inbound and outbound federation traffic.
