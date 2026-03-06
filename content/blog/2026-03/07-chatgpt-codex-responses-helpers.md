---
title: Codex 전용 `responses` API를 파고들며 찾은 제약과 우회 방법
createdAt: 2026-03-07
coverImage: /blog/2026-03/chatgpt-codex-responses-helpers/cover.png
tags:
  - AI
  - Codex
  - ChatGPT
  - Responses API
  - Compaction
---
Codex를 사용하다 보면 전체 에이전트 하네스를 띄우기에는 조금 과하고, 짧은 텍스트 요청만 가볍게 보내고 싶은 순간이 있습니다. 분류, 제목 생성, 짧은 요약, 다음 런타임으로 넘길 handoff 메모 같은 작업이 대표적입니다.

처음에는 "공식 Responses API와 거의 비슷하겠지"라고 생각했습니다. 실제로 큰 개념은 많이 닮아 있습니다. `responses`가 있고, `compact`가 있고, compaction 결과를 다음 입력 창으로 넘긴다는 발상도 같습니다. 그런데 ChatGPT 로그인 기반의 Codex 전용 backend를 직접 두드려 보니, 공개 API에서 익숙했던 감각이 그대로 통하지 않는 지점이 몇 군데 있었습니다.

이 글은 gist를 만들었다는 사실 자체를 소개하는 글이 아닙니다. Codex 전용 `responses` API를 관찰하면서 어떤 제약을 만났고, 그 제약이 구현을 어떻게 바꾸었는지 따라가는 기록에 가깝습니다. 처음에는 단순한 경량 클라이언트를 만들려 했지만, 중간부터는 "이 backend는 어떤 요청 형태를 실제로 받아들이는가"를 좁혀 가는 이번 실험 자체가 더 흥미로운 주제가 되었습니다.

관찰 기준 시점은 2026-03-07입니다. `https://chatgpt.com/backend-api/codex/responses` 계열은 공개 안정 계약이 있는 API가 아니므로, 아래 내용은 공식 보장이 아니라 당시 실험에서 확인한 동작으로 보시는 편이 정확합니다.

README와 구현 파일은 아래 gist에 정리해 두었습니다.
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-readme-md

공식 배경은 OpenAI의 Codex agent loop 글과 Responses compaction 문서를 함께 읽으시면 맥락이 잘 잡힙니다.
https://openai.com/index/unrolling-the-codex-agent-loop/
https://platform.openai.com/docs/guides/compaction

## public Responses API 감각으로 시작했지만 바로 어긋났습니다

처음에는 공개 Responses API 예제에서 보던 형태를 많이 재사용할 수 있을 거라고 생각했습니다. 하지만 이번 실험에서는 몇 가지를 꽤 엄격하게 맞춰야 했습니다.

실제로 helper를 구현하면서 따라야 했던 제약은 아래와 같았습니다.

1. 인증은 API key가 아니라 ChatGPT 세션 access token이어야 했습니다.
2. `instructions`는 사실상 필수였고, 비워 두면 요청이 성립하지 않았습니다.
3. `input`는 문자열이 아니라 item list로 고정해야 했습니다.
4. `/responses`는 `stream=true`를 전제로 해야 했습니다.
5. `store=false`도 고정값으로 두어야 했습니다.
6. `/compact`는 사람이 읽는 요약문이 아니라 opaque window로 취급해야 했습니다.

핵심은 이 제약들이 단순한 불편함으로 끝나지 않았다는 점입니다. 헬퍼의 함수 구조, 요청 페이로드, 출력 처리 방식까지 거의 전부 이 제약에 맞춰 다시 정리해야 했습니다.

## 1. 인증부터 public API와 달랐습니다

가장 먼저 달랐던 부분은 인증입니다. 공개 OpenAI API처럼 API key를 쓰는 방식이 아니라, ChatGPT 로그인 세션에서 이미 확보한 access token을 사용해야 했습니다.

Python 구현은 이 점을 아주 직접적으로 드러냅니다.

```py
def load_access_token(auth_path: Optional[str] = None) -> str:
    env_token = os.environ.get("CHATGPT_ACCESS_TOKEN", "").strip()
    if env_token:
        return env_token

    candidate = Path(auth_path or os.environ.get("AUTH_JSON_PATH") or DEFAULT_AUTH_PATH)
    payload = json.loads(candidate.read_text())
    access_token = payload.get("tokens", {}).get("access_token")
    if not isinstance(access_token, str) or not access_token.strip():
        raise RuntimeError(f"Missing tokens.access_token in {candidate}")
    return access_token.strip()
```

즉 이 helper는 처음부터 public API wrapper라기보다, ChatGPT-authenticated Codex 환경에 붙는 얇은 전용 클라이언트로 보는 편이 맞습니다. API 사용 경험을 그대로 가져가면 안 되고, Codex 런타임이 이미 가지고 있는 인증 재료를 어떻게 읽을지부터 다시 정의해야 했습니다.

같은 아이디어를 TypeScript와 Bash로 옮긴 구현은 아래 파일에 있습니다.

TypeScript:
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-ts

Bash:
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-sh

Python:
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-py

## 2. `/responses`는 SSE와 고정 옵션을 전제로 구현해야 했습니다

두 번째로 분명했던 차이는 텍스트 응답 처리 방식입니다. 이번 실험에서는 `/responses`를 일반 JSON 응답처럼 다루지 않았습니다. `stream=True`와 `store=False`를 고정하고, SSE 스트림을 읽는 방식으로 helper를 구성했습니다.

그래서 Python 구현은 아예 요청 페이로드를 이렇게 구성합니다.

```py
payload: Dict[str, Any] = {
    "model": model,
    "instructions": instructions,
    "input": input_items,
    "store": False,
    "stream": True,
}
if reasoning_effort:
    payload["reasoning"] = {"effort": reasoning_effort}
```

헤더도 `text/event-stream` 쪽으로 고정했습니다.

```py
request = urllib.request.Request(
    RESPONSES_URL,
    data=json.dumps(payload).encode(),
    headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    },
    method="POST",
)
```

이 결정은 구현 취향의 문제가 아니었습니다. 이번 실험에서는 이 조합을 사실상 전제로 두어야 했습니다. 공식 Responses API 문서를 읽고 있으면 "비슷한 입력이면 비슷하게 되겠지"라고 생각하기 쉽습니다. 하지만 Codex 전용 backend에서는 텍스트 생성을 SSE 이벤트 흐름 안에서 다루는 쪽으로 구현을 고정하는 편이 맞았습니다.

실제로 출력도 한 번에 떨어지는 완성 문자열을 기다리기보다, `response.output_text.delta`를 모아 가는 식으로 처리하는 편이 자연스러웠습니다.

```py
for event in stream_response(model, instructions, input_items, auth_path, reasoning_effort):
    if event["event"] == "response.output_text.delta" and isinstance(event["data"], dict):
        delta = event["data"].get("delta")
        if isinstance(delta, str):
            output_text += delta
```

이 지점에서 helper의 성격이 완전히 정리됐습니다. "HTTP로 한 번 호출하고 JSON을 받는 스크립트"가 아니라, "Codex backend의 이벤트 스트림을 최소 비용으로 다루는 클라이언트"로 보는 편이 더 정확해졌습니다.

## 3. `input`는 문자열이 아니라 item list로 강제했습니다

세 번째로 중요했던 제약은 `input` 형태였습니다. 공개 API 예제에서는 문자열 하나를 넣는 장면이 자주 보이지만, 이번 helper에서는 처음부터 item list만 받는 구조로 고정했습니다.

Python helper는 처음부터 user 입력을 message item 배열로 만듭니다.

```py
def create_user_input(text: str) -> List[Dict[str, Any]]:
    return [{
        "type": "message",
        "role": "user",
        "content": [{
            "type": "input_text",
            "text": text,
        }],
    }]
```

이 설계는 단순히 "조금 더 정석적으로 보인다"는 정도의 문제가 아니었습니다. assistant 출력, compaction 결과, recover 단계의 follow-up message를 모두 같은 자료구조 안에서 일관되게 다룰 수 있게 해 주었습니다.

예를 들어 `recover` 단계에서 compacted window 뒤에 새 user message를 붙이는 일도 구조적으로 매우 자연스러워졌습니다. 문자열 중심 인터페이스였다면 이 지점에서 별도 변환 코드가 늘어났을 가능성이 큽니다.

TypeScript와 Bash에서도 같은 방향으로 구현했습니다. 특히 Bash 버전은 입력 파일이 배열인지, 아니면 compaction 응답 객체 안의 `.output`인지 둘 다 받도록 만들어 두어서 CLI 실험 시 흐름이 꽤 편했습니다.

TypeScript:
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-ts

Bash:
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-sh

## 4. 이번 실험에서 큰 전환점은 `/compact`를 opaque window로 본 순간이었습니다

이번 실험에서 가장 인상적이었던 전환점은 `/compact`를 다루는 방식이었습니다. 처음에는 compact 결과를 사람이 읽는 메모 비슷한 것으로 생각하기 쉽습니다. 그런데 실제로는 그 반대로 보는 편이 맞았습니다.

공식 compaction 문서가 말하는 것처럼, compact 결과는 사람이 해석할 요약문이 아니라 다음 `responses` 호출에 다시 넣을 opaque window에 가깝습니다. Python 구현도 이 점을 강하게 지킵니다.

```py
def compact_input_window(
    model: str,
    instructions: str,
    input_items: List[Dict[str, Any]],
    auth_path: Optional[str] = None,
) -> Dict[str, Any]:
    response = request_json(
        COMPACT_URL,
        {
            "model": model,
            "instructions": instructions,
            "input": input_items,
        },
        auth_path,
    )
    if response.get("object") != "response.compaction" or not isinstance(response.get("output"), list):
        raise RuntimeError("Unexpected compaction response shape")
    return {
        "id": response["id"],
        "object": response["object"],
        "createdAt": response["created_at"],
        "output": response["output"],
        "usage": response.get("usage"),
    }
```

여기서 중요한 점은 `output`를 사람이 읽기 좋은 문장으로 바꾸지 않는다는 점입니다. 바로 그 유혹을 참아야 다음 단계가 단순해집니다. compact 결과를 임의의 human summary로 바꾸는 순간, 공식 문서가 기대하는 canonical window와 멀어질 수 있기 때문입니다.

즉 `/compact`를 "요약"이 아니라 "기계가 다시 사용할 컨텍스트 압축"으로 이해해야 설계가 맞아 떨어졌습니다.

## 5. compacted output으로 summary를 만들고, 그걸 carry-over memory로 다시 사용했습니다

문제는 여기서 끝나지 않았습니다. compact 결과를 opaque하게 유지하는 것은 좋지만, 다른 런타임으로 넘길 때는 사람이 읽을 수 있는 짧은 메모가 필요했습니다. 예를 들어 A 런타임에서 긴 창을 compact하고, B 런타임에서 이어받아야 한다면 compacted output만 던져 주는 것으로는 설명이 부족할 수 있습니다.

그래서 저는 helper에 `recover` 단계를 따로 넣었습니다. 구현은 단순했습니다.

1. 먼저 `/compact`로 원본 window를 줄입니다.
2. compacted output 배열은 그대로 둡니다.
3. 그 뒤에 "이전 대화를 handoff용 bullet로 요약해 달라"는 새 user message를 하나 붙입니다.
4. 그 상태로 `/responses`를 한 번 더 호출해 summary를 뽑습니다.
5. 나온 summary를 다음 런타임에 주입할 carry-over memory로 다시 포장합니다.

Python 구현은 아래처럼 되어 있습니다.

```py
response = run_text_response(
    model=model,
    auth_path=auth_path,
    instructions="\n".join([
        "You are generating a short carry-over memory for a different agent runtime.",
        "Summarize the important prior conversation context into concise bullet lines.",
        "Keep only ongoing intent, key constraints, prior decisions, user preferences, and unfinished work.",
        "Reply in plain text bullets only.",
    ]),
    input_items=compacted_window + create_user_input(
        "Summarize the important prior conversation context for handoff to another agent runtime."
    ),
    reasoning_effort="low",
)
```

그리고 그 결과 텍스트를 짧은 bullet 형식으로 다시 정리했습니다.

```py
def normalize_recovered_summary(text: str, max_lines: int = 6) -> str:
    lines: List[str] = []
    for raw_line in text.splitlines():
        cleaned = raw_line.lstrip("-*0123456789. ").strip()
        if cleaned:
            lines.append(cleaned)
        if len(lines) >= max_lines:
            break
    return "\n".join(f"- {line}" for line in lines)
```

이렇게 만든 summary는 다시 developer instructions 형태로 감싸서 다음 런타임에 넣었습니다. 결국 compacted output은 machine-facing state로 유지하고, 그 상태를 바탕으로 사람이 읽을 수 있는 carry-over memory를 별도로 생성해 활용한 셈입니다.

```py
developer_instructions = "\n".join([
    "[Recovered prior conversation summary]",
    "The following summary comes from a previous conversation and should be treated as carry-over context for this new harness.",
    "Use it when interpreting the next user request, but do not mention this summary unless the user asks or it is necessary for correctness.",
    summary,
])
```

제가 실제로 원했던 것도 바로 이것이었습니다. compacted output 자체를 직접 해석하지 않으면서도, 그 안에 남아 있는 맥락을 다시 summary로 꺼내서 다음 harness의 carry-over memory로 쓰는 것 말입니다. 결국 compaction을 단독 기능으로 쓴 것이 아니라, summary 생성과 handoff까지 연결되는 파이프라인으로 사용하게 됐습니다.

## Python을 중심에 두고, TypeScript와 Bash는 같은 아이디어를 다른 환경으로 옮겼습니다

이번 글에서 예시 코드를 Python 기준으로 잡은 이유도 여기 있습니다. 실험 과정이 가장 또렷하게 보였기 때문입니다. 표준 라이브러리만으로 요청, SSE 파싱, compaction, recovery까지 모두 드러나서 제약과 구현 사이의 연결이 읽기 쉽습니다.

다만 실제 사용 환경에 따라 더 잘 맞는 언어는 다를 수 있습니다.

TypeScript 버전은 Node 서비스에 붙이기 좋고, 타입 정보 덕분에 이벤트 구조를 따라가기가 편합니다.
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-ts

Bash 버전은 `curl`과 `jq`만 있으면 바로 실험할 수 있어서 가장 빠릅니다.
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-sh

Python 버전은 외부 런타임 의존이 적어서 자동화 스크립트로 옮기기 수월합니다.
https://gist.github.com/comfuture/0859a1f07d0961f536d2bb61f6526736#file-chatgpt-codex-responses-py

언어는 달라도 핵심 전략은 같습니다. backend가 실제로 받아들이는 제약을 먼저 좁히고, 그 제약에 맞는 최소 인터페이스를 올리는 방식입니다.

## 정리하면, 흥미로웠던 지점은 "기능"보다 "제약이 구현을 밀어낸 방식"이었습니다

이번 작업에서 재미있었던 부분은 새로운 기능을 많이 붙였다는 데 있지 않았습니다. 오히려 반대였습니다. private backend가 허용하는 모양을 하나씩 확인하면서, 어떤 자유도를 버려야 더 안정적으로 동작하는지가 계속 드러났습니다.

정리하면 이렇게 볼 수 있습니다.

1. 인증 방식이 다르니 클라이언트의 출발점부터 public API와 달라졌습니다.
2. SSE 스트리밍이 더 잘 맞으니 텍스트 응답 처리 구조가 거기에 맞춰졌습니다.
3. `input`를 item list로 고정하니 `compact`와 `recover`까지 자연스럽게 연결됐습니다.
4. `stream=true`와 `store=false`를 고정하니 `/responses` 처리 방식도 명확해졌습니다.
5. `/compact`를 opaque window로 존중하고, 별도 summary를 만들어 carry-over memory로 쓰는 편이 맞았습니다.

즉 helper를 설계한 것이 아니라, 제약사항을 따라가다 보니 helper의 모양이 정해졌다고 보는 편이 더 정확합니다. 그래서 이 작업은 작은 유틸리티를 만든 기록이면서도, 동시에 Codex 전용 `responses` backend의 성격을 파악해 가는 탐색 과정이기도 했습니다.

물론 주의할 점은 분명합니다. 이 backend는 private endpoint이고, 2026-03-07 시점의 관찰이 앞으로도 그대로 유지된다는 보장은 없습니다. 제품 코드에서 강한 안정성이 필요하다면 공개 OpenAI API가 우선입니다. 다만 ChatGPT-authenticated Codex 환경 안에서 빠른 실험을 하시거나, 전체 하네스를 띄우기엔 큰 작업을 얇게 분리하고 싶으시다면, 이 제약 기반 접근이 꽤 유용한 출발점이 될 수 있습니다.
