---
name: create-blog-post
description: Create or update Nuxt Content blog posts from provided materials, reference URLs, and writing guidelines in this repository. Use when asked to write blog content under `content/` with Nuxt MDC-compatible Markdown frontmatter, Korean-by-default writing, image management under `public/`, and publish vs draft git workflows.
---

# Create Blog Post

## Goal

Create a high-quality blog post file in this repository using Nuxt Content Markdown (MDC-compatible) and valid frontmatter.

## Execute Workflow

1. Confirm writing inputs:
   - source materials, reference URLs, prompt/guidelines, audience, tone
   - publication intent: `publish`, `draft`, or content-only update
2. Set language:
   - write in Korean by default
   - switch language only when explicitly requested
3. Create path from date and slug:
   - directory: `content/blog/<YYYY-MM>/`
   - filename: `<DD>-<slug>.md`
4. Load and apply writing style rules from `references/writing-style.md`.
5. Write frontmatter and body in one `.md` file.
6. Add or create images when needed, then reference them with `/public` removed.
7. Run quick checks, then apply git flow only when requested.

## Apply Slug And File Rules

- Build `slug` using lowercase ASCII letters, digits, and hyphens.
- Remove symbols and spaces; collapse repeated hyphens.
- Prefer concise semantic English slug even for Korean title.
- Use the post date for both directory and filename day token.

Example:
- Date `2026-02-07`, slug `thinking-ai-writing`
- Output path `content/blog/2026-02/07-thinking-ai-writing.md`

## Use Nuxt Content Frontmatter

Use YAML frontmatter at the top.

```md
---
title: 글 제목
createdAt: 2026-02-07
coverImage: /blog/2026-02/thinking-ai-writing/cover.jpg
tags:
  - AI
  - Writing
---
```

Then write the article body in Markdown that is compatible with Nuxt Content MDC.

- Use standard headings, lists, tables, links, and fenced code blocks.
- Use MDC component syntax only when needed and keep syntax valid.
- Keep frontmatter YAML valid and stable.
- Follow style constraints in `references/writing-style.md`.

## Apply Writing Style Rules

- Treat `references/writing-style.md` as mandatory when writing or revising post bodies.
- Apply both English and Korean guidance from that file.
- Prefer natural, concrete Korean wording unless the user requests another tone.
- Avoid stale AI writing patterns and over-formal boilerplate phrasing.

## Manage Images

- Image source root is project `public/`.
- Save new assets under a clear path, for example:
  - `public/blog/<YYYY-MM>/<slug>/cover.jpg`
  - `public/blog/<YYYY-MM>/<slug>/diagram-01.png`
- In Markdown and `coverImage`, reference image paths without `/public`.
  - Correct: `![alt](/blog/2026-02/thinking-ai-writing/diagram-01.png)`
  - Incorrect: `![alt](/public/blog/...)`

If image is required:
- download from external source when appropriate, or
- generate with the `nano-banana` skill when available.

Prefer a wide image for `coverImage` when possible.

## Apply Publish/Draft Git Rules

Only apply git actions when the user explicitly requests publication mode.

- If user asks `게시` / `publish`:
  - commit on `main`
  - push directly to `origin/main`
- If user asks `임시글` / `draft`:
  - create branch `post/<slug>`
  - commit and push that branch
  - open a PR from `post/<slug>` to `main`

## Validate Before Finish

- Verify file path follows date + slug pattern.
- Verify frontmatter exists and parses.
- Verify Korean default language is respected.
- Verify all image links omit `/public`.
- Verify article satisfies provided source materials and guide prompt.
