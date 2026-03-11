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
4. Load and apply writing rules from:
   - `references/writing-style.md` for Markdown, diction, and source handling
   - `references/humanize-ai-writing.md` for AI-pattern removal and Korean examples
5. Write frontmatter and body in one `.md` file from the provided materials.
6. Run one mandatory humanization pass after drafting:
   - remove AI-sounding patterns, promotional filler, and vague authority claims
   - replace generic significance statements with concrete facts, tradeoffs, or sourced context
   - make the opening and ending sound authored, not templated
7. Add or create images when needed, then reference them with `/public` removed.
8. Run quick checks, then apply git flow only when requested.

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
- Follow humanization rules in `references/humanize-ai-writing.md`.

## Apply Writing Style Rules

- Treat `references/writing-style.md` and `references/humanize-ai-writing.md` as mandatory when writing or revising post bodies.
- Use `references/writing-style.md` for formatting, Korean-first diction, and source placement.
- Use `references/humanize-ai-writing.md` for pattern-level cleanup based on the Wikipedia AI-writing signs and the Humanizer workflow, adapted to Korean blog writing.
- Prefer natural, concrete Korean wording unless the user requests another tone.
- Avoid stale AI writing patterns and over-formal boilerplate phrasing.
- Do not stop at deleting bad phrases. Replace them with sourced specifics, real constraints, explicit tradeoffs, or a grounded author voice when the post format allows it.
- Keep the intended voice and meaning intact. Humanizing means rewriting for clarity and credibility, not inventing personal anecdotes or unsourced opinions.

## Remove AI Writing Signals

- Treat humanization as a required editing pass, not an optional polish step.
- Cut sentences that only announce importance, summarize obvious takeaways, or praise the subject without evidence.
- Prefer simple declarative Korean over translated abstractions such as "빠르게 변화하는 환경 속에서", "중요한 역할을 수행한다", "여정을 함께 살펴보자".
- Replace vague attributions like "업계에서는", "전문가들은", "많은 이들이" with named sources or verifiable facts.
- Break formulaic patterns such as forced three-item lists, "단순히 A가 아니라 B" contrasts, and generic "과제와 전망" sections unless the material truly requires them.
- When the draft feels clean but lifeless, use the guidance in `references/humanize-ai-writing.md` to add rhythm, specificity, and limited first-person judgment where appropriate for the blog voice.

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
- Verify the opening and ending are specific to the topic, not reusable AI templates.
- Verify vague praise, vague authority, and unsupported significance claims were removed or grounded in evidence.
- Verify the prose passes the humanization checklist in `references/humanize-ai-writing.md`.
