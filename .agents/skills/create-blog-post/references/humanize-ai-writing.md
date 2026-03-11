# Humanize AI-Sounding Blog Writing

Use this guide after the first draft and before final delivery. It is based on:

- Wikipedia: Signs of AI writing
  https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
- Humanizer skill by biostartechnology
  https://clawhub.ai/biostartechnology/humanizer

The original sources are mostly English-focused. This guide adapts the patterns to Korean blog writing in this repository. Treat these as heuristics, not rigid bans. If a pattern is justified by the source material, keep it. If it only makes the draft sound generic, cut it.

## Contents

1. Quick process
2. Core rules
3. Pattern catalog for Korean blog writing
4. Add voice without inventing facts
5. Final checklist

## 1. Quick Process

Run this pass after the draft exists.

1. Mark sentences that sound important but say little.
2. Replace broad claims with facts, names, dates, examples, constraints, or tradeoffs.
3. Remove repeated AI patterns such as vague praise, vague attribution, forced contrasts, and filler transitions.
4. Read the opening and ending again. Rewrite them if they could fit almost any article.
5. Check rhythm. Short and long sentences should mix naturally.

## 2. Core Rules

- Preserve the meaning, requested tone, and factual accuracy.
- Do not inject fake personal stories, fake certainty, or unsupported opinions.
- If a sentence can be deleted with no loss of information, delete it or replace it with something concrete.
- Prefer direct Korean verbs and nouns over translated abstractions.
- Use simple constructions when they are enough. Do not inflate a sentence to sound more "complete."
- A blog post may sound authored, but it should still stay grounded in the actual materials.

## 3. Pattern Catalog For Korean Blog Writing

The categories below merge the Wikipedia and Humanizer signals into patterns that show up often in Korean drafts.

### 3.1 Inflated significance and trend framing

Watch for:

- 중요한 역할을 한다
- 새로운 전환점이 되었다
- 더 큰 흐름을 보여준다
- 빠르게 변화하는 시대에
- 미래를 바꿀 가능성을 보여준다

Problem:

- The sentence claims historical or market significance without proving it.

Avoid:

```md
이 변화는 개발 문화의 새로운 전환점을 보여준다.
```

Prefer:

```md
이 변경으로 배포 시간이 14분에서 6분으로 줄었다. 팀이 체감하는 변화는 여기서 시작된다.
```

### 3.2 Promotional or advertisement-like wording

Watch for:

- 혁신적인
- 획기적인
- 강력한
- 매끄러운
- 인상적인
- 놀라운
- 완벽한 경험

Problem:

- Promotional adjectives replace actual evidence.

Avoid:

```md
이번 업데이트는 강력하고 직관적인 사용자 경험을 제공한다.
```

Prefer:

```md
이번 업데이트에는 일괄 처리, 키보드 단축키, 오프라인 편집이 추가됐다.
```

### 3.3 Vague attributions and anonymous authority

Watch for:

- 업계에서는
- 전문가들은
- 많은 사람들이
- 일각에서는
- 여러 자료에 따르면

Problem:

- Anonymous authority is a common AI shortcut.

Avoid:

```md
전문가들은 이 방식이 업계 전반에 큰 영향을 줄 것이라고 본다.
```

Prefer:

```md
Cloudflare는 2026년 2월 문서에서 이 방식을 권장했고, 우리 팀도 같은 이유로 캐시 무효화 횟수를 줄였다.
```

### 3.4 Connector chains and abstract process verbs

Watch for:

- 이를 통해
- 이를 바탕으로
- 나아가
- 더불어
- 동시에
- 하며
- 하면서
- 할 수 있다

Problem:

- Korean AI drafts often chain clauses to simulate depth while hiding the actual claim.

Avoid:

```md
이 구조는 운영 효율을 높이며 협업을 강화하고 확장성을 확보할 수 있다.
```

Prefer:

```md
이 구조를 쓰면 배포 권한을 서비스별로 나눌 수 있다. 그래서 운영 실수 범위가 줄고, 새 서비스도 같은 규칙으로 붙일 수 있다.
```

### 3.5 AI vocabulary clusters

Watch for repeated clusters such as:

- 핵심
- 중요
- 통찰
- 여정
- 풍경
- 정교한
- 역동적인
- 진화하는
- 강조하다
- 조명하다
- 보여주다
- 가치 있는

Problem:

- One word may be fine. A cluster of them usually signals generated prose.

Avoid:

```md
이번 프로젝트는 진화하는 AI 환경에서 중요한 통찰을 제공하는 핵심 사례다.
```

Prefer:

```md
이 프로젝트에서 확인한 건 두 가지다. 프롬프트를 길게 쓰는 것보다 평가 기준을 먼저 고정하는 편이 결과가 더 안정적이었다.
```

### 3.6 Forced contrast patterns

Watch for:

- 단순히 A가 아니라 B다
- A를 넘어 B다
- 단지 X에 그치지 않는다
- 이것은 단순한 기능이 아니다

Problem:

- These patterns are overused because they sound emphatic even when they add nothing.

Avoid:

```md
이 도구는 단순히 빌드 시간을 줄이는 것이 아니라 팀의 개발 문화를 바꾸는 장치다.
```

Prefer:

```md
이 도구를 도입한 뒤 빌드 대기 시간이 짧아졌다. 그 결과 리뷰가 같은 날 끝나는 경우가 많아졌다.
```

### 3.7 Rule of three and list-shaped thinking

Watch for:

- three-item slogans
- forced "첫째, 둘째, 셋째"
- bold label plus colon list items

Problem:

- AI drafts package ideas into neat triples even when the material does not require it.

Avoid:

```md
이 도입의 효과는 속도, 안정성, 확장성이다.
```

Prefer:

```md
가장 먼저 체감한 변화는 속도였다. 안정성은 한 달 정도 운영하면서 확인됐고, 확장성은 서비스 두 개를 더 붙였을 때 의미가 있었다.
```

### 3.8 Generic challenge or future-outlook sections

Watch for headings or paragraphs like:

- 과제와 전망
- 앞으로의 가능성
- 향후 기대 효과
- 미래를 위한 발걸음

Problem:

- These sections often appear because the model expects a complete essay shape, not because the source material supports one.

Avoid:

```md
물론 여전히 해결해야 할 과제가 있다. 그럼에도 앞으로의 전망은 밝다.
```

Prefer:

```md
남은 문제는 두 가지다. 배치 작업은 여전히 실패 원인을 찾기 어렵고, 모바일 편집 화면은 아직 느리다.
```

### 3.9 Chatbot residue and assistant tone

Watch for:

- 살펴보겠습니다
- 알아보겠습니다
- 도움이 되었길 바랍니다
- 추가로 궁금하시면
- 좋은 질문입니다
- 물론입니다

Problem:

- Chat-style residue breaks the illusion of authored content.

Avoid:

```md
이번 글에서는 이 문제를 함께 살펴보겠습니다.
```

Prefer:

```md
문제는 단순했다. 검색은 빨랐지만, 결과를 믿기 어려웠다.
```

### 3.10 Generic positive conclusions

Watch for:

- 앞으로가 기대된다
- 큰 가능성을 보여준다
- 의미 있는 진전이다
- 밝은 미래를 예고한다

Problem:

- Empty optimism is one of the easiest AI tells.

Avoid:

```md
이 실험은 앞으로의 가능성을 보여주는 의미 있는 진전이다.
```

Prefer:

```md
이번 실험으로 바로 바뀌는 건 없다. 다만 어떤 조건에서 실패하는지는 꽤 선명하게 보였다.
```

### 3.11 Over-clean but soulless writing

Watch for:

- every sentence has similar length
- no stance, no uncertainty, no tension
- all paragraphs sound like polished summaries

Problem:

- Removing AI markers is not enough. Sterile prose still feels machine-made.

Avoid:

```md
실험 결과는 흥미로웠다. 일부 팀은 긍정적으로 봤고, 일부 팀은 신중했다. 영향은 계속 지켜볼 필요가 있다.
```

Prefer:

```md
결과는 솔직히 예상보다 거칠었다. 잘 되는 조건은 분명했지만, 조금만 입력이 흔들려도 성능이 무너졌다. 그래서 이걸 바로 운영에 넣기는 어렵다고 봤다.
```

### 3.12 Formatting tells that often read as AI output

Watch for:

- excessive em dashes
- too much boldface
- emoji in headings or bullets
- headings that feel translated from English title case

Problem:

- Surface-level formatting can make an otherwise solid draft feel synthetic.

Avoid:

```md
## 새로운 워크플로우의 핵심 장점

- **속도:** 배포가 빨라졌다
- **안정성:** 오류가 줄었다
- **확장성:** 팀이 커져도 대응 가능하다
```

Prefer:

```md
## 새 워크플로에서 먼저 달라진 점

배포는 빨라졌고, 오류는 줄었다. 다만 팀 규모가 커졌을 때도 같은 구조가 유지되는지는 더 봐야 한다.
```

## 4. Add Voice Without Inventing Facts

When the draft is accurate but flat, use these adjustments.

- Have a point of view when the format allows it.
  Example: "이 접근이 항상 맞는 건 아니다. 그래도 팀 문서에는 잘 맞았다."
- Admit uncertainty where it is real.
  Example: "아직 장기 운영 데이터는 부족하다. 그래서 비용 절감 효과는 더 지켜봐야 한다."
- Use limited first person when it clarifies ownership.
  Example: "내가 가장 오래 붙잡고 있던 문제는 캐시 무효화 타이밍이었다."
- Vary sentence rhythm.
  Example: short sentence after a dense paragraph can reset pace.
- Prefer concrete feelings over generic evaluation.
  Example: "인상적이었다" instead of "놀라웠다" is still weak. Better: "로그를 처음 열었을 때 실패 원인이 한 줄로 드러난 점이 좋았다."

Do not force personality into neutral documentation. This skill is for blog posts, so moderate voice is allowed. It still has to sound like a person who actually read the source material.

## 5. Final Checklist

Before you finish, verify all of the following:

- The opening starts from a specific fact, scene, problem, or question tied to the materials.
- The ending lands on a specific implication, limitation, or next step.
- Broad claims of importance are backed by evidence or removed.
- Vague authorities were replaced with named sources, dates, teams, or direct observations.
- Repeated connectors like "또한", "나아가", "더불어", "이를 통해" were reduced.
- Formulaic contrasts like "단순히 A가 아니라 B" were rewritten unless the contrast is essential.
- Promotional adjectives were replaced with features, metrics, or observed outcomes.
- Sentence length varies enough to sound read-aloud natural.
- The article keeps a Korean-first voice rather than translated English rhythm.
- No chatbot residue remains in the article body.
