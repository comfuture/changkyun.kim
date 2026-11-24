// Minimal key-value abstraction compatible with a Cloudflare KV namespace.

export interface KvStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

/** Structural subset of a Cloudflare `KVNamespace` binding. */
export type KvNamespaceLike = {
  get(key: string, type?: "text"): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>
  delete(key: string): Promise<unknown>
}

// Cloudflare KV rejects expirationTtl values below 60 seconds.
const MIN_KV_TTL_SECONDS = 60

export function kvFromNamespace(namespace: KvNamespaceLike, prefix = ""): KvStore {
  return {
    async get(key) {
      return await namespace.get(`${prefix}${key}`, "text")
    },
    async put(key, value, options) {
      const ttl = options?.expirationTtl
      await namespace.put(`${prefix}${key}`, value, ttl ? { expirationTtl: Math.max(MIN_KV_TTL_SECONDS, Math.ceil(ttl)) } : undefined)
    },
    async delete(key) {
      await namespace.delete(`${prefix}${key}`)
    },
  }
}

export class MemoryKvStore implements KvStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number | null }>()

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key)
    if (!entry) {
      return null
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return null
    }
    return entry.value
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null,
    })
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key)
  }

  clear() {
    this.entries.clear()
  }

  keys(): string[] {
    return Array.from(this.entries.keys())
  }
}

export async function kvGetJson<T>(kv: KvStore, key: string): Promise<T | null> {
  const raw = await kv.get(key)
  if (raw === null) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function kvPutJson(kv: KvStore, key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  await kv.put(key, JSON.stringify(value), ttlSeconds ? { expirationTtl: ttlSeconds } : undefined)
}
