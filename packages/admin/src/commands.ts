import process from "node:process"

import { requestAdminAction, requestAdminData } from "./api.ts"
import { formatRow } from "./format.ts"
import { normalizeSection, SECTION_ORDER, SECTIONS } from "./sections.ts"
import type { AdminDashboardData, CliOptions, SectionKey, SignConfig } from "./types.ts"

function parseRequiredId(value: string | undefined, label: string): number {
  const id = Number.parseInt(String(value || ""), 10)
  if (!Number.isFinite(id)) {
    throw new Error(`${label} id가 필요합니다.`)
  }
  return id
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeList(data: AdminDashboardData, section: SectionKey | null): void {
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

export async function runCommand(options: CliOptions, signConfig: SignConfig): Promise<void> {
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

  if (command === "follow") {
    const id = parseRequiredId(options.args[0], "follower")
    writeJson(await requestAdminAction(options.baseUrl, signConfig, "follower.follow", id))
    return
  }

  if (command === "unfollow") {
    const id = parseRequiredId(options.args[0], "follower")
    writeJson(await requestAdminAction(options.baseUrl, signConfig, "follower.unfollow", id))
    return
  }

  throw new Error(`Unknown admin command: ${command}`)
}
