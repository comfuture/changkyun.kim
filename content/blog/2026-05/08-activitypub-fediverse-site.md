---
title: 내 웹사이트를 연합우주에 붙여 보았습니다
createdAt: 2026-05-08
description: ActivityPub와 Fedify로 개인 웹사이트를 Fediverse에 연결하고 댓글과 반응을 주고받게 만든 기록입니다.
coverImage: /blog/2026-05/activitypub-fediverse-site/cover.png
tags:
  - ActivityPub
  - Fediverse
  - Fedify
  - Web
---
이번에 `changkyun.kim`에 ActivityPub을 붙였습니다. 이제 이 사이트는 Fediverse에서 `@me@changkyun.kim`이라는 actor로 보입니다.

하고 싶었던 일은 단순했습니다. 블로그 글을 올렸을 때 Mastodon이나 Misskey 같은 곳에서 글을 찾고, 답글을 달고, 좋아요나 이모지 반응을 보낼 수 있게 만들고 싶었습니다. 별도 로그인이나 회원가입을 만들고 싶지는 않았습니다. 각자 원래 쓰던 Fediverse 계정으로 반응하면, 제 사이트는 그 반응을 받아서 글 아래에 보여주면 된다고 생각했습니다.

처음부터 깔끔하게 된 것은 아니었습니다. 한동안은 ActivityPub을 직접 구현해 보려고 했고, 나중에는 Fedify를 붙이는 쪽으로 방향을 바꿨습니다. 이 글은 그 과정에 대한 기록입니다.

## ActivityPub과 Fedify를 붙였습니다

간단히 설명하면, ActivityPub은 네트워크에서 일어나는 어떤 액티비티를 상호 약속된 프로토콜에 따라 이메일처럼 주고받으며 전파하고 상호작용하는 API 모음이자 규칙이라고 할 수 있습니다.

W3C는 2018년 1월 23일 ActivityPub을 Recommendation으로 발표했습니다. 문서에서는 ActivityStreams 2.0 기반의 분산형 소셜 네트워킹 프로토콜이라고 설명합니다.

https://www.w3.org/TR/activitypub/

처음에는 필요한 endpoint를 직접 만들면 될 것 같았습니다. WebFinger로 계정을 찾게 하고, actor 문서를 내보내고, inbox와 outbox를 만들면 된다고 생각했습니다.

실제로 하나씩 만들 수는 있었습니다. 다만 곧 처리할 일이 많아졌습니다. 글을 Article 객체로 내보내야 했고, Follow, Create, Like, Undo, Delete 같은 활동을 구분해야 했습니다. 다른 서버로 활동을 보낼 때는 HTTP Signature도 맞춰야 했고, shared inbox도 신경 써야 했습니다.

직접 해 본 것은 도움이 됐습니다. ActivityPub에서 actor, object, activity가 어떻게 이어지는지 감을 잡을 수 있었습니다. 하지만 개인 웹사이트에 붙여서 계속 운영하려면 직접 구현한 코드가 너무 커질 것 같았습니다.

그래서 Fedify를 붙였습니다. Fedify는 ActivityPub 서버 앱을 만들기 위한 TypeScript 라이브러리입니다. 공식 사이트에서는 Fediverse 서버 앱을 만들기 위한 ActivityPub server framework라고 소개합니다.

https://fedify.dev/

Fedify를 붙이고 나서는 제가 정해야 하는 부분이 조금 분명해졌습니다. 이 사이트의 actor는 누구인지, 어떤 글을 outbox에 내보낼지, inbox로 들어온 활동을 어떻게 저장할지 정하면 됐습니다.

물론 구현이 사라진 것은 아닙니다. 지금도 댓글, 반응, following feed를 저장하는 테이블이 있고, Cloudflare Workers의 KV와 Queue도 사용합니다. 다만 직접 ActivityPub의 모든 부분을 맞추는 코드보다는, 이 사이트의 콘텐츠와 반응을 어떻게 다룰지에 더 집중할 수 있었습니다.

현재 이 사이트는 블로그 글과 앱 글을 ActivityPub Article로 내보냅니다. 누군가 `@me@changkyun.kim`을 팔로우하면 Follow를 받고 Accept를 보냅니다. 연결된 actor들의 공개 글은 `/following/`에서도 볼 수 있게 했습니다.

## 댓글과 반응은 Fediverse 계정으로 남깁니다

블로그 글 아래에는 ActivityPub 댓글 안내가 있습니다. Mastodon 같은 클라이언트 검색창에 글 주소를 붙여 넣고, 검색 결과에서 이 글을 연 뒤 답글을 쓰면 됩니다.

그 답글은 원격 서버에서는 평소와 같은 답글입니다. 제 사이트에서는 inbox로 들어온 Create 활동을 읽고, 어느 글에 대한 답글인지 확인한 뒤 댓글로 저장합니다. 화면에는 작성자의 이름, 프로필 이미지, 원래 글 주소를 함께 보여줍니다.

이 방식이 마음에 들었던 이유는 로그인 기능을 따로 만들지 않아도 된다는 점입니다. 댓글을 쓰는 사람의 신원은 이미 각자의 Fediverse 서버에 있습니다. 제 사이트는 그 신원을 새로 만들지 않고, 도착한 답글을 글 아래에 보여주기만 합니다.

Like가 들어오면 좋아요 반응으로 저장합니다. EmojiReact가 들어오면 이모지 반응으로 저장합니다. 글 아래에서는 이모지와 개수를 모아서 보여줍니다.

모든 서버가 같은 방식으로 반응을 보내지는 않습니다. 특히 이모지 반응은 서버마다 차이가 있습니다. 그래서 일단 받을 수 있는 것은 받아 두고, 화면에는 확인된 값만 보여주도록 했습니다.

이 부분도 댓글과 비슷합니다. 제 사이트에서 별도의 반응 버튼을 새로 만든 것이 아닙니다. 누군가 자기 Fediverse 클라이언트에서 누른 반응이 제 사이트에도 도착하게 만든 것입니다.

## atproto도 생각해 봤습니다

중간에 atproto도 생각해 봤습니다. 좋고 나쁨을 비교하려던 것은 아니었습니다. 제가 하려던 일이 무엇인지 놓고 보면 ActivityPub 쪽이 더 직접적이었습니다.

atproto 문서에서는 PDS, Relay, AppView를 주요 구성요소로 설명합니다. 사용자의 데이터는 PDS에 있고, Relay는 여러 PDS의 변경 이벤트를 모으고 다시 흘려보내며, AppView는 그 데이터를 읽어서 실제 앱 화면과 기능을 만듭니다.

- https://atproto.com/guides/overview
- https://atproto.com/guides/the-at-stack

atproto로도 나만의 PDS를 만들고, Bluesky 네트워크의 Relay, 예전 표현으로는 BGS에 가까운 계층으로 글 데이터를 배달하는 식의 구성을 생각할 수는 있습니다. 하지만 그 경우에는 목적이 조금 달라집니다. 저는 새로운 소셜 네트워크나 앱을 만들고 싶었던 것이 아니었습니다.

제 목표는 이미 제가 소유한 글, 특히 블로그의 Article을 분산된 연합우주에 배달하는 것이었습니다. 구독자가 자기 Fediverse 계정으로 편하게 받아보고, 답글이나 좋아요나 이모지 반응을 보낼 수 있으면 됐습니다.

이 블로그는 Nuxt Content를 사용합니다. 소스코드와 블로그 콘텐츠를 포함한 거의 모든 소스가 git 저장소에 있습니다. 글은 Markdown 파일이고, 배포 대상도 이 저장소에서 만들어집니다. 이 구조는 제가 원하는 만큼 포터블합니다.

atproto로 같은 일을 하려면 제가 쓸 PDS를 준비해야 하고, 그 안에 어떤 collection과 lexicon으로 글을 표현할지도 정해야 합니다. 거기서 끝나는 것도 아닙니다. 중앙 네트워크를 통해 배달된 collection을 실제로 읽고 보여줄 클라이언트나 AppView도 필요합니다. 저는 그 부분까지 새로 만들고 싶지는 않았습니다.

그래서 이번 작업에서는 ActivityPub이 더 맞았습니다. 이미 있는 글을 Article로 내보내고, 이미 있는 Fediverse 클라이언트에서 구독하고 반응할 수 있게 만드는 쪽이 제 목적에 가까웠습니다.

## 아직은 써 보면서 보고 있습니다

이번 작업을 하고 나서도 이 사이트의 기본 구조는 그대로입니다. 글은 Nuxt Content 파일로 남고, 주소도 제 도메인 아래에 있습니다. 달라진 것은 글 바깥에서 일어난 반응을 다시 받아볼 수 있게 됐다는 점입니다.

직접 구현해 보던 때에는 생각보다 손봐야 할 부분이 많았습니다. Fedify를 붙인 뒤에는 맡길 수 있는 부분이 생겼고, 제가 직접 정해야 하는 부분도 더 잘 보였습니다. 개인 웹사이트를 Fediverse에 붙이는 작업 범위도 그만큼 줄었습니다.

아직 운영하면서 더 봐야 할 부분은 있습니다. 서버마다 ActivityPub 구현이 조금씩 다르고, 반응이 항상 같은 형태로 오지도 않습니다. 그래도 지금 정도면 제가 원했던 흐름은 만들어졌습니다. 글은 제 사이트에 두고, 대화는 각자의 Fediverse 계정으로 이어질 수 있게 됐습니다.
