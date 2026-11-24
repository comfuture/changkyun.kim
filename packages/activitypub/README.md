# @changkyun/activitypub

A small ActivityPub toolkit for a single-actor site running on Cloudflare
Workers. It implements only the subset of ActivityPub that changkyun.kim
uses, with zero runtime dependencies and Web-standard APIs only (`fetch`,
`crypto.subtle`, `URL`, `Request`/`Response`).

## Supported

- **Vocabulary** (`vocab.ts`): tolerant readers for plain-JSON documents:
  single value vs. array, embedded object vs. IRI, `@id` / `@value` /
  `@language` forms, `contentMap` / `nameMap` / `summaryMap`, `as:`-prefixed
  and full-IRI type names, and the `as:Public` / `Public` aliases of the
  public collection. Builders are left to the application, which emits plain
  JSON objects.
- **Instants** (`instant.ts`): `normalizeInstant()` produces the same string
  as `Temporal.Instant#toString()` (UTC, `Z`, trimmed fraction).
- **HTTP Signatures** (`signatures.ts`):
  - draft-cavage-http-signatures-12 signing (`(request-target) host date
    digest`, `rsa-sha256`) and verification (`rsa-sha256`, `hs2019` with RSA
    keys, `Signature` or `Authorization: Signature` headers);
  - RFC 9421 signing and verification (`rsa-v1_5-sha256`, `Content-Digest`);
  - `Digest` / `Content-Digest` creation and verification;
  - one key re-fetch on verification failure to tolerate key rotation.
- **Document loader** (`loader.ts`): signed GETs ("authorized fetch") with
  `Accept: application/activity+json, application/ld+json`, a configurable
  `User-Agent`, manual redirects (limit 5), a response size limit, a timeout,
  rejection of non-http(s), localhost and private IP-literal targets, and KV
  caching of actors and keys. Requests double-knock: a 400/401/403 answer to
  one signature spec is retried with the other, and the spec that worked is
  remembered per origin in KV.
- **Lookup** (`lookup.ts`): WebFinger for `@user@host` / `acct:` handles,
  `lookupObject()`, and collection traversal (`first` / `next`,
  `orderedItems` / `items`, inline or by IRI).
- **Inbox** (`inbox.ts`): JSON parse → signature verification → signer owns
  the actor → idempotency (KV, by activity id) → dispatch. `202` accepted,
  `400` malformed, `401` unverifiable, `404` unknown recipient. A `Delete`
  whose signing key is gone (`404` / `410`) is acknowledged with `202` and
  dropped.
- **Delivery** (`delivery.ts`): recipient → inbox resolution (shared inbox
  preferred, deduplicated, own origin excluded), versioned queue message
  shapes (`{ v: 1, type: "deliver" | "inbox", ... }`), signed POSTs, retry
  classification (`404` / `410` are permanent) and exponential backoff.

## Non-goals

- A JSON-LD processor or full vocabulary code generation.
- Linked Data Signatures and FEP-8b32 Object Integrity Proofs (neither
  created nor verified). Inbound activities are authenticated by their HTTP
  signature only, so relayed/forwarded activities whose HTTP signer is not
  the activity's actor are rejected.
- Multiple actors, authorized-fetch enforcement on the site's own GET
  endpoints, OpenTelemetry, and runtimes other than Cloudflare Workers
  (Node is used for tests only).
- DNS-based SSRF protection: only IP literals and local hostnames are
  rejected, since Workers cannot resolve DNS before fetching.

## Tests

```bash
pnpm --filter @changkyun/activitypub test
```
