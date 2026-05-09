---
name: changkyun-admin
description: Manage changkyun.kim ActivityPub admin workflows with the local `pnpm admin` CLI. Use when the user asks to inspect followers, comments, reactions, spam candidates, or to perform a user-specified moderation/reply/reaction action.
---

# Changkyun ActivityPub Admin

Use this skill to operate the local `changkyun-admin` CLI for ActivityPub admin tasks.

## Scope

Supported workflows:

- View new followers
- View comments
- View reactions
- Identify spam candidates from comments or reactions
- Delete user-approved spam comments or reactions
- Reply to a specific comment with text provided by the user
- React to a specific comment with an emoji provided by the user
- Unfollow a specific follower when requested

This skill is an operator helper. Do not invent replies, reactions, or moderation actions. Always show the relevant items first and ask for or use the user's explicit instruction before sending a mutation.

## Commands

Run commands from the repository root.

```bash
pnpm --silent admin list followers --json
pnpm --silent admin list comments --json
pnpm --silent admin list reactions --json
pnpm --silent admin reply <comment-id> --text "<text from user>"
pnpm --silent admin react-comment <comment-id> "<emoji from user>"
pnpm --silent admin delete-comment <comment-id>
pnpm --silent admin delete-reaction <reaction-id>
pnpm --silent admin unfollow <follower-id>
```

If working against local dev instead of production:

```bash
ACTIVITYPUB_ADMIN_BASE_URL=http://localhost:3000 pnpm --silent admin list comments --json
```

## Workflow

1. Determine the target environment:
   - Default to production `https://changkyun.kim`.
   - Use `ACTIVITYPUB_ADMIN_BASE_URL=http://localhost:3000` only when the user asks for local/dev data.
2. Inspect before mutating:
   - followers: `pnpm --silent admin list followers --json`
   - comments: `pnpm --silent admin list comments --json`
   - reactions: `pnpm --silent admin list reactions --json`
3. Summarize the concrete items by `id`, actor, article path, and content/reaction.
4. For spam cleanup:
   - mark suspicious items as candidates only
   - do not delete until the user confirms exact IDs or gives a clear rule that maps to exact IDs
5. For comment replies:
   - use only the exact reply text supplied by the user
   - run `pnpm --silent admin reply <comment-id> --text "<text>"`
6. For comment reactions:
   - use only the exact emoji supplied by the user, or ask for one if missing
   - run `pnpm --silent admin react-comment <comment-id> "<emoji>"`
7. For followers:
   - list first
   - run `pnpm --silent admin unfollow <follower-id>` only after explicit instruction
8. Report executed commands and results concisely.

## Safety Rules

- Never generate an automatic public reply on behalf of the user.
- Never delete a comment or reaction from a vague spam suspicion alone.
- Never unfollow based only on a profile name or actor URL if the exact listed ID is ambiguous.
- Do not print private key material, `.env` contents, or raw secret values.
- Prefer JSON list commands for inspection so IDs are precise.
