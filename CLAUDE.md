# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development with hot reload
yarn dev

# Production build
yarn build

# Start production server
yarn start

# Generate static site
yarn generate
```

Note: No linting or testing commands are configured. When making changes, ensure code follows the style guidelines below.

## Architecture Overview

This is a Nuxt 3-based personal website with ActivityPub federation capabilities. The project combines:
- **Frontend**: Vue 3 + Nuxt Content for blog/portfolio with static generation support
- **Backend**: Nitro server implementing ActivityPub protocol for social federation
- **Database**: SQLite (via Cloudflare D1) for storing federation data
- **Deployment**: NuxtHub with automated GitHub Actions CI/CD

### Key Implementation Details

1. **ActivityPub Actor**: The site represents a single actor `@me` (changkyun.kim) with hardcoded profile in `server/utils/federation.ts`
2. **Federation Endpoints**: Located at `/@me/*` including inbox, outbox, followers, following
3. **Activity Processing**: Inbox accepts Follow activities and auto-responds with Accept via task queue
4. **HTTP Signatures**: All incoming federation requests are verified using RSA signatures

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

### Task Queue
Background tasks in `server/tasks/`:
- `ap:sendActivity` - Delivers activities to remote servers
- `db:seed` - Initializes database schema

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
- `/server/routes/@me/` - ActivityPub federation endpoints
- `/server/utils/` - Core utilities including federation.ts (actor profile) and auth.ts (signatures)
- `/components/content/` - MDC components for enhanced Markdown

## Current Development Focus

Based on git status, active work includes:
- ActivityPub activity delivery system (`server/tasks/ap/deliver.ts`)
- Authentication utilities (`server/utils/auth.ts`)
- Follow request handling with signature verification

When working on federation features, ensure:
1. All activities include proper `@context` and JSON-LD headers
2. HTTP signatures are verified for incoming requests
3. Database operations handle both activity storage and actor key management