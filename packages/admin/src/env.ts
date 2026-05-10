import fs from "node:fs"
import path from "node:path"
import process from "node:process"

export const DEFAULT_ADMIN_KEY_ID = "https://changkyun.kim/@me#main-key"
export const DEFAULT_ADMIN_BASE_URL = "https://changkyun.kim"

function decodeEnvEscape(value: string): string {
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

function parseQuotedEnvValue(rawValue: string, quote: string): string {
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

function parseUnquotedEnvValue(rawValue: string): string {
  for (let i = 0; i < rawValue.length; i += 1) {
    if (rawValue[i] === "#" && (i === 0 || /\s/.test(rawValue[i - 1] ?? ""))) {
      return rawValue.slice(0, i).trimEnd()
    }
  }
  return rawValue.trimEnd()
}

function parseEnvLine(line: string): [string, string] | null {
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
    return [key, parseQuotedEnvValue(rawValue, rawValue[0] ?? "")]
  }
  return [key, parseUnquotedEnvValue(rawValue)]
}

function loadEnvFile(filePath: string): void {
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

export function loadDefaultEnvFiles(): void {
  const cwd = path.resolve(process.cwd())
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "..", "..")]
  for (const name of [".env", ".env.local"]) {
    for (const dir of candidates) {
      loadEnvFile(path.resolve(dir, name))
    }
  }
}
