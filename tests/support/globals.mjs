// Nitro auto-import stand-ins for running server sources under `node --test`.
import Database from "better-sqlite3"
import * as h3 from "h3"

const sqlite = new Database(":memory:")
globalThis.__testSqlite = sqlite

function sqlTemplate(strings, values) {
  let query = strings[0] ?? ""
  for (let index = 1; index < strings.length; index += 1) {
    query += `?${strings[index] ?? ""}`
  }
  return [query.trim(), values.map(normalizeParam)]
}

function normalizeParam(value) {
  if (value === undefined) return null
  if (typeof value === "boolean") return value ? 1 : 0
  if (value instanceof Date) return value.toISOString()
  return value
}

// Mirrors db0's `sql` tagged template: SELECT returns `{ rows }`, everything else
// returns the run result (`{ changes, lastInsertRowid }`).
const database = {
  async sql(strings, ...values) {
    const [query, params] = sqlTemplate(strings, values)
    if (/^select/i.test(query)) {
      return { rows: sqlite.prepare(query).all(...params), success: true }
    }
    const result = sqlite.prepare(query).run(...params)
    return { success: result.changes > 0, ...result }
  },
  async exec(query) {
    return sqlite.exec(query)
  },
  prepare(query) {
    return sqlite.prepare(query)
  },
}

globalThis.useDatabase = () => database
globalThis.defineEventHandler = h3.defineEventHandler
globalThis.defineTask = (task) => task
globalThis.defineNitroPlugin = (plugin) => plugin
globalThis.runTask = async () => {
  throw new Error("runTask is not available in tests")
}
for (const name of [
  "createError",
  "getHeader",
  "getQuery",
  "getRequestURL",
  "readRawBody",
  "setHeader",
  "setResponseHeader",
  "setResponseStatus",
]) {
  globalThis[name] = h3[name]
}
