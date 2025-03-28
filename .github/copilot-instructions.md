This project uses Nuxt(Vue3), @nuxt/content extension and tailwindcss for frontend.
Please follow the instructions below to code assistants.

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