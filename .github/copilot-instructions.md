This project uses Nuxt(Vue3), @nuxt/content extension and tailwindcss for frontend.
Please follow the instructions below to code assistants.

## ActivityPub

- Federation is implemented with the in-repo library `packages/activitypub` (`@changkyun/activitypub`, zero runtime dependencies, Web APIs only). Do not add Fedify or other ActivityPub frameworks.
- Server integration lives in `server/utils/fedify.ts` (actor, collections, inbox listeners, delivery, queue consumer) and `server/middleware/fedify.ts` (request routing). Documents are plain JSON objects; per-type `@context` values are in `server/utils/activityPubVocab.ts`.
- Keep emitted documents matching `tests/fixtures/golden` and run `pnpm test`.

## Code Style Guide

### Vue files

- Use `kebab-case` for file names and component names.
- Always use typescript with vue composition API.
- It does not required to import vue related features like `ref`, `computed`, `onMounted`, etc. in the script block. It will be automatically imported.
- Style components with postcss @apply in the `<style lang="postcss">` block. When writing styles, use tailwindcss classes and then use @apply to apply them to the component with nested selectors.

### Markdown files
- Insert spaces between markdown formattings like `**bold**` and `*italic*`.
- Allow use of mdc style components:
  ```markdown
  for block component:
  ::mdc-component
  inner body
  ::

  for inline component:
  :mdc-inline-componet{prop="value"}[inner body]:
  ```
- list of defined mdc components:
  - ui-button
  - ui-alert
  - ui-segment