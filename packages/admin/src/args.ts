import process from "node:process"

import { DEFAULT_ADMIN_BASE_URL, DEFAULT_ADMIN_KEY_ID } from "./env.ts"
import type { CliOptions } from "./types.ts"

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: process.env.ACTIVITYPUB_ADMIN_BASE_URL || DEFAULT_ADMIN_BASE_URL,
    privateKey: process.env.ACTIVITYPUB_ADMIN_PRIVATE_KEY || "",
    privateKeyFile: process.env.ACTIVITYPUB_ADMIN_PRIVATE_KEY_FILE || "",
    keyId: process.env.ACTIVITYPUB_ADMIN_KEY_ID || DEFAULT_ADMIN_KEY_ID,
    includeDeleted: process.env.ACTIVITYPUB_ADMIN_INCLUDE_DELETED === "1",
    command: null,
    args: [],
    json: false,
    text: "",
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--") {
      continue
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }
    if (arg === "--base-url") {
      options.baseUrl = argv[i + 1] ?? ""
      i += 1
      continue
    }
    if (arg === "--private-key") {
      options.privateKey = argv[i + 1] ?? ""
      i += 1
      continue
    }
    if (arg === "--private-key-file") {
      options.privateKeyFile = argv[i + 1] ?? ""
      i += 1
      continue
    }
    if (arg === "--key-id") {
      options.keyId = argv[i + 1] ?? ""
      i += 1
      continue
    }
    if (arg === "--include-deleted") {
      options.includeDeleted = true
      continue
    }
    if (arg === "--json") {
      options.json = true
      continue
    }
    if (arg === "--text") {
      options.text = argv[i + 1] || ""
      i += 1
      continue
    }
    if (!options.command) {
      options.command = arg
      continue
    }
    options.args.push(arg)
  }

  return options
}

export function usage(): void {
  process.stdout.write(`
activitypub-admin

usage:
  pnpm admin
  pnpm admin list [followers|comments|reactions] [--json]
  pnpm admin reply <comment-id> --text <text>
  pnpm admin react-comment <comment-id> [emoji]
  pnpm admin delete-comment <comment-id>
  pnpm admin delete-reaction <reaction-id>
  pnpm admin follow <follower-id>
  pnpm admin unfollow <follower-id>

options: 
  --base-url <url>      API base URL (default: https://changkyun.kim)
  --private-key <pem>   관리자 signing private key (env: ACTIVITYPUB_ADMIN_PRIVATE_KEY)
  --private-key-file <p>private key PEM 파일 경로 (env: ACTIVITYPUB_ADMIN_PRIVATE_KEY_FILE)
  --key-id <id>        KeyId (default: https://changkyun.kim/@me#main-key, env: ACTIVITYPUB_ADMIN_KEY_ID)
  --include-deleted     삭제된 댓글도 대시보드에 표시
  --json                명령형 출력에서 JSON 사용
  -h, --help            도움말

조작:
  [1,2,3,4] 섹션 전환 | s: 검색어 입력 | [↑↓/마우스] 항목 선택
  r: 댓글달기 | d: 삭제 | f: 팔로우하기 | u: 팔로워 제거 | l: 좋아요 | e: 이모지 | R: 새로고침 | q: 종료

`)
}
