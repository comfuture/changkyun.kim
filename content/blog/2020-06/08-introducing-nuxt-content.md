---
title: Nuxt content 소개
description: |
  Nuxt js 위에서 도는 파일시스템 기반 cms 모듈을 이용한 무료 블로그 운영하기
createdAt: 2020-06-08
---

::x-notice
이 글에서는 오래된 이전 버전 nuxt-content 를 설명하고 있습니다.:br최신 정보는 [Nuxt Content](https://content.nuxtjs.org/) 에서 확인하세요.
::

정적 사이트 생성기에 쓰기 좋은 도구 [Nuxt content](https://content.nuxtjs.org/) 를 소개한다.

Jekyll, hexo, lektor 등 markdown을 이용한 페이지 생성기에 만족하지 못하고 있던 차에 드디어 정착할 만한 마음에 드는 도구를 만났다.

## Nuxt

[Nuxt](https://nuxtjs.org)는 vue.js 위에 만들어진 종합 웹개발 프레임웍이다.

프로젝트 구조에서 pages/ 아래에 정해진 규칙에 따라 vue component를 배치하는 것 만으로 서버사이드 렌더링을 포함하는 동적 웹사이트가 뚝딱 만들어진다.[1](#user-content-fn-1){#user-content-fnref-1 ariaDescribedBy="footnote-label" dataFootnoteRef=""}

주요한 특징으로는:

- SSR(Server Side Rendering)지원[2](#user-content-fn-2){#user-content-fnref-2 ariaDescribedBy="footnote-label" dataFootnoteRef=""}
- 디렉토리 방식 Routing
- asyncData, fetch 와 같은 향상된 lifecycle
- 플러그인 / 모듈 시스템

등이 있다.

그 중에서도 가장 멋진 특징이라면 정적 페이지를 만들어내는 generate 기능이라고 할 수 있다. nuxt는 위에 나열한 장점들로 구성된 동적 페이지의 스냅샷을 html 페이지와 code split 된 webpack 번들로 떨궈주어, 동적 웹서비스를 이용할 수 없는 단순 웹 호스팅에서 서빙할 수 있도록 해준다.:br그렇기 때문에 매우 저렴한(심지어 무료) 웹 페이지를 운영할 수 있게 해준다.

하지만 nuxt만을 이용하여 단순 문서가 많은 웹페이지(들)을 빈번하게 업데이트하는 경우 매번 html 마크업을 직접 하여 컴포넌트로 만들어내야 하는 귀찮음이 있다.

## Nuxt Content

[Nuxt content](https://content.nuxtjs.org/) 는 nuxt의 modules중 하나로 확장하는 파일시스템 기반 cms 모듈이다.

hexo, Jekyll.. 처럼 frontmatter를 포함하는 마크다운 파일들을 메타정보를 포함하는 html 파일로 렌더링하는 능력을 가진다. 여기에 쿼리, 정렬, 검색등의 API를 제공하는데, mongodb와 닮은 문법의 체이닝 메소드 집합을 제공한다.

```js
const articles = await $content("articles")
  .only(["title", "path", "createdAt"])
  .sortBy("createdAt", "desc")
  .limit(10)
  .fetch();
```

이런 식이다.

나머지 부분은 nuxt의 데이터 라이프 사이클 `asyncData`, `fetch` 단계에서 필요한 데이터를 채우고 generate 하면 그만이다.

## Github Actions

배포는 gh-pages에 github actions를 이용했다. github은 개인에게도 무료로 무제한의 저장소를 제공하며 CI/CD 에 활용 가능한 Actions 기능또한 무료로 제공하고 있다.[3](#user-content-fn-3){#user-content-fnref-3 ariaDescribedBy="footnote-label" dataFootnoteRef=""}

`.vue` 파일들로 사이트 구조와 가공을 정의하고 컨텐츠는 markdown, json, csv 등의 포멧으로 소스코드와 함께 버전 관리를 하며 정적 사이트 생성은 자체 ci 기능으로, 만들어진 결과물은 셀프 호스팅으로 cdn과 자동 갱신되는 무료 ssl 인증서까지 제공받아 거의 영구적으로 웹에 게시할 수 있다.

draft게시물은 git의 branch를 이용하면 그만이다.

프로젝트를 내려받아 노트북에서 기사를 편집해 다시 push해도 되지만 github 웹에 접속하여 웹브라우져만으로도 새 게시물 추가/편집이 가능하기 때문에 사실 별도의 에디터가 필요 없다.

오픈소스와 오픈소스 호스팅 서비스만으로 저작도구 / 코드 저장소 / 문서 데이터베이스 / html 생성기 / 무료 웹호스팅 을 모두 충족할 수 있는, 나는 참 축복받은 시대를 살고 있는 것 같다.[4](#user-content-fn-4){#user-content-fnref-4 ariaDescribedBy="footnote-label" dataFootnoteRef=""}

소개글에서 생략한 다른 훌륭한 오픈소스들([Tailwind](https://tailwindcss.com/), [Google Material Icons](http://google.github.io/material-design-icons/#icon-font-for-the-web))에 소개는 다음 기회로 미룬다.

이 홈페이지의 전체 소스코드는 [Github](https://github.com/comfuture/changkyun.kim)에서 확인할 수 있다.

## Footnotes

1. 거짓말이다. http, dom, vdom, server-renderer에 대한 깊은 이해가 없으면 곳통받게 된다. [↩](#user-content-fnref-1){.data-footnote-backref ariaLabel="Back to reference 1" dataFootnoteBackref=""}
2. 단순히 vue-server-renderer가 해주는 것 외에 메타 주입, hydrate, prefetch 등 수많은 잔 처리를 해준다. [↩](#user-content-fnref-2){.data-footnote-backref ariaLabel="Back to reference 2" dataFootnoteBackref=""}
3. 나는 오픈소스를 응원하는 마음으로 Pro 결제중 [↩](#user-content-fnref-3){.data-footnote-backref ariaLabel="Back to reference 3" dataFootnoteBackref=""}
4. 사실 닷컴버블 초창기 geocities 때부터 5MB 무료 웹 호스팅을 이용했었지만.. [↩](#user-content-fnref-4){.data-footnote-backref ariaLabel="Back to reference 4" dataFootnoteBackref=""}
