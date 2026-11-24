# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development with hot reload
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Generate static site
pnpm generate

# Tests (node:test; server code runs against in-memory SQLite and a fake fediverse)
pnpm test

# Type check and lint
pnpm typecheck
pnpm lint
```

When making changes, ensure code follows the style guidelines below.

## Architecture Overview

This is a Nuxt 4-based personal website with ActivityPub federation capabilities. The project combines:
- **Frontend**: Vue 3 + Nuxt Content for blog/portfolio
- **Backend**: Nitro server (`cloudflare-module` preset) implementing the subset of ActivityPub the site uses
- **ActivityPub library**: `packages/activitypub` (`@changkyun/activitypub`), a zero-dependency in-repo library (HTTP Signatures, document loader, WebFinger, inbox pipeline, delivery helpers). Fedify is no longer used.
- **Database**: Cloudflare D1 (`DB`), plus KV (`FEDIFY_KV`, keys prefixed `ap:v1:`) and Queues (`FEDIFY_QUEUE` with DLQ `changkyun-kim-fedify-dlq`)
- **Deployment**: Cloudflare Workers via Wrangler

### Key Implementation Details

1. **ActivityPub Actor**: The site represents a single actor `@me` (changkyun.kim) whose profile is built in `server/utils/fedify.ts`
2. **Federation Endpoints**: `server/middleware/fedify.ts` classifies federation requests (`/@me`, `/@me/*`, `/inbox`, AP `Accept` on `/blog/**` and `/app/**`, blog alias hosts) and hands them to `handleFederationRequest()` in `server/utils/fedify.ts`
3. **Activity Processing**: Verified inbox activities are enqueued on `FEDIFY_QUEUE` and processed by the queue consumer (`server/plugins/fedify-cloudflare.ts`); deliveries are one queue message per target inbox with exponential backoff
4. **HTTP Signatures**: Incoming requests are verified with draft-cavage or RFC 9421 HTTP Signatures (no Linked Data signatures); outgoing requests are signed with the actor key from the `actor` table
5. **JSON-LD contexts**: `server/utils/activityPubVocab.ts` holds the exact `@context` values per document type; keep emitted documents matching `tests/fixtures/golden`

## Code Style Guidelines

### Vue Components
- Use **kebab-case** for file names and component names
- Always use **TypeScript with Composition API**
- Vue imports (`ref`, `computed`, etc.) are auto-imported - don't import manually
- Style with PostCSS `@apply` directive using TailwindCSS classes:
  ```vue
  <style lang="postcss">
  .component-class {
    @apply bg-white text-black;
  }
  </style>
  ```

### Markdown Content
- Add spaces around formatting: `**bold**` not `**bold**`
- MDC components are available:
  - Block: `::component-name` ... `::` 
  - Inline: `:component-name{prop="value"}[content]:`
  - Available: ui-button, ui-alert, ui-segment, x-notice

## Server Architecture

### Database Schema
```sql
-- activity table: stores all federation activities
CREATE TABLE activity (
  id INTEGER PRIMARY KEY,
  activity_id TEXT UNIQUE,
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  object TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- actor table: stores actor keys
CREATE TABLE actor (
  id INTEGER PRIMARY KEY,
  actor_id TEXT UNIQUE,
  private_key TEXT,
  public_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tasks and queue
Background tasks in `server/tasks/` (run by the `*/10 * * * *` cron):
- `ap:publishNewContent` - Sends `Create(Article)` for new content to followers and queues Bluesky shares
- `ap:crawlFeed` - Crawls connected actors' outboxes into the following feed
- `db:seed` - Initializes database schema

Queue messages (`FEDIFY_QUEUE`) are `{ v: 1, type: "deliver", inbox, activity }` and `{ v: 1, type: "inbox", activity }`; messages without `v` (old Fedify format) are acknowledged and dropped.

### API Patterns
Server routes use Nitro's event handlers:
```typescript
export default defineEventHandler(async (event) => {
  const db = await useDatabase();
  // Always return proper ActivityPub JSON-LD responses
  setHeader(event, 'Content-Type', 'application/activity+json');
  return { /* activity data */ };
});
```

## Project Structure

- `/content/` - Markdown files organized by type (blog posts by year/month)
- `/server/middleware/fedify.ts` - Federation request routing and the Nuxt Content → D1 dump sync
- `/server/utils/` - `fedify.ts` (actor, collections, inbox listeners, delivery, queue), `fedifyContent.ts` (Article/Create), `fedifyComments.ts`, `fedifyReactions.ts`, `activityPubFeed.ts`, `activityPubAdmin.ts`
- `/packages/activitypub/` - In-repo ActivityPub library (see its README for the supported subset)
- `/packages/admin/` - Local admin CLI
- `/tests/` - Regression tests and goldens recorded from the previous Fedify implementation
- `/components/content/` - MDC components for enhanced Markdown

When working on federation features, ensure:
1. Emitted documents keep the `@context` constants and match the goldens in `tests/fixtures/golden`
2. HTTP signatures are verified for incoming requests and the signer owns the activity actor
3. Rows written by older code (Fedify-compacted payload JSON) stay readable; the D1 schema is unchanged
