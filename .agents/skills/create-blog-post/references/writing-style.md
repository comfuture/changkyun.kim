# Writing Style Guide (EN + KO)

Use this guide whenever you draft or revise blog body content.

## 1) Markdown Link Style

- Do not overuse inline Markdown link syntax such as `[text](https://...)`.
- Allow inline Markdown links for external or internal links when the anchor text is part of a naturally readable sentence.
- For citation-only source references, mention the source in prose first, then place the raw URL on the next line or at the sentence end.
- Keep links readable and sparse.

Preferred:

```md
아래 내용은 Cloudflare 공식 문서를 참고했습니다.
https://developers.cloudflare.com/workers/

ActivityPub을 붙인 뒤에는 [댓글 안내 UI](/blog/2026-05/08-activitypub-fediverse-site)를 다시 손봤습니다.
```

Avoid:

```md
출처는 [여기](https://developers.cloudflare.com/workers/)와 [여기](/about)와 [여기](https://example.com)입니다.
```

## 2) Emphasis And Multibyte Text Safety

- Do not apply bold/italic formatting to long spans that include Korean (or other multibyte text), punctuation, symbols, or mixed tokens.
- Most Markdown renderers can break or render inconsistently for complex styled spans.
- Limit bold/italic to one or two short words only.

Preferred:

```md
핵심은 **속도**와 **재현성**입니다.
```

Avoid:

```md
** 안녕하세요 [저는] 아무개 입니다. Lorem ipsum/dolar amet (123, 456)**
```

## 3) Korean-First Diction (Default)

- Write in Korean unless the user explicitly requests another language.
- Use polite Korean style by default. Prefer `-습니다`, `-했습니다`, `-됩니다`, and `-합니다` over plain diary endings unless the user requests a different tone.
- Prefer natural Korean phrasing over literal translation from English.
- Use current general-purpose Korean rather than dated newspaper, bureaucratic, or literary stock language.
- Prefer an ordinary verb over a formal noun-plus-verb bundle when meaning stays intact: `개선을 진행했습니다` → `개선했습니다`, `영향을 미치게 됩니다` → `영향을 줍니다`.
- Replace old stock metaphors such as `초석`, `마중물`, `시금석`, `청사진`, `귀추가 주목된다` with the actual action, result, or remaining uncertainty.
- Avoid English-shaped slogans such as `게임 체인저`, `다음 단계로 끌어올리다`, or `새로운 가능성을 열다` unless they are quotations or established terms in the supplied voice.
- Do not add trendy slang, memes, or chat fillers just to make the writing sound young. Modern Korean here means current, idiomatic, and unforced.
- Keep sentence length moderate and direct.
- Prefer specific nouns and verbs over abstract filler.

Recommended Korean tone:

- polite but not ceremonial
- concrete, practical, and verifiable
- experience-led when the post is about something the author built or tried
- avoid exaggerated claims
- avoid repetitive transition clichés

## 4) Avoid Stale AI Writing Patterns

Use this section as a quick screen only. For the full anti-AI pattern catalog, Korean examples, and rewriting workflow, also load `references/humanize-ai-writing.md`.

Avoid old-fashioned AI boilerplate in both English and Korean.

Avoid patterns like:

- "In today's fast-paced world..."
- "Let's dive into..."
- "This blog post will explore..."
- "결론적으로 말하자면..." (repeated formulaic use)
- "빠르게 변화하는 시대에..." (generic opener)
- "혁신적인/획기적인" (when no evidence follows)

Replace with:

- direct context from the provided materials
- explicit scope and constraints
- concrete observations, examples, and tradeoffs
- a grounded author voice when the blog format allows it

## 5) Source Handling

- Cite only sources actually used.
- If a claim depends on a source, place the URL near that claim.
- Do not dump long link lists without context.

## 6) Formatting Quality Checks

Before finalizing:

- check for excessive `[text](url)` usage and rewrite to prose + URL
- check for long multi-token bold/italic spans and simplify
- check Korean wording for unnatural translated tone
- check for stale idioms, ceremonial wording, and unnecessary bureaucratic noun phrases
- remove repetitive AI-sounding sentence starters
- run the detailed cleanup pass in `references/humanize-ai-writing.md`
