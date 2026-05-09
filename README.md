# changkyun.kim

> logs

## Build Setup

```bash
# install dependencies
$ pnpm install

# serve with hot reload at localhost:3000
$ pnpm dev

# build for production and launch server
$ pnpm build
$ pnpm start

# generate static project
$ pnpm generate
```

For detailed explanation on how things work, check out [Nuxt.js docs](https://nuxtjs.org).

## ActivityPub operation

This site exposes a single ActivityPub actor:

```text
@me@changkyun.kim
https://changkyun.kim/@me
```

From another Fediverse server, search for `@me@changkyun.kim` and follow the result. The WebFinger endpoint also accepts the actor URL.

The site has no login-only admin UI or public follow endpoint. When a remote ActivityPub actor follows `@me@changkyun.kim`, the inbox accepts the Follow and sends a follow-back request from the local actor. Accepted followers and follow-back targets are used as the source set for the public following feed.

Remote posts are collected in two ways:

- Public `Create<Note>` and `Create<Article>` activities delivered to the inbox are stored immediately.
- The scheduled `ap:crawlFeed` task crawls public outboxes from connected actors and stores missing posts.

Stored posts are exposed at `/following/`; `/feed` redirects there. Individual items are readable under `/following/:actor/:id`.

Only allow follows or relay-style actors from sources you trust, because they can increase inbound traffic and affect what appears in the following feed.

## Local ActivityPub Admin CLI

원격 로그인 없이 로컬에서 ActivityPub 상호작용을 처리하려면 `packages/admin` 워크스페이스 패키지를 통해 TUI를 실행합니다.
토큰이 아니라 로컬 actor private key의 서명을 사용해 인증합니다.

```bash
# 1) 관리자 키 준비 (예: DB에서 조회한 PKCS#8 private key)
export ACTIVITYPUB_ADMIN_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----'
export ACTIVITYPUB_ADMIN_KEY_ID='https://changkyun.kim/@me#main-key'

# 2) TUI 실행
# 기본 base URL은 배포 도메인: https://changkyun.kim
pnpm admin

# 로컬 테스트용 (필요 시)
ACTIVITYPUB_ADMIN_BASE_URL=http://localhost:3000 pnpm admin --private-key-file ./activitypub-admin.key
```

로컬 개발 DB(기본 `.data/db.sqlite`)에서 키를 덤프하려면:

```bash
sqlite3 .data/db.sqlite "SELECT private_key FROM actor WHERE actor_id='https://changkyun.kim/@me';"
```

키가 없다면 아래 중 한 가지로 생성하세요.

```bash
# 1) 프로젝트 기동 중이면, DB seed 태스크를 한 번만 실행
curl -sS http://localhost:3000/__db_seed
sqlite3 .data/db.sqlite "SELECT private_key, public_key FROM actor WHERE actor_id='https://changkyun.kim/@me';"

# 2) 외부에서 직접 생성(OpenSSL, PKCS#8)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out activitypub-admin.key
openssl pkey -in activitypub-admin.key -pubout -out activitypub-admin.pub
```

생성한 `activitypub-admin.key`는 `ACTIVITYPUB_ADMIN_PRIVATE_KEY`(환경변수 주입) 또는
`ACTIVITYPUB_ADMIN_PRIVATE_KEY_FILE`(파일 경로 주입)로 CLI에 넘기면 됩니다.
키 ID는 공개키의 `#main-key` 형태로 고정하면 됩니다.

```bash
export ACTIVITYPUB_ADMIN_KEY_ID="https://changkyun.kim/@me#main-key"
export ACTIVITYPUB_ADMIN_PRIVATE_KEY_FILE=/path/to/activitypub-admin.key
```

배포된 `https://changkyun.kim`에서 이 디바이스 키를 신뢰하려면 공개키도 배포 환경에 등록해야 합니다.

```bash
# 이 디바이스 키의 공개키 확인
openssl pkey -in activitypub-admin.key -pubout

# Cloudflare secret 예시: PEM의 줄바꿈을 \n으로 이스케이프해서 저장
wrangler secret put ACTIVITYPUB_ADMIN_KEY_ID
wrangler secret put ACTIVITYPUB_ADMIN_PUBLIC_KEY
```

여러 디바이스를 각각 다른 키로 등록하려면 `ACTIVITYPUB_ADMIN_PUBLIC_KEYS`에 keyId-PublicKey JSON 맵을 넣을 수 있습니다.

```json
{
  "https://changkyun.kim/@me#admin-macbook": "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----\\n",
  "https://changkyun.kim/@me#admin-desktop": "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----\\n"
}
```

## 복구 전략 (기기 간)

키 관리가 어려운 쪽을 줄이려면 아래를 권장합니다.

- 가장 단순: `activitypub-admin.key`(PKCS#8) 파일을 1Password/Bitwarden/Vault에 암호화 저장 후
  각 기기에서 `ACTIVITYPUB_ADMIN_PRIVATE_KEY_FILE`로 복원
- 노출 최소화: 비밀관리소에서 키를 보관하고, 배포/로컬 시작 시점에만 환경변수로 주입
- 백업 체크: 배포 서버에서도 actor가 같은 키로 서명되도록 개인키는 **동일 키**를 사용해야 함

배포 서버의 `.env`에 직접 넣지 말고, CI/CD secret 또는 런타임 secret manager에 주입하세요.

`ACTIVITYPUB_ADMIN_ACTOR_ID` 또는 `ACTIVITYPUB_ADMIN_KEY_ID`가 `.env`가 아니라도
실행 환경에서 주입 가능하며, 현재 기본값은 `https://changkyun.kim/@me` 기준입니다.

특징:

- argument 없이 실행하면 커서/마우스로 항목을 선택하는 TUI 대시보드가 표시됩니다.
- 섹션: 팔로우 / 댓글 / 리액션
- 댓글: 삭제(Hide) 및 대댓글 작성 가능
- 팔로우: 언팔로우
- 로컬 패키지(`packages/admin`)로만 실행되며 publish 대상이 아닙니다.

```bash
# 동작 단축키
# 1: 팔로우, 2: 댓글, 3: 리액션
# r: 댓글 답글, d: 선택 항목 삭제(댓글/리액션), u: 팔로우 언팔로우, R: 새로고침, q: 종료
```
