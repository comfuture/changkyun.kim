# Writing Style Guide (EN + KO)

Use this guide whenever you draft or revise blog body content.

## 1) Markdown Link Style

- Do not overuse inline Markdown link syntax such as `[text](https://...)`.
- Mention the source in prose first, then place the raw URL on the next line or at the sentence end.
- Keep links readable and sparse.

Preferred:

```md
아래 내용은 Cloudflare 공식 문서를 참고했다.
https://developers.cloudflare.com/workers/
```

Avoid:

```md
[Cloudflare 공식 문서](https://developers.cloudflare.com/workers/)
```

## 2) Emphasis And Multibyte Text Safety

- Do not apply bold/italic formatting to long spans that include Korean (or other multibyte text), punctuation, symbols, or mixed tokens.
- Most Markdown renderers can break or render inconsistently for complex styled spans.
- Limit bold/italic to one or two short words only.

Preferred:

```md
핵심은 **속도** 와 **재현성** 이다.
```

Avoid:

```md
** 안녕하세요 [저는] 아무개 입니다. Lorem ipsum/dolar amet (123, 456)**
```

## 3) Korean-First Diction (Default)

- Write in Korean unless the user explicitly requests another language.
- Prefer natural Korean phrasing over literal translation from English.
- Keep sentence length moderate and direct.
- Prefer specific nouns and verbs over abstract filler.

Recommended Korean tone:

- concrete, practical, and verifiable
- avoid exaggerated claims
- avoid repetitive transition clichés

## 4) Avoid Stale AI Writing Patterns

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

## 5) Source Handling

- Cite only sources actually used.
- If a claim depends on a source, place the URL near that claim.
- Do not dump long link lists without context.

## 6) Formatting Quality Checks

Before finalizing:

- check for excessive `[text](url)` usage and rewrite to prose + URL
- check for long multi-token bold/italic spans and simplify
- check Korean wording for unnatural translated tone
- remove repetitive AI-sounding sentence starters
