---
title: 블로그 글쓰기 스킬을 추가하며 정리한 작성 원칙
createdAt: 2026-02-07
coverImage: /blog/2026-02/create-blog-post-skill/cover.png
tags:
  - AI
  - Nuxt Content
  - Markdown
  - Writing
---
이번에 이 블로그 저장소에 `create-blog-post` 스킬을 추가했다. 목표는 간단하다. 글을 쓰는 순간부터 파일 경로, frontmatter, 스타일 가이드, 이미지 경로, 후속 작업까지 같은 기준으로 처리하는 것이다.

## Nuxt Content 규칙을 글쓰기 단계에 묶기

가장 먼저 정리한 부분은 파일 위치와 이름이다. 작성자마다 경로가 달라지면 검색, 정렬, 운영이 바로 불편해진다. 그래서 날짜 기반 디렉토리와 slug 규칙을 스킬 안에 고정했다.

```text
3. Create path from date and slug:
   - directory: `content/blog/<YYYY-MM>/`
   - filename: `<DD>-<slug>.md`
```

frontmatter도 Nuxt Content에서 바로 읽히도록 기본 형태를 템플릿으로 넣었다.

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

이렇게 해 두면 새 글을 만들 때 형식 고민이 줄고, 본문 내용에만 집중할 수 있다.

## 깨지지 않는 아시아권 문자와 마크다운 스타일링

한글, 일본어, 중국어처럼 멀티바이트 문자가 섞인 문장은 마크다운 강조 처리에서 렌더러별 차이가 자주 난다. 특히 괄호, 기호, 링크 문법이 같이 섞이면 스타일이 깨지거나 범위가 예상과 다르게 잡히는 경우가 있다.

그래서 스타일 가이드에 아래 규칙을 넣었다.

```text
- Do not apply bold/italic formatting to long spans that include Korean
  (or other multibyte text), punctuation, symbols, or mixed tokens.
- Limit bold/italic to one or two short words only.
```

링크도 같은 관점에서 다뤘다. 본문 가독성을 위해 인라인 링크 문법을 과도하게 쓰지 않고, 문장으로 출처를 말한 뒤 URL 자체를 붙이는 방식을 권장했다.

```text
- Do not overuse inline Markdown link syntax such as `[text](https://...)`.
- Mention the source in prose first, then place the raw URL.
```

## 전형적인 AI 글쓰기 냄새를 지우는 가이드라인

요즘 가장 빨리 티가 나는 부분은 문장 톤이다. 핵심이 없는 상투적인 도입, 과장된 형용사, 같은 전환 문장 반복이 나오면 사람이 쓴 글처럼 읽히기 어렵다.

그래서 스킬의 작성 기준에 오래된 AI 표현 회피 규칙을 넣었다.

```text
Avoid patterns like:
- "In today's fast-paced world..."
- "Let's dive into..."
- "This blog post will explore..."
- "빠르게 변화하는 시대에..."
- "혁신적인/획기적인" (when no evidence follows)
```

그리고 대체 원칙도 같이 둔다.

```text
Replace with:
- direct context from the provided materials
- explicit scope and constraints
- concrete observations, examples, and tradeoffs
```

핵심은 문장을 멋있게 꾸미는 것이 아니라, 읽는 사람이 바로 이해하고 검증할 수 있게 쓰는 것이다.

## 실제 적용 예시: 커버 이미지 생성 프롬프트

이번 글의 커버 이미지는 `nano-banana` 스킬로 생성했다. 스킬 문서에서 정한 대로 `public/` 아래에 저장하고, 본문에서는 `/public`을 제외한 경로를 사용했다.

아래는 실제로 사용한 프롬프트 일부다.

```text
A wide editorial blog cover illustration, Korean tech blog mood,
writing guidelines and markdown symbols on a desk,
laptop screen showing clean frontmatter YAML,
subtle banana sticker as tiny icon, flat modern vector style,
warm neutral colors, 16:9 composition
```

## 마무리

이번 `create-blog-post` 스킬은 글 한 편을 더 빠르게 쓰기 위한 도구라기보다, 저장소의 글 품질을 일정하게 유지하기 위한 안전장치에 가깝다. 형식은 자동으로 맞추고, 문장은 과장 없이 선명하게 쓰는 것. 그 두 가지를 계속 지키는 데 초점을 맞췄다.
