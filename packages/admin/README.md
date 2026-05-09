# changkyun-admin

Local-only ActivityPub admin CLI for `changkyun.kim`.

The CLI authenticates with ActivityPub-style HTTP signatures. It does not use a login session or admin token.

## Run

```bash
pnpm admin
```

Without a command, this opens the TUI dashboard. The default API base URL is `https://changkyun.kim`.

For local development:

```bash
ACTIVITYPUB_ADMIN_BASE_URL=http://localhost:3000 pnpm admin
```

## Key Setup

Use a PKCS#8 RSA private key.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out activitypub-admin.key
openssl pkey -in activitypub-admin.key -pubout
```

Configure the CLI with a private key file:

```bash
export ACTIVITYPUB_ADMIN_KEY_ID="https://changkyun.kim/@me#main-key"
export ACTIVITYPUB_ADMIN_PRIVATE_KEY_FILE=/path/to/activitypub-admin.key
```

To allow the deployed site to trust this device, register the matching public key as a Cloudflare secret:

```bash
openssl pkey -in activitypub-admin.key -pubout | pnpm exec wrangler secret put ACTIVITYPUB_ADMIN_PUBLIC_KEY
```

For multiple devices, use distinct key IDs and store a JSON map in `ACTIVITYPUB_ADMIN_PUBLIC_KEYS`.

## Recovery

Store `activitypub-admin.key` in a real secret manager such as 1Password, Bitwarden, or Vault. Restore the same PEM file on another device and point `ACTIVITYPUB_ADMIN_PRIVATE_KEY_FILE` at it.

Do not commit `.env` or `activitypub-admin.key`.

## Commands

```bash
pnpm --silent admin list [followers|comments|reactions] [--json]
pnpm --silent admin reply <comment-id> --text <text>
pnpm --silent admin react-comment <comment-id> [emoji]
pnpm --silent admin delete-comment <comment-id>
pnpm --silent admin delete-reaction <reaction-id>
pnpm --silent admin unfollow <follower-id>
```

The command mode is intended for automation helpers. It should still be used as an operator tool: inspect data first, then run mutation commands only when the user explicitly asks for that action.

## TUI Keys

- `1`, `2`, `3`: switch followers, comments, reactions
- `r`: reply to selected comment
- `d`: delete selected comment or reaction
- `u`: unfollow selected follower
- `R`: refresh
- `q`: quit
