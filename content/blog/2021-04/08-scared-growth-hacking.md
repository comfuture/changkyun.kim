---
title: 무서운 그로스해킹 이야기
description: |
  온라인 마케팅에서 개인식별 정보가 얼마나 쉽게 공유되는지에 대한 경험담
createdAt: 2021-04-08
---

## 디지털 광고

"[그로스해킹](https://ko.wikipedia.org/wiki/%EA%B7%B8%EB%A1%9C%EC%8A%A4_%ED%95%B4%ED%82%B9)" 이라는 용어를 들어봤을 것이다. 일종의 마케팅 용어로, 매출 증진을 위해 사용자의 행동을 해킹하는 것, 즉 데이터분석을 통해 매출 증진을 꽤하는 일련의 행동을 통칭하는 은어이다[1](#user-content-fn-1){#user-content-fnref-1 ariaDescribedBy="footnote-label" dataFootnoteRef=""}.

광고란 필요로 하는 사람에게는 정보지만 그 외에 모두에게는 쓰레기일 뿐이다. 공급자가 팔고싶은 정보가 내가 보려 하는 정보보다 돋보이려 하기 때문일 것이다. 아이러니하게도 세상은 이 광고의 힘으로 돌아간다. 무료로 읽을 수 있는 인터넷 뉴스, 인터넷상의 무엇이든 순식간에 검색해주는 검색사이트, 울리고 웃기는 명작 드라마와 예능까지.. 모두 광고주의 광고 게제를 바라고 무료로 독자를 끌어모으는 비대칭 매체인 것이다.

그로스해킹은 언뜻 괜찮아 보인다. 실제 제품에 관심있어할 만한 타겟을 골라 집중적으로 광고하기 때문에 단가대비 높은 클릭율을 얻을 수 있고, 필요로하지 않는 사람들에게는 노출하지 않아도 되기 때문에 광고주와 소비자 모두가 이긴 것 처럼 느껴진다.

하지만 관련성 높은 광고 대상을 식별하기 위해서는 내가 "나는 지금 짜장면이 매우 먹고싶어요" 라고 배달앱 업체에 일부러 소리쳐 알리지 않는 이상, 제공자가 그 소비자의 행동과 취향을 능동적으로 파악해야 할 필요가 있다. 이 과정에서 합법과 불법의 경계가 모호하게 무너지는 구간이 존재하고, 플랫폼 제조사에서는 함부로 이를 수집하거나 가공하지 못하도록 계속해서 규칙을 제한하고 있다.

간단한 예로, 내가 어느 쇼핑몰 사이트에서 특정 카테고리 제품을 몇개 살펴본 뒤 페이스북 등 SNS를 방문했을 때 사이드 날개 배너 영역 또는 담벼락 피드 광고 영역에 내가 조금전에 살펴봤던 제품 또는 그와 연관된 제품의 광고가 나타나고 있는걸 발견한 경험이 있을 것이다.

과거 익명정보의 위험성이 잘 알려지지 않았던 시절에는 주로 [제3사 쿠키](http://wiki-camp.appspot.com/%5B%EB%B2%88%EC%97%AD%5D_HTTP_Cookie_%28Wikipedia%29?rev=2#h_9c0ac323875ff03e0750c410b3c34433) 라는 방법을 통해 이를 구현했다. 하지만 최근엔 사람들이 인터넷을 사용하는 방법이 "웹사이트"에 국한되지 않고 여러 디바이스를 통틀어 앱과 웹 등 다양한 방법으로 컨텐츠를 소비한다. 따라서 요즘엔 쿠키 대신 IDFA(ADID)를 이용하여 고유 디바이스를 식별하고 이를 활용하기도 한다.

배너 광고 또한 서비스별로 임의의 광고주를 유치하여 직접 게시하기보다는 여러 광고주를 모아 지면(매체)을 경매하고 계산된 가격에 최적의 매체를 통해 게시되는 [애드네트워크](https://en.wikipedia.org/wiki/Advertising_network)를 통해 집행된다.

애드네트워크는 높은 클릭률을 보장하여 더 많은 광고비가 집행되기를 원할 것이고, 여기에 기술을 접목해 더 연관성 높은 광고를 정확한 대상에게 콕 찝어 노출시키는 [애드테크](https://namu.wiki/w/%EC%95%A0%EB%93%9C%ED%85%8C%ED%81%AC) 를 동반하기도 한다. 과거엔 광고주 - 매체 - 대행사 - DSP(Demand Side Platform) - SSP(Supply Side Platform) - 애드 네트워크 - MMP 등 ~~중간상인~~ 미들 플랫폼이 훨씬 많았지만 최근엔 대행부터 게시까지 모두 하는 통합 플랫폼이 많아지는 추세다.

## 선 넘는 경험

어제는 무서운 경험을 했기 때문에 경험을 공유하려고 긴 서론을 풀었다.

아이가 "토도영어" 라는 온라인 학습 앱을 트라이얼로 즐긴 후, 너무 즐거워하고 학습효과 또한 있어보였기에 유료 결제를 해주기로 마음먹었다. 아이는 내가 오래전에 쓰던 iPad를 쓰고 있었고, 내 회사/소셜 계정이 남아있으면 안되기 때문에 대부분의 소셜앱은 지우거나 로그아웃 해둔 상태였다. 앱스토어 한국 계정에서 결제정보를 확인하고 월간 자동연장 구독을 신청한 뒤, 행복해하는 아이 표정을 보며 내 안드로이드 휴대폰으로 페이스북을 켰다.

놀랍게도 페이스북 피드에는 대부분의 광고가 리얼클래스, 튜터링, 스픽, 캠블리영어쌤, 스티븐영어... 등 영어학습 서비스 광고로 도배되어 있었고, 내용은 하나같이 지금 결제를 하면 파격적인 가격에 시작할 수 있게 해주겠다는 제안이었다.

여기서, 애플 앱스토어 인앱 결제 사실이 어느 애드네트워크를 통해 페이스북의 광고 지면으로 흘러나갔고, 페이스북을 보고있는 내가 조금전에 어떤 앱 안에서 인앱 상품을 구매한 동일인 이라는 사실을 알고있다는 확증을 할 수 있다. 게다가 이 모든 과정이 수 초도 되지 않는 거의 실시간으로 반영되었다는 점이다.[2](#user-content-fn-3){#user-content-fnref-3 ariaDescribedBy="footnote-label" dataFootnoteRef=""}

어떤 경로로 "구매사실" 정보가 유출되었는지는 알 수 없다. 애플이 잠재적 경쟁자인 페이스북에게 순순히 정보를 줬을거라는 생각은 하지 않는다[3](#user-content-fn-2){#user-content-fnref-2 ariaDescribedBy="footnote-label" dataFootnoteRef=""}. 각종 앱들 역시 그로스해킹을 위해 앱 안에 트래커를 심어두기 때문에 이 트래커를 운영하는 MMP를 통해 애드 네트워크에 알려졌을 가능성이 가장 크다.

그렇다면 MMP는 해당 앱의 인앱구매 촉진을 위해 사용자 행동을 분석해 보고해달라는 광고주(앱 제작사)의 의도와 다르게, 해당 앱을 프락치로 이용하여 불필요하게 많은 정보를 수집하고 이를 다른 고객(타 광고주)에게 유료로 제공하고 있는 셈이 된다.

## 플랫폼의 노력

애플은 원래부터도 IDFA 를 무단 수집하는 것을 불편하도록 제한하고 있었고, 최근엔 제약사항을 더 강화하여 사용자의 명시적인 동의 없이는 이를 수집할 수 없도록 하고 있다. <https://developer.apple.com/kr/app-store/user-privacy-and-data-use/>

또한 익명정보를 통해 동일인임을 유추하는 행위를 광범위하게 제한하며 이를 어길 시 앱 승인이 거부될 수도 있다고 알렸다.

> ### 기기 또는 사용자를 식별하는 데 지문 또는 기기의 신호를 사용할 수 있습니까?

> 아니요. Apple Developer Program 사용권 계약에 따라, 기기에서 해당 기기를 고유하게 식별할 목적으로 데이터를 추출할 수 없습니다. 사용자 또는 기기 데이터의 예로는 사용자의 웹 브라우저 속성 및 해당 구성, 사용자의 기기 및 구성, 사용자의 위치, 사용자의 네트워크 연결이 포함되나 이에 국한되지 않습니다. 이러한 방식을 시행하는 것으로 확인된 앱이나 SDK(광고 네트워크, 기여도 서비스, 분석이 포함되나 이에 국한되지 않음)를 참조하는 앱은 App Store에서 거부될 수 있습니다.

브라우져 제조사 역시 트래킹을 방지하는 옵션을 기본값으로 하고 표준을 만들어 지키려는 노력을 (조금씩) 하고 있다.

## 그로스해커에게

구글은 과거 "Don't be evil" 을 모토로. 악해지지 않겠다고 선언했었다. 구글같은 거대한 기업이 수집할 수 있는 데이터를 이용하면 마음만 먹으면 개개인의 사소한 모든 행동을 추적하고 예측하는 것 마저 가능해지기 때문에 스스로 족쇄를 채우겠다는 의지로 받아들였다[4](#user-content-fn-4){#user-content-fnref-4 ariaDescribedBy="footnote-label" dataFootnoteRef=""}.

목적이 선하다고 과정이 모두 용서가 되지는 않는다. 애드테크 회사들은 무단 개인식별을 통한 광고 리타게팅 전략을 수정하고 조금 더 안전한 인터넷 생활이 되도록 협조했으면 좋겠다.

## Footnotes

1. 그냥 데이터베이스 마케팅 이라고 해도 좋았을텐데.. [↩](#user-content-fnref-1){.data-footnote-backref ariaLabel="Back to reference 1" dataFootnoteBackref=""}
2. 지금은 이 글의 레퍼런스 링크를 따기 위해 구글에서 애드네트워크 를 검색했기 때문에 애드테크의 광고로 바뀌는 중이다. [↩](#user-content-fnref-3){.data-footnote-backref ariaLabel="Back to reference 2" dataFootnoteBackref=""}
3. 아니면 돈 받고 팔았나? [↩](#user-content-fnref-2){.data-footnote-backref ariaLabel="Back to reference 3" dataFootnoteBackref=""}
4. 첫 다짐을 아직도 잘 지키고 있는지 여부는 논외 [↩](#user-content-fnref-4){.data-footnote-backref ariaLabel="Back to reference 4" dataFootnoteBackref=""}
