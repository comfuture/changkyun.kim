// Authenticated document loader: signed GETs ("authorized fetch"), SSRF guard,
// redirect/size/time limits, KV caching, double-knocking between the two HTTP
// signature specs (the working spec is remembered per origin).

import { kvGetJson, kvPutJson, type KvStore } from "./kv.ts"
import { importPublicKeyPem } from "./keys.ts"
import {
  CAVAGE,
  KeyFetchError,
  RFC9421,
  signRequest,
  type BodyInput,
  type PublicKeyInfo,
  type SignatureSpec,
  type SigningKey,
} from "./signatures.ts"
import { asArray, firstId, idOf, isActor, isObject, stringValue, type JsonObject } from "./vocab.ts"

export const ACTIVITY_ACCEPT = "application/activity+json, application/ld+json"

export class FetchError extends Error {
  readonly url: string
  readonly status: number | null

  constructor(url: string, message: string, status: number | null = null) {
    super(message)
    this.name = "FetchError"
    this.url = url
    this.status = status
  }
}

export type SignerSource = SigningKey | null | (() => Promise<SigningKey | null>)

export type DocumentLoaderOptions = {
  userAgent: string
  kv: KvStore
  signer?: SignerSource
  fetch?: typeof fetch
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  cacheTtlSeconds?: number
  /** Disables the private-address guard (tests only). */
  allowPrivateAddress?: boolean
  /** Signature spec used for the first attempt against an unknown origin. */
  firstKnock?: SignatureSpec
}

const SPEC_TTL_SECONDS = 30 * 24 * 60 * 60
const DOUBLE_KNOCK_STATUSES = new Set([400, 401, 403])

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a = 0, b = 0] = parts
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
}

function isPrivateIPv6(host: string): boolean {
  const address = host.replace(/^\[|\]$/g, "").toLowerCase()
  if (address === "::" || address === "::1") {
    return true
  }
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address)
  if (mapped?.[1]) {
    return isPrivateIPv4(mapped[1])
  }
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(address)) {
    return true
  }
  return /^f[cd][0-9a-f]{2}:/.test(address) || /^fe[89ab][0-9a-f]:/.test(address) || address.startsWith("ff")
}

/** Rejects non-http(s) URLs, localhost names and private IP literals. */
export function assertPublicUrl(value: string | URL, allowPrivateAddress = false): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new FetchError(String(value), "Invalid URL")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchError(url.href, `Unsupported URL scheme: ${url.protocol}`)
  }
  if (url.username || url.password) {
    throw new FetchError(url.href, "URL credentials are not allowed")
  }
  if (allowPrivateAddress) {
    return url
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new FetchError(url.href, "Private hostnames are not allowed")
  }
  if (isPrivateIPv4(hostname) || (hostname.includes(":") && isPrivateIPv6(hostname))) {
    throw new FetchError(url.href, "Private addresses are not allowed")
  }
  return url
}

function stripFragment(url: string): string {
  const index = url.indexOf("#")
  return index < 0 ? url : url.slice(0, index)
}

async function readLimited(response: Response, maxBytes: number, url: string): Promise<string> {
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new FetchError(url, `Response too large (${declared} bytes)`, response.status)
  }
  if (!response.body) {
    return ""
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new FetchError(url, `Response too large (> ${maxBytes} bytes)`, response.status)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export type SignedFetchInit = {
  method?: string
  headers?: HeadersInit
  body?: BodyInput
  /** Sign the request (default: true when a signer is configured). */
  sign?: boolean
}

export class DocumentLoader {
  readonly options: Required<Omit<DocumentLoaderOptions, "signer" | "fetch">> & Pick<DocumentLoaderOptions, "signer" | "fetch">

  constructor(options: DocumentLoaderOptions) {
    this.options = {
      timeoutMs: 10_000,
      maxBytes: 2 * 1024 * 1024,
      maxRedirects: 5,
      cacheTtlSeconds: 60 * 60,
      allowPrivateAddress: false,
      firstKnock: CAVAGE,
      ...options,
    }
  }

  get kv(): KvStore {
    return this.options.kv
  }

  private get fetchImpl(): typeof fetch {
    return this.options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  }

  async signer(): Promise<SigningKey | null> {
    const source = this.options.signer
    if (!source) {
      return null
    }
    return typeof source === "function" ? await source() : source
  }

  async rememberedSpec(origin: string): Promise<SignatureSpec> {
    const remembered = await this.kv.get(`spec:${origin}`).catch(() => null)
    return remembered === RFC9421 || remembered === CAVAGE ? remembered : this.options.firstKnock
  }

  private async rememberSpec(origin: string, spec: SignatureSpec): Promise<void> {
    await this.kv.put(`spec:${origin}`, spec, { expirationTtl: SPEC_TTL_SECONDS }).catch(() => undefined)
  }

  private async send(url: URL, init: SignedFetchInit, spec: SignatureSpec | null, key: SigningKey | null): Promise<Response> {
    const method = init.method ?? "GET"
    const headers = new Headers(init.headers)
    if (!headers.has("user-agent")) {
      headers.set("user-agent", this.options.userAgent)
    }
    const hasBody = method !== "GET" && method !== "HEAD"
    let request = new Request(url, {
      method,
      headers,
      body: hasBody ? (typeof init.body === "string" ? init.body : init.body ? new Uint8Array(init.body as ArrayBuffer).slice().buffer as ArrayBuffer : "") : undefined,
      redirect: "manual",
    })
    if (spec && key) {
      request = await signRequest(request, key, { spec, body: hasBody ? (init.body ?? "") : null })
    }
    return await this.fetchImpl(request, { redirect: "manual", signal: AbortSignal.timeout(this.options.timeoutMs) })
  }

  /**
   * Performs a (signed) request with SSRF validation, manual redirects and
   * double-knocking. Returns the final response; does not read its body.
   */
  async request(target: string | URL, init: SignedFetchInit = {}): Promise<Response> {
    let url = assertPublicUrl(stripFragment(String(target)), this.options.allowPrivateAddress)
    const key = init.sign === false ? null : await this.signer()
    const visited = new Set<string>()
    for (let redirects = 0; ; redirects += 1) {
      visited.add(url.href)
      const firstSpec = key ? await this.rememberedSpec(url.origin) : null
      let response = await this.send(url, init, firstSpec, key)
      if (key && firstSpec && DOUBLE_KNOCK_STATUSES.has(response.status)) {
        const secondSpec = firstSpec === CAVAGE ? RFC9421 : CAVAGE
        const retry = await this.send(url, init, secondSpec, key)
        if (retry.ok) {
          await this.rememberSpec(url.origin, secondSpec)
        }
        response = retry
      }
      if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
        if (redirects >= this.options.maxRedirects) {
          throw new FetchError(url.href, "Too many redirects", response.status)
        }
        const next = assertPublicUrl(new URL(response.headers.get("location")!, url), this.options.allowPrivateAddress)
        if (visited.has(next.href)) {
          throw new FetchError(url.href, "Redirect loop", response.status)
        }
        url = next
        continue
      }
      return response
    }
  }

  /** Fetches and parses a JSON document. */
  async fetchJson(target: string | URL, options: { accept?: string; sign?: boolean } = {}): Promise<JsonObject> {
    const url = stripFragment(String(target))
    const response = await this.request(url, {
      headers: { accept: options.accept ?? ACTIVITY_ACCEPT },
      sign: options.sign,
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw new FetchError(url, `Failed to fetch ${url}: ${response.status}`, response.status)
    }
    const text = await readLimited(response, this.options.maxBytes, url)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new FetchError(url, `Invalid JSON from ${url}`, response.status)
    }
    if (!isObject(parsed)) {
      throw new FetchError(url, `Unexpected JSON document from ${url}`, response.status)
    }
    return parsed
  }

  /**
   * Loads an ActivityStreams document. With `cache: true` the document is
   * cached in KV (actors and keys).
   */
  async load(target: string | URL, options: { cache?: boolean; refresh?: boolean } = {}): Promise<JsonObject> {
    const url = stripFragment(String(target))
    const cacheKey = `doc:${url}`
    if (options.cache && !options.refresh) {
      const cached = await kvGetJson<JsonObject>(this.kv, cacheKey).catch(() => null)
      if (cached) {
        return cached
      }
    }
    const document = await this.fetchJson(url)
    if (options.cache) {
      await kvPutJson(this.kv, cacheKey, document, this.options.cacheTtlSeconds).catch(() => undefined)
    }
    return document
  }

  /** Loads an actor document (cached). Returns `null` when it is not an actor. */
  async loadActor(actorId: string, options: { refresh?: boolean } = {}): Promise<JsonObject | null> {
    const document = await this.load(actorId, { cache: true, refresh: options.refresh })
    return isActor(document) ? document : null
  }

  /** Stores a document in the KV cache. */
  async remember(target: string, document: JsonObject): Promise<void> {
    await kvPutJson(this.kv, `doc:${stripFragment(target)}`, document, this.options.cacheTtlSeconds).catch(() => undefined)
  }

  async forget(target: string): Promise<void> {
    await this.kv.delete(`doc:${stripFragment(target)}`).catch(() => undefined)
  }

  /** Resolves a public key by key id (actor `publicKey` or standalone key document). */
  async resolveKey(keyId: string, options: { refresh: boolean }): Promise<PublicKeyInfo | null> {
    let document: JsonObject
    try {
      document = await this.load(keyId, { cache: true, refresh: options.refresh })
    } catch (error) {
      throw new KeyFetchError(error instanceof Error ? error.message : String(error), error instanceof FetchError ? error.status : null)
    }
    const candidates: { key: JsonObject; ownerId: string | null }[] = []
    if (typeof document.publicKeyPem === "string") {
      candidates.push({ key: document, ownerId: firstId(document.owner) ?? firstId(document.controller) })
    }
    for (const entry of asArray(document.publicKey)) {
      if (isObject(entry)) {
        candidates.push({ key: entry, ownerId: firstId(entry.owner) ?? idOf(document) })
      }
    }
    const match = candidates.find(({ key }) => idOf(key) === keyId)
      // Some servers use the actor IRI itself as the key id.
      ?? (candidates.length === 1 && keyId === idOf(document) ? candidates[0] : undefined)
    const pem = match ? stringValue(match.key, "publicKeyPem") : null
    if (!match || !pem) {
      return null
    }
    try {
      return { keyId, ownerId: match.ownerId, publicKey: await importPublicKeyPem(pem) }
    } catch {
      return null
    }
  }
}
