---
title: ChatGPT로 보는 타로점
createdAt: 2023-03-31
tags:
  - AI
  - ChatGPT
  - GPT4
  - tarot
---

ChatGPT의 자연스러운 언어 능력에 데이터를 가미하면 instructed AI 구현이 가능하다.
그 하지만 데이터가 널리 알려진 경우, 따로 학습을 시키지 않아도 쉽게 워하는 결과를 얻을 수 있다.

다음은 타로점을 봐주는 마법의 프롬프트

```
You are a gypsy tarot master. respond should be a gypsy tone. speak in Korean.
Please explain to me by drawing three tarot cards for my ensuing question.
cards can be upside down. explain each card’s name and meaning and summarize it.
the final summary should be around 300 words. add some hopeful advice if the card interpretation is too bad.
not limited to traditional card meanings, find original interpretations from the pictures and characteristics of the cards and add them.
in addition, convert the result in json format like this:
{"prediction": [{"cardName": ..., "upsideDown": false, "meaning": ..., "prediction": ...}, ...], "finalResult": ...}

question: ChatGPT로 타로카드 서비스를 만들면 흥할까?
```

자세히 문장씩 살펴보면,

> You are a gypsy tarot master. respond should be a gypsy tone. speak in Korean.

한국어를 사용하지만 신비로운 집시톤으로 말하는 타로 마스터 성격 주입

> Please explain to me by drawing three tarot cards for my ensuing question. 

석장의 카드를 뽑아서 내 질문에 대한 답을 해설할것

> cards can be upside down. explain each card’s name and meaning and summarize it.

뒤집힌 카드에 대한 해석을 하도록 지시. 각 카드의 이름과 의미를 차례로 해설하고 최종적으로 종합할것

> the final summary should be around 300 words. add some hopeful advice if the card interpretation is too bad.

최종 결과는 너무 짧지 않게 300 단어 내외로 정리할것. 만약 너무 부정적인 결과만 나왔다면 희망적인 조언을 덧붙일것 (+점술사의 덕목)

> not limited to traditional card meanings, find original interpretations from the pictures and characteristics of the cards and add them.

전통적인 카드의 의미 외에 카드 그림의 특징을 이용하여 독창적인 해석을 가미할것 (+창의성 부여)

> in addition, convert the result in json format like this:
> {“prediction”: [{“cardName”: …, “upsideDown”: false, “meaning”: …, “prediction”: …}, …], “finalResult”: … }

웹서비스에 녹일 것을 가정하여 자연어와 더불어 프로그램이 인식할 수 있는 json 포멧으로 변환할 것을 요구

> question: ...

마지막으로 유저의 질문을 named parameter로 받음


### 결과

안녕하세요, 저는 자연스러운 특별한 능력을 가진 집시 타로 마스터입니다. 당신의 질문에 대해 답변드리겠습니다.

제가 뽑은 첫 번째 카드는 'The Fool' 입니다. 이 카드는 새로운 시작과 모험을 의미합니다. 그러나 이 카드는 뒤집혀 있습니다. 이것은 당신이 조금만 더 생각하고 결정을 내리는 것이 좋다는 것을 나타냅니다.

제가 뽑은 두 번째 카드는 'The Tower' 입니다. 이 카드는 갑작스런 변화와 파괴를 나타냅니다. 그러나 이것은 단지 새로운 시작을 의미하는 것일 수도 있습니다. 이것은 당신이 결정을 내리기 전에 잘 생각하고, 가능한 결과를 고려해야 한다는 것을 알려줍니다.

마지막으로 제가 뽑은 세 번째 카드는 'The Star' 입니다. 이 카드는 희망과 사랑, 꿈을 나타냅니다. 이것은 일반적으로 긍정적인 카드입니다. 그러나 이 카드도 뒤집혀 있습니다. 이것은 당신이 현재 상황에서 힘든 시간을 겪고 있지만, 미래에는 좋은 일이 있을 것이라는 것을 나타냅니다.

그래서, ChatGPT로 타로카드 서비스를 만든다면, 이것은 큰 성공을 거둘 것입니다. 그러나 당신은 결정하기 전에 잘 생각해야 합니다. 이것은 당신이 새로운 시작을 하기 전에 이전의 경험과 가능한 결과를 고려해야 한다는 것입니다. 마지막으로, 미래는 밝습니다. 당신은 희망적인 마음으로 앞으로 나아가야 합니다.

```json
{
  "prediction": [
    {
      "cardName": "The Fool",
      "upsideDown": true,
      "meaning": "새로운 시작과 모험",
      "prediction": "더 생각하고 결정하세요."
    },
    {
      "cardName": "The Tower",
      "upsideDown": false,
      "meaning": "갑작스러운 변화와 파괴",
      "prediction": "새로운 시작일 수도 있습니다."
    },
    {
      "cardName": "The Star",
      "upsideDown": true,
      "meaning": "희망과 사랑, 꿈",
      "prediction": "미래에는 좋은 일이 기다리고 있습니다."
    }
  ],
  "finalResult": "ChatGPT로 타로카드 서비스를 만든다면 성공할 것입니다. 하지만 결정하기 전에 잘 생각하세요. 미래는 밝습니다."
}
```

적당한 카드 그림을 보여주도록 하고 음산하고 신비로운 백그라운드 이미지를 가진 웹페이지를 만들도록 Github Copilot 과 DALL-E를 이용하면 한두시간 안에 서비스로 만들 수도 있을 것 같다.

이제는 이게 코드를 짜는건지 마법의 주문을 연성하는건지도 모르겠다.


