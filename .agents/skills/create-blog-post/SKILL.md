---
name: create-blog-post
description: Create or update Nuxt Content blog posts from provided materials, reference URLs, translations, and writing guidelines in this repository. Use when asked to write or revise content under `content/` with Nuxt MDC-compatible Markdown frontmatter, natural modern Korean by default, reader mental-model tracking, AI-pattern cleanup, image management under `public/`, and publish vs draft git workflows.
---

# Create Blog Post

## Goal

Create a high-quality blog post file in this repository using Nuxt Content Markdown (MDC-compatible) and valid frontmatter.

## Execute Workflow

1. Confirm writing inputs:
   - source materials, reference URLs, prompt/guidelines, audience, tone
   - a user-provided or local writing sample when one exists
   - what the target reader can already be expected to know and what the post should help them understand
   - publication intent: `publish`, `draft`, or content-only update
2. Set language:
   - write in Korean by default
   - use Korean polite style (`존댓말`) by default
   - switch language only when explicitly requested
3. Create path from date and slug:
   - directory: `content/blog/<YYYY-MM>/`
   - filename: `<DD>-<slug>.md`
4. Load and apply writing rules from:
   - `references/writing-style.md` for Markdown, diction, and source handling
   - `references/humanize-ai-writing.md` for AI-pattern removal and Korean examples
5. Map the target reader's mental progression, then write frontmatter and body in one `.md` file from the provided materials.
6. Audit whether each major section gives the reader the visible evidence needed for its intended understanding or inference.
7. Run one mandatory humanization pass after drafting:
   - remove AI-sounding patterns, promotional filler, and vague authority claims
   - replace generic significance statements with concrete facts, tradeoffs, or sourced context
   - separate supplied facts from supplied rhetoric; do not preserve an unsupported benefit claim merely because it appeared in the draft
   - replace literal English calques, stale journalistic idioms, and ceremonial Korean with current everyday professional Korean
   - preserve the source coverage and the author's recognizable voice instead of merely shortening the draft
   - make the opening and ending sound authored, not templated
8. Add or create images when needed, then reference them with `/public` removed.
9. Run quick checks, then apply git flow only when requested.

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
- For fenced code blocks, always specify the source language when it is known.
- When the code is tied to a file, include the filename in Nuxt MDC code-fence metadata.
- Prefer explicit code-fence metadata over relying on automatic language detection.
- Use MDC component syntax only when needed and keep syntax valid.
- Keep frontmatter YAML valid and stable.
- Follow style constraints in `references/writing-style.md`.
- Follow humanization rules in `references/humanize-ai-writing.md`.

Code fence examples:

````md
```python [hello.py]
print("hello")
```

```ts [server/api/example.get.ts]
export default defineEventHandler(() => ({ ok: true }))
```
````

## Apply Writing Style Rules

- Treat `references/writing-style.md` and `references/humanize-ai-writing.md` as mandatory when writing or revising post bodies.
- Use `references/writing-style.md` for formatting, Korean-first diction, and source placement.
- Use `references/humanize-ai-writing.md` for pattern-level cleanup based on the Wikipedia AI-writing signs and the Humanizer workflow, adapted to Korean blog writing.
- Prefer natural, concrete Korean wording unless the user requests another tone.
- Use polite Korean endings by default (`-습니다`, `-했습니다`, `-됩니다`, `-합니다`) without making the prose stiff.
- Match a user-provided writing sample before applying the default voice. Calibrate sentence length, paragraph openings, word choice, punctuation, and transition habits without copying verbal tics mechanically.
- Use current general-purpose Korean. Avoid dated newspaper, bureaucratic, or literary stock phrases unless the subject or supplied voice calls for them.
- Do not imitate youthfulness with slang, memes, or conversational fillers that are absent from the author's voice.
- Avoid stale AI writing patterns and over-formal boilerplate phrasing.
- Do not stop at deleting bad phrases. Replace them with sourced specifics, real constraints, explicit tradeoffs, or a grounded author voice when the post format allows it.
- Keep the intended voice and meaning intact. Humanizing means rewriting for clarity and credibility, not inventing personal anecdotes or unsourced opinions.
- Preserve sourced facts and material points, not promotional claims that the materials do not support. If evidence covers only one claimed benefit, state that boundary instead of extending it to team behavior or broader impact.
- For personal build logs and retrospectives with no stronger tone request, use `content/blog/2026-05/08-activitypub-fediverse-site.md` as a local voice model: polite, plain, experience-led writing with ordinary sentence headings and only as much technical detail as the story needs. For other genres, borrow its directness and specificity without forcing a first-person build-log structure.

## Track The Reader's Mental Model

Use this to control comprehension and the delivery of the post's subject through its explanatory or narrative sequence. Do not turn the post into fiction or manufacture conflict and suspense.

Treat the reader model as an editorial hypothesis about a defined target reader, not as a claim about every reader. Before drafting, identify:

- what the target reader probably knows, believes, or can recall;
- which unfamiliar terms or assumptions need a familiar anchor;
- the main understanding the post should make possible;
- which questions the post must answer and which are honestly outside its scope.

Before ordering the material, classify each important statement by its role:

- **Author action or observation:** what the author did, saw, measured, or experienced.
- **Explicit non-action or scope boundary:** what the author did not do, test, measure, or claim.
- **Sourced fact:** what comes from a named source and requires attribution.
- **Assumed shared knowledge:** what this target reader can reasonably be expected to know already; do not silently assume specialist knowledge.
- **New finding or interpretation:** what the author learned or concluded from the work; keep its supporting evidence visible and distinguish observation from interpretation.

Do not flatten statements with different roles into one equal-weight list, paragraph, or diagram label. Their relationships and evidence boundaries are part of the explanation.

Keep the writer's available knowledge separate from the reader's state:

- **Writer or source knowledge:** material available while writing; it is not reader knowledge unless the post exposes it.
- **Reader-visible evidence:** facts, examples, definitions, comparisons, and causal links actually present in the post.
- **Expected understanding or inference:** what the target reader can reasonably conclude from that evidence; treat this as a hypothesis to verify.

For each major section, map:

`entry understanding → familiar anchor → reader-visible evidence → intended update → remaining question`

Apply these rules:

- Establish a rough but coherent picture before adding fine detail. Attach each new fact to a concept, question, example, or distinction already available to the reader.
- Give each section one primary conceptual update. It may contain several facts, but the reader should have one dominant change to integrate.
- Move from a familiar anchor to a new fact or observation, then to its meaning, implication, or practical consequence.
- Check adjacent sections with: `Because the reader has seen X, they can understand Y as Z; therefore the next section can address Q.`
- If that sentence depends on a fact found only in source notes, add the necessary reader-visible evidence, reorder the sections, or narrow the intended conclusion.
- Let the reader use a new concept in an example, comparison, decision, or interpretation before introducing another dense concept.
- Arrange information so the reader can anticipate, test, refine, or revise the emerging picture. A justified reframe is useful; a surprise caused by omitted premises is not.
- Treat unexplained terms and missing causal links as information debt. Split or sequence a section that asks readers to absorb several unrelated new concepts at once.
- Preserve useful inference and intellectual payoff. Do not restate a connection the evidence already makes clear unless confirmation is necessary for accuracy.
- Preserve the author's taste in sequence, emphasis, and pacing. Do not replace a deliberate progression with a generic inventory of facts or formulaic headings.

After drafting, review only the post text and complete these checks for each major section:

- The reader can now explain ...
- The reader is likely to conclude ... because ...
- The reader still needs to know ...
- The next section follows from this understanding because ...

Repair the smallest broken link. Prefer reordering, adding one concrete fact or example, attaching a new term to a familiar concept, splitting an overloaded section, or deleting noise over adding broad explanatory filler.

## Remove AI Writing Signals

- Treat humanization as a required editing pass, not an optional polish step.
- Cut sentences that only announce importance, summarize obvious takeaways, or praise the subject without evidence.
- Prefer simple declarative Korean over translated abstractions such as "빠르게 변화하는 환경 속에서", "중요한 역할을 수행한다", "여정을 함께 살펴보자".
- Rewrite stiff stock wording such as `~에 있어`, `~을 도모하다`, `귀추가 주목된다`, and `초석이 되다` with the concrete action or result meant in context.
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
- first consider generating it with Codex's built-in image generation capability (`imagegen` / Imagen2) when the requested image can be created directly.
- download from an external source when an existing real-world image, screenshot, logo, product photo, or specifically sourced visual is more appropriate.
- fall back to another available image-generation workflow such as `nano-banana` only when built-in image generation is unavailable or inadequate for the requested asset.

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
- Verify the post uses Korean polite style unless the user explicitly requested another tone.
- Verify all image links omit `/public`.
- Verify Markdown links follow `references/writing-style.md`: natural inline links are allowed, but source dumps and citation-only links stay readable.
- Verify fenced code blocks specify the language when known, and include filename metadata such as ` ```python [hello.py] ` when the code belongs to a file.
- Verify article satisfies provided source materials and guide prompt.
- Verify the opening and ending are specific to the topic, not reusable AI templates.
- Verify vague praise, vague authority, and unsupported significance claims were removed or grounded in evidence.
- Verify measured results were not stretched into unmeasured claims about quality, culture, adoption, or future impact.
- Verify every intended reader inference has reader-visible evidence in the post rather than only in source notes.
- Verify each major section changes or deepens the reader's understanding without unsupported leaps, overload, inert repetition, or unnecessary over-explanation.
- Verify the prose passes the humanization checklist in `references/humanize-ai-writing.md`.
- Verify Korean wording sounds current and idiomatic when read aloud, without stale idioms, literal English syntax, or forced slang.
