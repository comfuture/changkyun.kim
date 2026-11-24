// Minimal stand-in for `@nuxt/content/server` backed by the in-memory test
// database. Set `globalThis.__contentQueryMode = "throw"` to simulate Nuxt
// Content being unavailable.
const JSON_COLUMNS = ["body", "meta", "navigation", "seo", "tags"]

function toItem(row) {
  const item = { ...row }
  for (const column of JSON_COLUMNS) {
    if (typeof item[column] === "string") {
      try {
        item[column] = JSON.parse(item[column])
      } catch {
        // keep raw value
      }
    }
  }
  const meta = item.meta && typeof item.meta === "object" ? item.meta : {}
  delete item.meta
  return { ...meta, ...item }
}

export function queryCollection(_event, collection) {
  const table = collection === "blog" ? "_content_blog" : "_content_app"
  const state = { path: null }
  const run = (fn) => {
    if (globalThis.__contentQueryMode === "throw") {
      return Promise.reject(new Error("Nuxt Content unavailable in tests"))
    }
    return Promise.resolve().then(() => fn(globalThis.__testSqlite))
  }
  const api = {
    path(path) {
      state.path = path
      return api
    },
    first() {
      return run((db) => {
        const row = db.prepare(`SELECT * FROM ${table} WHERE path = ? LIMIT 1`).get(state.path)
        return row ? toItem(row) : null
      })
    },
    count() {
      return run((db) => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)
    },
  }
  return api
}

export function queryCollectionItemSurroundings() {
  return Promise.resolve([])
}
