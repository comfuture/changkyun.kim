#!/usr/bin/env node

import process from "node:process"
import fs from "node:fs"
import path from "node:path"
import * as blessedModule from "blessed"

const blessed = blessedModule.default ?? blessedModule

const DEFAULT_ADMIN_KEY_ID = "https://changkyun.kim/@me#main-key"
const DEFAULT_ADMIN_BASE_URL = "https://changkyun.kim"
const ENV_FILES = [".env", ".env.local"].flatMap((name) => {
  const cwd = path.resolve(process.cwd())
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "..", "..")]
  return candidates.map((dir) => path.resolve(dir, name))
})

function decodeEnvEscape(value) {
  if (value === "n") {
    return "\n"
  }
  if (value === "r") {
    return "\r"
  }
  if (value === "t") {
    return "\t"
  }
  return value
}

function parseQuotedEnvValue(rawValue, quote) {
  let value = ""
  let escaped = false
  for (let i = 1; i < rawValue.length; i += 1) {
    const char = rawValue[i]
    if (escaped) {
      value += quote === "\"" ? decodeEnvEscape(char) : char
      escaped = false
      continue
    }
    if (quote === "\"" && char === "\\") {
      escaped = true
      continue
    }
    if (char === quote) {
      return value
    }
    value += char
  }
  return value
}

function parseUnquotedEnvValue(rawValue) {
  for (let i = 0; i < rawValue.length; i += 1) {
    if (rawValue[i] === "#" && (i === 0 || /\s/.test(rawValue[i - 1]))) {
      return rawValue.slice(0, i).trimEnd()
    }
  }
  return rawValue.trimEnd()
}

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    return null
  }

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed
  const index = normalized.indexOf("=")
  if (index < 0) {
    return null
  }

  const key = normalized.slice(0, index).trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null
  }

  const rawValue = normalized.slice(index + 1).trimStart()
  if (rawValue.startsWith("\"") || rawValue.startsWith("'")) {
    return [key, parseQuotedEnvValue(rawValue, rawValue[0])]
  }
  return [key, parseUnquotedEnvValue(rawValue)]
}

function loadEnvFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8")
    text.split("\n").forEach((line) => {
      const parsed = parseEnvLine(line)
      if (!parsed) {
        return
      }
      const [key, value] = parsed
      if (key && !Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value
      }
    })
  } catch {
    // env file is optional
  }
}

for (const filePath of ENV_FILES) {
  loadEnvFile(filePath)
}

const SECTIONS = {
  followers: { key: "followers", label: "팔로우" },
  comments: { key: "comments", label: "댓글" },
  reactions: { key: "reactions", label: "리액션" },
}

const SECTION_ORDER = ["followers", "comments", "reactions"]

function parseArgs(argv) {
  const options = {
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
    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }
    if (arg === "--base-url") {
      options.baseUrl = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--private-key") {
      options.privateKey = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--private-key-file") {
      options.privateKeyFile = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--key-id") {
      options.keyId = argv[i + 1]
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

function usage() {
  process.stdout.write(`
activitypub-admin

usage:
  pnpm admin
  pnpm admin list [followers|comments|reactions] [--json]
  pnpm admin reply <comment-id> --text <text>
  pnpm admin react-comment <comment-id> [emoji]
  pnpm admin delete-comment <comment-id>
  pnpm admin delete-reaction <reaction-id>
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
  [1,2,3] 섹션 전환 | [↑↓/마우스] 항목 선택
  r: 댓글 답글 | d: 삭제 | u: 팔로워 언팔로우 | R: 새로고침 | q: 종료

`)
}

function normalizeInputUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function formatTime(value) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString("ko-KR")
}

function trimText(value, max) {
  const text = (value || "").replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function loadPrivateKeyFromFile(filePath) {
  if (!filePath) {
    return ""
  }
  return fs.readFileSync(filePath, "utf8")
}

function normalizePemText(value) {
  return (value || "").replace(/\r?\n/g, "\n").trim()
}

function getFirstExistingFilePath(paths) {
  for (const candidate of paths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    } catch {
      // ignore
    }
  }
  return ""
}

async function importPrivateKey(pemText) {
  const pem = (pemText || "").trim()
  if (!pem.includes("-----BEGIN PRIVATE KEY-----") || !pem.includes("-----END PRIVATE KEY-----")) {
    throw new Error("private key는 PKCS#8 PEM 형식이어야 합니다.")
  }
  const header = "-----BEGIN PRIVATE KEY-----"
  const footer = "-----END PRIVATE KEY-----"
  const body = pem
    .replace(header, "")
    .replace(footer, "")
    .replace(/\s/g, "")
  const binaryDer = Buffer.from(body, "base64")
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"],
  )
}

async function createDigest(value) {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return `SHA-256=${Buffer.from(hashBuffer).toString("base64")}`
}

function buildSigningString(method, path, headerValues, signedHeaders) {
  return signedHeaders
    .map((header) => {
      if (header === "(request-target)") {
        return `(request-target): ${method.toLowerCase()} ${path}`
      }
      return `${header}: ${headerValues[header]}`
    })
    .join("\n")
}

function createSignatureHeader(signingText, headers, keyId) {
  return `keyId="${keyId}",headers="${headers.join(" ")}",signature="${signingText}"`
}

async function createSignedHeaders(endpoint, method, payload, keyId, key) {
  const requestUrl = new URL(endpoint)
  const path = `${requestUrl.pathname}${requestUrl.search}`
  const normalized = method.toLowerCase()
  const bodyText = payload == null ? "" : JSON.stringify(payload)
  const headers = {
    "host": requestUrl.host,
    "date": new Date().toUTCString(),
  }

  const signingHeaders = ["(request-target)", "host", "date"]
  const headerValues = {
    host: headers.host,
    date: headers.date,
  }

  if (bodyText) {
    headers.digest = await createDigest(bodyText)
    headerValues.digest = headers.digest
    signingHeaders.push("digest")
  }

  const signingText = buildSigningString(normalized, path, headerValues, signingHeaders)
  const signature = await crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    key,
    new TextEncoder().encode(signingText),
  )

  const signatureHeader = createSignatureHeader(Buffer.from(signature).toString("base64"), signingHeaders, keyId)
  return {
    date: headers.date,
    digest: headers.digest,
    signature: signatureHeader,
  }
}

function formatRow(section, item) {
  if (section === "followers") {
    return `${item.actorId} | ${item.status} | ${formatTime(item.updatedAt)}`
  }
  if (section === "comments") {
    return `${item.status} ${item.actorId} | ${item.articlePath} | ${trimText(item.contentText, 60)}`
  }

  return `${item.actorId} | ${item.reaction} | ${item.articlePath}`
}

function updateStatus(status, message, isError = false) {
  status.setContent(`
${message}
[1]팔로우 [2]댓글 [3]리액션 | [↑↓] 선택/마우스 | r: 답글 | d: 삭제 | u: 언팔로우 | R: 새로고침 | q: 종료`.trim())
  status.style.fg = isError ? "red" : "green"
}

function getSectionCount(data, section) {
  return Array.isArray(data?.[section]) ? data[section].length : 0
}

function formatSectionCounts(data, currentSection) {
  return SECTION_ORDER
    .map((section, index) => {
      const marker = section === currentSection ? ">" : " "
      return `${marker} [${index + 1}] ${SECTIONS[section].label}: ${getSectionCount(data, section)}`
    })
    .join("   ")
}

function updateDetail(detail, section, item) {
  if (!item) {
    detail.setContent("선택된 항목이 없습니다.")
    return
  }

  if (section === "followers") {
    detail.setContent(`
유형: 팔로우
ID: ${item.id}
Actor: ${item.actorId}
상태: ${item.status}
생성: ${formatTime(item.createdAt)}
수정: ${formatTime(item.updatedAt)}
    `.trim())
    return
  }

  if (section === "comments") {
    detail.setContent(`
유형: 댓글
ID: ${item.id}
Actor: ${item.actorId}
경로: ${item.articlePath}
상태: ${item.status}
작성시각: ${formatTime(item.publishedAt)}
내용: ${item.contentText}
원문객체: ${item.objectId}
    `.trim())
    return
  }

  detail.setContent(`
유형: 리액션
ID: ${item.id}
Actor: ${item.actorId}
경로: ${item.articlePath}
리액션: ${item.reaction} (${item.reactionType})
작성시각: ${formatTime(item.publishedAt)}
원문객체: ${item.objectId}
  `.trim())
}

async function requestAdminData(baseUrl, signConfig, includeDeleted) {
  const endpoint = `${normalizeInputUrl(baseUrl)}/api/admin/activitypub?includeDeleted=${includeDeleted ? "1" : "0"}`
  const signing = await createSignedHeaders(endpoint, "GET", null, signConfig.keyId, signConfig.privateKey)
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      Date: signing.date,
      Signature: signing.signature,
      ...(signing.digest ? { Digest: signing.digest } : {}),
    },
  })

  if (!response.ok) {
    const message = await readErrorMessage(response, "Failed to load admin data")
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`)
  }

  return response.json()
}

async function readErrorMessage(response, fallback) {
  const text = await response.text().catch(() => "")
  if (!text) {
    return fallback
  }
  try {
    const payload = JSON.parse(text)
    return payload?.statusMessage || payload?.message || payload?.error || text.slice(0, 160)
  } catch {
    return text.replace(/\s+/g, " ").trim().slice(0, 160)
  }
}

async function requestAdminAction(baseUrl, signConfig, action, id, payload = {}) {
  const endpoint = `${normalizeInputUrl(baseUrl)}/api/admin/activitypub`
  const body = JSON.stringify({ action, id, ...payload })
  const signing = await createSignedHeaders(endpoint, "POST", { action, id, ...payload }, signConfig.keyId, signConfig.privateKey)
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Date: signing.date,
      Signature: signing.signature,
      Digest: signing.digest,
      "Content-Type": "application/json",
    },
    body,
  })

  if (!response.ok) {
    const message = await readErrorMessage(response, "Failed to run admin action")
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`)
  }
  return response.json().catch(() => ({}))
}

function normalizeSection(value) {
  if (!value || value === "all") {
    return null
  }
  const section = String(value).toLowerCase()
  if (["follower", "followers", "follow"].includes(section)) {
    return "followers"
  }
  if (["comment", "comments"].includes(section)) {
    return "comments"
  }
  if (["reaction", "reactions", "like", "likes"].includes(section)) {
    return "reactions"
  }
  throw new Error(`Unknown section: ${value}`)
}

function parseRequiredId(value, label) {
  const id = Number.parseInt(String(value || ""), 10)
  if (!Number.isFinite(id)) {
    throw new Error(`${label} id가 필요합니다.`)
  }
  return id
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeList(data, section) {
  const sections = section ? [section] : SECTION_ORDER
  for (const current of sections) {
    const rows = data[current] || []
    process.stdout.write(`# ${SECTIONS[current].label} (${rows.length})\n`)
    if (rows.length === 0) {
      process.stdout.write("항목이 없습니다.\n\n")
      continue
    }
    for (const item of rows) {
      process.stdout.write(`${item.id}\t${formatRow(current, item)}\n`)
    }
    process.stdout.write("\n")
  }
}

async function runCommand(options, signConfig) {
  const command = options.command
  if (command === "list" || command === "ls" || command === "dashboard") {
    const section = normalizeSection(options.args[0])
    const data = await requestAdminData(options.baseUrl, signConfig, options.includeDeleted)
    if (options.json) {
      writeJson(section ? data[section] || [] : data)
      return
    }
    writeList(data, section)
    return
  }

  if (command === "reply") {
    const id = parseRequiredId(options.args[0], "comment")
    const reply = (options.text || options.args.slice(1).join(" ")).trim()
    if (!reply) {
      throw new Error("댓글 답글 내용은 --text 또는 인자로 전달해야 합니다.")
    }
    writeJson(await requestAdminAction(options.baseUrl, signConfig, "comment.reply", id, { reply }))
    return
  }

  if (command === "react-comment") {
    const id = parseRequiredId(options.args[0], "comment")
    const reaction = (options.text || options.args[1] || "❤️").trim()
    writeJson(await requestAdminAction(options.baseUrl, signConfig, "comment.react", id, { reaction }))
    return
  }

  if (command === "delete-comment") {
    const id = parseRequiredId(options.args[0], "comment")
    writeJson(await requestAdminAction(options.baseUrl, signConfig, "comment.delete", id))
    return
  }

  if (command === "delete-reaction") {
    const id = parseRequiredId(options.args[0], "reaction")
    writeJson(await requestAdminAction(options.baseUrl, signConfig, "reaction.delete", id))
    return
  }

  if (command === "unfollow") {
    const id = parseRequiredId(options.args[0], "follower")
    writeJson(await requestAdminAction(options.baseUrl, signConfig, "follower.unfollow", id))
    return
  }

  throw new Error(`Unknown admin command: ${command}`)
}

function createDashboardUi() {
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: "ActivityPub Admin",
    cursor: { artificial: true },
  })

  screen.key(["C-c", "q"], () => process.exit(0))

  const header = blessed.box({
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: "white", bg: "blue" },
    align: "center",
    content: "ActivityPub Admin Dashboard",
  })

  const sectionLabel = blessed.box({
    top: 1,
    left: 1,
    right: 1,
    height: 1,
    content: "",
  })

  const list = blessed.list({
    top: 3,
    left: 1,
    width: "68%",
    bottom: 4,
    border: "line",
    keys: true,
    mouse: true,
    vi: true,
    label: "아이템",
    items: [],
    scrollbar: {
      ch: " ",
      track: { bg: "yellow" },
      style: { inverse: true },
    },
    style: {
      selected: {
        bg: "blue",
        fg: "white",
      },
    },
  })

  const detail = blessed.box({
    top: 3,
    left: "68%",
    right: 1,
    bottom: 4,
    border: "line",
    label: "상세",
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    content: "",
    keys: true,
    vi: true,
  })

  const status = blessed.box({
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    border: { type: "line" },
    label: "조작",
  })

  screen.append(header)
  screen.append(sectionLabel)
  screen.append(list)
  screen.append(detail)
  screen.append(status)

  screen.render()

  return { screen, list, detail, sectionLabel, status }
}

function updateSectionLabel(sectionLabel, state) {
  sectionLabel.setContent(formatSectionCounts(state, state.section))
}

function getSelectedItem(data, section, index) {
  if (index < 0) {
    return null
  }
  return data?.[section]?.[index] ?? null
}

function openTextPrompt(screen, label) {
  return new Promise((resolve) => {
    const prompt = blessed.prompt({
      parent: screen,
      top: "center",
      left: "center",
      width: "80%",
      height: "20%",
      label,
      border: "line",
      keys: true,
      mouse: true,
    })

    prompt.input("", "", (err, value) => {
      screen.remove(prompt)
      screen.render()
      if (err || !value || typeof value !== "string" || !value.trim()) {
        resolve(null)
        return
      }
      resolve(value.trim())
    })
  })
}

async function bootstrap() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  const privateKeyFilePath = getFirstExistingFilePath([
    options.privateKeyFile,
    path.resolve(process.cwd(), "activitypub-admin.key"),
    path.resolve(process.cwd(), ".activitypub-admin.key"),
  ].filter(Boolean))
  const privateKeyText = normalizePemText(options.privateKey || (privateKeyFilePath ? loadPrivateKeyFromFile(privateKeyFilePath) : ""))
  if (!privateKeyText) {
    process.stderr.write("ACTIVITYPUB_ADMIN_PRIVATE_KEY 또는 --private-key / --private-key-file를 설정해주세요.\n")
    process.exit(1)
  }

  const privateKey = await importPrivateKey(privateKeyText).catch((error) => {
    process.stderr.write(`${error?.message || error}\n`)
    process.exit(1)
  })
  const signConfig = {
    keyId: options.keyId,
    privateKey,
  }

  if (options.command) {
    await runCommand(options, signConfig)
    return
  }

  const ui = createDashboardUi()
  const state = {
    followers: [],
    comments: [],
    reactions: [],
    section: "followers",
    selectedIndex: 0,
    userSelectedSection: false,
  }

  updateSectionLabel(ui.sectionLabel, state)

  function renderCurrentSection(message) {
    const listData = state[state.section]
    if (listData.length === 0) {
      state.selectedIndex = -1
      ui.list.setItems(["항목이 없습니다."])
    } else {
      ui.list.setItems(listData.map((item) => formatRow(state.section, item)))
      state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, listData.length - 1))
      ui.list.select(state.selectedIndex)
    }

    updateDetail(ui.detail, state.section, getSelectedItem(state, state.section, state.selectedIndex))
    updateSectionLabel(ui.sectionLabel, state)
    updateStatus(ui.status, message || `${SECTIONS[state.section].label} ${listData.length}개`, false)
    ui.screen.render()
  }

  async function refresh() {
    try {
      updateStatus(ui.status, `데이터 새로고침 중... (${options.baseUrl})`, false)
      ui.screen.render()
      const payload = await requestAdminData(options.baseUrl, signConfig, options.includeDeleted)
      state.followers = payload.followers || []
      state.comments = payload.comments || []
      state.reactions = payload.reactions || []

      if (!state.userSelectedSection && getSectionCount(state, state.section) === 0) {
        const firstNonEmptySection = SECTION_ORDER.find((section) => getSectionCount(state, section) > 0)
        if (firstNonEmptySection) {
          state.section = firstNonEmptySection
          state.selectedIndex = 0
        }
      }

      renderCurrentSection()
    } catch (error) {
      updateStatus(ui.status, String(error?.message || error), true)
      ui.screen.render()
    }
  }

  function switchSection(section) {
    if (state.section === section) {
      return
    }
    state.section = section
    state.selectedIndex = 0
    state.userSelectedSection = true
    renderCurrentSection()
  }

  function applySelection(index) {
    state.selectedIndex = index
    updateDetail(ui.detail, state.section, getSelectedItem(state, state.section, index))
    ui.screen.render()
  }

  async function handleAction(action) {
    const item = getSelectedItem(state, state.section, state.selectedIndex)
    if (!item) {
      updateStatus(ui.status, "선택된 항목이 없습니다.", true)
      return
    }

    if (action === "reply") {
      if (state.section !== "comments") {
        updateStatus(ui.status, "댓글 섹션에서만 대댓글을 작성할 수 있습니다.", true)
        return
      }
      const value = await openTextPrompt(ui.screen, "대댓글")
      if (!value) {
        updateStatus(ui.status, "답글이 취소되었습니다.")
        return
      }
      try {
        await requestAdminAction(options.baseUrl, signConfig, "comment.reply", item.id, { reply: value })
        updateStatus(ui.status, `댓글 ID:${item.id} 대댓글 전송 완료`)
        await refresh()
      } catch (error) {
        updateStatus(ui.status, String(error?.message || error), true)
      }
      return
    }

    if (action === "delete") {
      if (state.section === "followers") {
        updateStatus(ui.status, "팔로워는 언팔로우(u)로 처리하세요.", true)
        return
      }
      const actionName = state.section === "comments" ? "comment.delete" : "reaction.delete"
      try {
        await requestAdminAction(options.baseUrl, signConfig, actionName, item.id)
        updateStatus(ui.status, `항목 ID:${item.id} 삭제 처리`)
        await refresh()
      } catch (error) {
        updateStatus(ui.status, String(error?.message || error), true)
      }
      return
    }

    if (action === "unfollow") {
      if (state.section !== "followers") {
        updateStatus(ui.status, "팔로우 섹션에서만 언팔로우하세요.", true)
        return
      }
      try {
        await requestAdminAction(options.baseUrl, signConfig, "follower.unfollow", item.id)
        updateStatus(ui.status, `팔로워 ID:${item.id} 언팔로우 처리`)
        await refresh()
      } catch (error) {
        updateStatus(ui.status, String(error?.message || error), true)
      }
    }
  }

  ui.list.on("select", (_, index) => {
    applySelection(index)
  })

  ui.screen.key(["1"], () => switchSection(SECTION_ORDER[0]))
  ui.screen.key(["2"], () => switchSection(SECTION_ORDER[1]))
  ui.screen.key(["3"], () => switchSection(SECTION_ORDER[2]))
  ui.screen.key(["r"], () => {
    void handleAction("reply")
  })
  ui.screen.key(["d", "D", "x", "X"], () => {
    void handleAction("delete")
  })
  ui.screen.key(["u", "U"], () => {
    void handleAction("unfollow")
  })
  ui.screen.key(["tab", "space", "R", "C-r"], () => {
    void refresh()
  })

  ui.list.focus()
  await refresh()
}

bootstrap().catch((error) => {
  process.stderr.write(`admin cli failed: ${error?.message || error}\n`)
  process.exit(1)
})
