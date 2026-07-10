# Humanize AI-Sounding Blog Writing

Use this guide after the first draft and before final delivery. It is based on:

- Wikipedia: Signs of AI writing
  https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
- Humanizer skill by blader
  https://github.com/blader/humanizer/blob/main/SKILL.md

The original sources are mostly English-focused. This guide adapts the patterns to Korean blog writing in this repository. Treat these as heuristics, not rigid bans. If a pattern is justified by the source material, keep it. If it only makes the draft sound generic, cut it.

## Contents

1. Quick process
2. Core rules
3. Calibrate voice and register
4. Default blog voice model
5. Pattern catalog for Korean blog writing
6. Use modern Korean without sounding forced
7. Avoid false positives and overcorrection
8. Add voice without inventing facts
9. Final checklist

## 1. Quick Process

Run this pass after the draft exists.

1. Mark sentences that sound important but say little.
2. Separate verifiable facts from the draft's interpretations, praise, predictions, and filler.
3. Replace broad claims with facts, names, dates, examples, constraints, or tradeoffs.
4. Remove repeated AI patterns such as vague praise, vague attribution, forced contrasts, and filler transitions.
5. Check whether the wording sounds translated, ceremonial, bureaucratic, or dated to a current Korean reader.
6. Read the opening and ending again. Rewrite them if they could fit almost any article.
7. Read the draft aloud. Fix uniform rhythm, awkward clause chains, and words the intended author would not normally say.
8. Compare the final version with the source. Keep every material fact and point unless the user asked for a shorter piece; do not preserve unsupported rhetoric as fact.

## 2. Core Rules

- Preserve the meaning, requested tone, and factual accuracy.
- Treat the source draft as material, not as proof. Preserve concrete facts, but remove or qualify claims that the supplied evidence does not support.
- Do not inject fake personal stories, fake certainty, or unsupported opinions.
- If a sentence can be deleted with no loss of information, delete it or replace it with something concrete.
- Prefer direct Korean verbs and nouns over translated abstractions.
- Use simple constructions when they are enough. Do not inflate a sentence to sound more "complete."
- A blog post may sound authored, but it should still stay grounded in the actual materials.
- Use Korean polite style by default unless the user explicitly asks otherwise. Polite style should still sound plain and direct, not ceremonial.
- Rewrite rather than merely delete. Removing every imperfect or idiosyncratic sentence often produces a shorter but equally synthetic summary.
- Treat patterns as clusters. One transition, formal word, em dash, or rhetorical question does not prove that a sentence needs rewriting.

## 3. Calibrate Voice And Register

If the user supplies their own writing sample, read it before revising the draft. If no sample is supplied, use the local voice model in the next section.

Note the following before editing:

- how long sentences and paragraphs tend to be
- whether paragraphs start directly or with a short setup
- whether the writer uses first person, and how often
- which level of technical vocabulary the writer keeps without explanation
- how the writer moves between ideas: explicit connectors, a new paragraph, or a short sentence
- punctuation, parenthetical asides, and recurring expressions

Match those habits only where they help the current article. Do not copy typos or repeat a verbal tic on a schedule. Do not upgrade plain words into formal ones simply because the rewrite should look polished.

Choose the register from the post's actual setting:

- For a build log or personal essay, allow first-person judgment, hesitation, and uneven rhythm when supported by the materials.
- For a technical explanation, keep the language neutral and direct. Personality does not require jokes or opinions in every section.
- For translation, preserve the source's intent and level of formality, then rewrite the sentence into idiomatic Korean syntax. Do not preserve English clause order at the cost of natural Korean.
- When the intended readers are not specified, prefer contemporary professional Korean: polite, clear, and ordinary enough to say aloud.

## 4. Default Blog Voice Model

For a personal build log or retrospective with no stronger user-provided tone, use the May 2026 Fediverse post (`content/blog/2026-05/08-activitypub-fediverse-site.md`) as the local voice model. For explanations, reviews, or reported pieces, borrow its plain wording and specificity without forcing a first-person project narrative.

Use this shape:

- Start from what changed or what the author tried, not from a broad industry trend.
- Keep the article experience-led: what the author wanted, what they tried first, where the work became larger than expected, what they chose next, and what changed after that.
- Use first person when it clarifies ownership: `제 사이트`, `제가 하려던 일`, `저는 ... 싶지는 않았습니다`.
- Prefer ordinary sentence headings such as `댓글과 반응은 Fediverse 계정으로 남깁니다` over slogan-like headings.
- Use fewer sections when the flow is already clear. Let adjacent ideas sit in the same section when they are part of one experience.
- Explain technical terms briefly, then return to the author’s decision or operating experience.
- End with the present state, limitation, or next thing to watch. Do not force a grand conclusion.

Prefer:

```md
하고 싶었던 일은 단순했습니다. 블로그 글을 올렸을 때 각자 원래 쓰던 계정으로 답글을 달 수 있게 만들고 싶었습니다.
```

Avoid:

```md
이번 글에서는 개인 웹사이트와 분산형 소셜 네트워크의 결합이 갖는 의미를 살펴보겠습니다.
```

## 5. Pattern Catalog For Korean Blog Writing

The categories below merge the Wikipedia and Humanizer signals into patterns that show up often in Korean drafts.

### 5.1 Inflated significance and trend framing

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
이 변경으로 배포 시간이 14분에서 6분으로 줄었습니다. 오전 배포가 점심시간을 넘기는 일도 없어졌습니다.
```

### 5.2 Promotional or advertisement-like wording

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
이번 업데이트에는 일괄 처리, 키보드 단축키, 오프라인 편집이 추가됐습니다.
```

### 5.3 Vague attributions and anonymous authority

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
Cloudflare는 2026년 2월 문서에서 이 방식을 권장했고, 저도 같은 이유로 캐시 무효화 횟수를 줄였습니다.
```

### 5.4 Connector chains and abstract process verbs

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
이 구조를 쓰면 배포 권한을 서비스별로 나눌 수 있습니다. 그래서 운영 실수 범위가 줄고, 새 서비스도 같은 규칙으로 붙일 수 있습니다.
```

### 5.5 AI vocabulary clusters

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
프롬프트를 길게 쓰는 것보다 평가 기준을 먼저 고정하는 편이 결과가 더 안정적이었습니다.
```

### 5.6 Forced contrast patterns

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
이 도구를 도입한 뒤 빌드 대기 시간이 짧아졌습니다. 그 결과 리뷰가 같은 날 끝나는 경우가 많아졌습니다.
```

### 5.7 Rule of three and list-shaped thinking

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
가장 먼저 체감한 변화는 속도였습니다. 안정성은 한 달 정도 운영하면서 확인됐고, 확장성은 서비스 두 개를 더 붙였을 때 의미가 있었습니다.
```

### 5.8 Generic challenge or future-outlook sections

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
남은 문제는 두 가지입니다. 배치 작업은 여전히 실패 원인을 찾기 어렵고, 모바일 편집 화면은 아직 느립니다.
```

### 5.9 Chatbot residue and assistant tone

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
문제는 단순했습니다. 검색은 빨랐지만, 결과를 믿기 어려웠습니다.
```

### 5.10 Generic positive conclusions

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
이번 실험으로 바로 바뀌는 건 없습니다. 다만 어떤 조건에서 실패하는지는 꽤 선명하게 보였습니다.
```

If the source says only that `과제가 남아 있습니다` without naming one, do not replace it with another vague promise such as `하나씩 개선해 나가겠습니다`. End on the last verified result, or state exactly which claimed result still needs measurement.

### 5.11 Over-clean but soulless writing

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
결과는 솔직히 예상보다 거칠었습니다. 잘 되는 조건은 분명했지만, 조금만 입력이 흔들려도 성능이 무너졌습니다. 그래서 이걸 바로 운영에 넣기는 어렵다고 봤습니다.
```

### 5.12 Formatting tells that often read as AI output

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

배포는 빨라졌고, 오류는 줄었습니다. 다만 팀 규모가 커졌을 때도 같은 구조가 유지되는지는 더 봐야 합니다.
```

### 5.13 Information gaps and stacked hedging

Watch for:

- 공개된 정보는 많지 않지만
- 업계에서 활동해 온 것으로 보인다
- 어느 정도 영향을 줄 수도 있을 것으로 예상된다
- 개인적인 삶은 베일에 싸여 있다

Problem:

- Generated prose often fills a missing fact with plausible biography or piles up qualifiers to avoid making a clear claim.

Avoid:

```md
공개된 정보는 많지 않지만, 그는 평범한 환경에서 성장하며 기술에 관심을 키운 것으로 보입니다.
```

Prefer:

```md
공개된 자료에서는 그의 성장 배경을 확인할 수 없었습니다.
```

If the missing information does not matter, omit the sentence. Do not turn absence into a personality trait or backstory.

### 5.14 Synonym cycling and false ranges

Watch for:

- referring to the same person as `사용자`, `이용자`, `고객`, and `소비자` without a real distinction
- changing a technical term only to avoid repetition
- `A부터 B까지`, `X에서 Y에 이르기까지` when the endpoints do not form a meaningful scale or sequence

Problem:

- Forced variation makes references less precise. False ranges make a list sound larger than it is.

Avoid:

```md
이 글은 모델 선택부터 팀 문화에 이르기까지 AI 개발의 모든 여정을 다룹니다. 사용자는 모델을 고르고, 이용자는 결과를 검토합니다.
```

Prefer:

```md
이 글은 모델 선택과 결과 검토 과정을 다룹니다. 두 단계 모두 같은 사용자가 진행합니다.
```

### 5.15 Hidden actors and noun-heavy sentences

Watch for:

- 검토가 진행되었습니다
- 개선이 이루어졌습니다
- 지원 제공이 가능합니다
- 문제 해결을 위한 논의가 수행되었습니다

Problem:

- Passive or noun-heavy wording can hide who acted and turn a simple event into administrative prose.

Avoid:

```md
배포 과정에 대한 검토가 진행되었고 오류 메시지의 개선이 이루어졌습니다.
```

Prefer:

```md
팀은 배포 과정을 검토하고 오류 메시지를 고쳤습니다.
```

Korean naturally omits subjects when context is clear. Add the actor only when it removes ambiguity; do not repeat `팀은` or `저는` in every sentence.

### 5.16 Authority tropes and section announcements

Watch for:

- 본질적으로
- 진짜 중요한 것은
- 핵심을 짚자면
- 이제 자세히 살펴보겠습니다
- 먼저 알아야 할 점은

Problem:

- These phrases claim authority or announce the next paragraph instead of stating the point.

Avoid:

```md
본질적으로 진짜 중요한 것은 운영 준비도입니다. 이제 그 이유를 자세히 살펴보겠습니다.
```

Prefer:

```md
도입 시점은 운영팀이 장애 대응 절차를 마련한 뒤로 잡았습니다.
```

### 5.17 Fragmented headings and change-log narration

Watch for:

- a heading followed by one sentence that merely repeats it
- prose that says a feature was `새로 추가되었다` or `기존 방식에서 변경되었다` when the article is not a release note or migration guide

Problem:

- Empty lead-ins pad the section. Diff-anchored prose becomes stale as soon as the reader loses the commit context.

Avoid:

```md
## 캐시가 빨라졌습니다

캐시 성능은 중요합니다.

이번에 새로 추가된 해시 맵 방식은 기존의 전체 순회 방식을 대체했습니다.
```

Prefer:

```md
## 캐시 조회를 해시 맵으로 바꿨습니다

해시 맵에서 키를 바로 찾기 때문에 항목 전체를 순회하지 않습니다.
```

Change-oriented wording is appropriate in release notes, retrospectives, and migration posts. Use it there deliberately.

### 5.18 Manufactured drama, aphorisms, and fake-candid hooks

Watch for:

- several short fragments in a row: `규칙은 끝났습니다. 완전히. 영원히.`
- reusable profundity: `데이터는 신뢰의 언어다`, `효율은 때로 함정이 된다`
- theatrical openers: `솔직히 말하면`, `재미있는 건`, `왜일까요? 답은 간단합니다`

Problem:

- Generated prose often manufactures a quotable rhythm or intimacy around an ordinary observation.

Avoid:

```md
왜일까요? 답은 간단합니다. 데이터는 팀 신뢰의 언어이기 때문입니다. 이제 추측은 끝났습니다. 완전히.
```

Prefer:

```md
대시보드에 실패 건수와 원인을 함께 표시한 뒤에는 팀이 같은 수치를 놓고 장애를 논의할 수 있었습니다.
```

One short sentence, metaphor, or candid aside can fit a real voice. Rewrite it only when several devices stack up or the sentence avoids a concrete claim.

## 6. Use Modern Korean Without Sounding Forced

Modern Korean means wording that a current Korean speaker could use naturally in a professional blog. It does not mean banmal, internet slang, or replacing every technical term with a native Korean coinage.

Use these as contextual rewrites, not a mechanical replacement table:

| Stale or stiff wording | Prefer in ordinary blog prose |
| --- | --- |
| 금번 업데이트 | 이번 업데이트 |
| 본고에서는 세 가지 방안을 살펴보고자 합니다 | 세 가지 방안을 비교했습니다 |
| 상기 기능 | 앞에서 설명한 기능, 또는 기능 이름 |
| 개발 과정에 있어 | 개발할 때, 개발 과정에서는 |
| 검토를 진행했습니다 | 검토했습니다 |
| 성능 개선을 도모했습니다 | 성능을 개선했습니다 |
| 기능 제공이 가능합니다 | 기능을 제공합니다, 사용할 수 있습니다 |
| 문제 해결이 이루어졌습니다 | 문제를 해결했습니다, 필요하면 행위자 명시 |
| 사용자 경험을 한 단계 끌어올립니다 | 어느 단계가 짧아지거나 쉬워졌는지 구체적으로 쓰기 |
| 향후 귀추가 주목됩니다 | 아직 확인해야 할 조건을 구체적으로 쓰기 |
| 중요한 시사점을 제공합니다 | 결과에서 실제로 확인한 내용 쓰기 |
| 앞으로의 초석이나 마중물이 됩니다 | 다음에 할 일이나 필요한 선행 조건 쓰기 |

Apply these principles:

- Prefer `했습니다`, `됐습니다`, and `쓸 수 있습니다` over ceremonial forms such as `하였습니다`, `되었습니다`, and `사용이 가능합니다` when the post does not require a formal report register.
- Prefer a direct verb over `명사 + 진행하다/수행하다/도모하다/제공하다` when the noun carries the real action.
- Use familiar loanwords and established technical terms when readers actually use them: `워크플로`, `엔드포인트`, `캐시`, `프레임워크`. Do not force an obscure Korean substitute or append the English spelling every time.
- Translate meaning, not English word order. Split a long relative clause, move context earlier, or omit a repeated subject when that is more natural in Korean.
- Replace English-shaped slogans such as `게임 체인저`, `다음 단계로 끌어올리다`, `새로운 가능성을 열다`, and `그 어느 때보다 중요하다` with the actual change or constraint.
- Use idioms only when the intended author would choose them. Avoid stock metaphors such as `명과 암`, `두 마리 토끼`, `청사진`, `시금석`, and `괄목할 만한` as generic decoration.
- Keep honorific level consistent. Do not alternate `-습니다`, `-해요`, plain style, and archaic endings merely to create variety.
- Do not make prose younger by adding `사실`, `솔직히`, `꽤`, `느낌`, memes, or chat fillers on a schedule. A modern voice is unforced, not trend-chasing.

Read the final Korean aloud. If a phrase is technically correct but sounds like a translated press release, rewrite the sentence around who did what and what changed.

## 7. Avoid False Positives And Overcorrection

Do not flatten legitimate prose just to make it pass a detector. Judge patterns in context and look for clusters.

Do not flag these on their own:

- polished grammar or a consistent style
- one formal or academic term that is precise for the topic
- one common connector such as `하지만`, `또한`, or `따라서`
- one short emphatic sentence, metaphor, rhetorical question, em dash, or curly quotation mark
- first person in an authored blog, or its absence in a neutral technical explanation
- a passive sentence whose actor is unknown or genuinely unimportant
- subject omission, which is ordinary Korean when the referent is clear
- repeated `-습니다` endings; fix monotonous sentence structure, not the polite ending itself
- a quotation, title, proper name, or established technical term that contains a watched expression

Preserve these human signals when they are truthful and relevant:

- exact dates, measurements, locations, commands, error messages, and other hard-to-fake details
- mixed feelings, unresolved tradeoffs, and honest uncertainty
- first-person editorial decisions that the supplied materials support
- genuine asides or self-corrections that fit the author
- natural variation in paragraph and sentence length
- a writer's deliberate repetition of the same precise noun

The source material still controls factual quality. An unsourced claim is not proof of AI writing, but the blog should not present it as verified fact. Name the uncertainty, find a source, or omit the claim.

Use the Humanizer process internally: draft, audit the remaining pattern clusters, revise, and read again. Deliver only the finished blog post unless the user asks to see the editing notes.

## 8. Add Voice Without Inventing Facts

When the draft is accurate but flat, use these adjustments.

- Have a point of view when the format allows it.
  Example: "이 접근이 항상 맞는 건 아닙니다. 그래도 팀 문서에는 잘 맞았습니다."
- Admit uncertainty where it is real.
  Example: "아직 장기 운영 데이터는 부족합니다. 그래서 비용 절감 효과는 더 지켜봐야 합니다."
- Use limited first person when it clarifies ownership.
  Example: "제가 가장 오래 붙잡고 있던 문제는 캐시 무효화 타이밍이었습니다."
- Vary sentence rhythm.
  Example: short sentence after a dense paragraph can reset pace.
- Prefer concrete feelings over generic evaluation.
  Example: "인상적이었습니다" instead of "놀라웠습니다" is still weak. Better: "로그를 처음 열었을 때 실패 원인이 한 줄로 드러난 점이 좋았습니다."

Do not force personality into neutral documentation. This skill is for blog posts, so moderate voice is allowed. It still has to sound like a person who actually read the source material.

## 9. Final Checklist

Before you finish, verify all of the following:

- The opening starts from a specific fact, scene, problem, or question tied to the materials.
- The ending lands on a specific implication, limitation, or next step.
- Broad claims of importance are backed by evidence or removed.
- A measured improvement in one metric was not expanded into unmeasured claims about accuracy, adoption, team culture, or future impact.
- Vague authorities were replaced with named sources, dates, teams, or direct observations.
- Repeated connectors like "또한", "나아가", "더불어", "이를 통해" were reduced.
- Formulaic contrasts like "단순히 A가 아니라 B" were rewritten unless the contrast is essential.
- Promotional adjectives were replaced with features, metrics, or observed outcomes.
- Sentence length varies enough to sound read-aloud natural.
- The article keeps a Korean-first voice rather than translated English rhythm.
- The Korean diction sounds current and idiomatic, without stale journalistic metaphors, ceremonial forms, or avoidable noun-heavy phrasing.
- Established technical terms remain recognizable and are not awkwardly over-translated or repeatedly paired with English spellings.
- The article uses polite Korean style unless the user explicitly requested another tone.
- A supplied voice sample or genre convention takes priority over the default build-log model.
- Every material point from the source remains unless the user requested compression; pure filler is the exception.
- Rewrites respond to pattern clusters and context rather than banning isolated words or punctuation.
- No chatbot residue remains in the article body.
