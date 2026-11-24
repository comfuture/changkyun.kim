// HTTP Signatures: draft-cavage-http-signatures-12 and RFC 9421, plus the
// `Digest` (RFC 3230) and `Content-Digest` (RFC 9530) body digests.

import { base64Decode, base64Encode, sha256, signBytes, verifyBytes } from "./keys.ts"

export type SignatureSpec = "draft-cavage-http-signatures-12" | "rfc9421"
export const CAVAGE: SignatureSpec = "draft-cavage-http-signatures-12"
export const RFC9421: SignatureSpec = "rfc9421"

export type SigningKey = {
  keyId: string
  privateKey: CryptoKey
}

export type BodyInput = string | Uint8Array | ArrayBuffer | null | undefined

export type PublicKeyInfo = {
  keyId: string
  /** The actor that owns the key, when the key document says so. */
  ownerId: string | null
  publicKey: CryptoKey
}

/** Thrown by key resolvers when the key document cannot be fetched. */
export class KeyFetchError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = "KeyFetchError"
    this.status = status
  }
}

export type KeyResolver = (keyId: string, options: { refresh: boolean }) => Promise<PublicKeyInfo | null>

export type VerifyFailureReason =
  | "missing"
  | "malformed"
  | "algorithm"
  | "headers"
  | "digest"
  | "expired"
  | "keyUnavailable"
  | "keyGone"
  | "invalid"

export type VerifyResult =
  | { ok: true; spec: SignatureSpec; key: PublicKeyInfo }
  | { ok: false; reason: VerifyFailureReason; keyId?: string; status?: number | null }

export type VerifyOptions = {
  resolveKey: KeyResolver
  /** Raw request body. When omitted the body is read from a clone of the request. */
  body?: BodyInput
  now?: Date
  /** Allowed clock skew in seconds, or `false` to disable the check. Default 3600. */
  timeWindowSeconds?: number | false
}

const encoder = new TextEncoder()

function toBytes(body: BodyInput): Uint8Array {
  if (body === null || body === undefined) {
    return new Uint8Array()
  }
  if (typeof body === "string") {
    return encoder.encode(body)
  }
  return body instanceof Uint8Array ? body : new Uint8Array(body)
}

async function readBody(request: Request, body: BodyInput): Promise<Uint8Array> {
  if (body !== undefined) {
    return toBytes(body)
  }
  if (request.method === "GET" || request.method === "HEAD" || request.body === null) {
    return new Uint8Array()
  }
  return new Uint8Array(await request.clone().arrayBuffer())
}

// ---------------------------------------------------------------------------
// Digests
// ---------------------------------------------------------------------------

export async function createDigest(body: BodyInput): Promise<string> {
  return `SHA-256=${base64Encode(await sha256(toBytes(body)))}`
}

async function digestBytes(algorithm: string, bytes: Uint8Array): Promise<Uint8Array | null> {
  const name = algorithm.toLowerCase()
  const webCrypto = name === "sha-256" ? "SHA-256" : name === "sha-512" ? "SHA-512" : null
  if (!webCrypto) {
    return null
  }
  return new Uint8Array(await crypto.subtle.digest(webCrypto, bytes.slice().buffer as ArrayBuffer))
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index]! ^ b[index]!
  }
  return diff === 0
}

/** Verifies an RFC 3230 `Digest` header (`SHA-256=...`, `SHA-512=...`). */
export async function verifyDigest(header: string | null, body: BodyInput): Promise<boolean> {
  if (!header) {
    return false
  }
  const bytes = toBytes(body)
  let checked = false
  for (const part of header.split(",")) {
    const separator = part.indexOf("=")
    if (separator < 0) {
      continue
    }
    const expected = await digestBytes(part.slice(0, separator).trim(), bytes)
    if (!expected) {
      continue
    }
    checked = true
    let actual: Uint8Array
    try {
      actual = base64Decode(part.slice(separator + 1).trim())
    } catch {
      return false
    }
    if (!equalBytes(expected, actual)) {
      return false
    }
  }
  return checked
}

export async function createContentDigest(body: BodyInput): Promise<string> {
  return `sha-256=:${base64Encode(await sha256(toBytes(body)))}:`
}

/** Verifies an RFC 9530 `Content-Digest` header. */
export async function verifyContentDigest(header: string | null, body: BodyInput): Promise<boolean> {
  if (!header) {
    return false
  }
  const bytes = toBytes(body)
  let checked = false
  for (const member of splitTopLevel(header, ",")) {
    const match = /^\s*([a-z0-9-]+)\s*=\s*:([^:]*):\s*$/i.exec(member)
    if (!match?.[1] || match[2] === undefined) {
      continue
    }
    const expected = await digestBytes(match[1], bytes)
    if (!expected) {
      continue
    }
    checked = true
    let actual: Uint8Array
    try {
      actual = base64Decode(match[2])
    } catch {
      return false
    }
    if (!equalBytes(expected, actual)) {
      return false
    }
  }
  return checked
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

export type SignRequestOptions = {
  spec?: SignatureSpec
  body?: BodyInput
  now?: Date
}

/** Returns a copy of `request` carrying `Date`, digest and signature headers. */
export async function signRequest(request: Request, key: SigningKey, options: SignRequestOptions = {}): Promise<Request> {
  const spec = options.spec ?? CAVAGE
  const now = options.now ?? new Date()
  const bodyBytes = await readBody(request, options.body)
  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const url = new URL(request.url)
  const headers = new Headers(request.headers)
  headers.set("host", url.host)
  if (!headers.has("date")) {
    headers.set("date", now.toUTCString())
  }

  if (spec === CAVAGE) {
    const signedHeaders = ["(request-target)", "host", "date"]
    if (hasBody) {
      headers.set("digest", await createDigest(bodyBytes))
      signedHeaders.push("digest")
    }
    const signingString = cavageSigningString(request.method, url, headers, signedHeaders, {})
    const signature = await signBytes(key.privateKey, signingString)
    headers.set(
      "signature",
      `keyId="${key.keyId}",algorithm="rsa-sha256",headers="${signedHeaders.join(" ")}",signature="${signature}"`,
    )
  } else {
    const components = ["@method", "@target-uri", "@authority", "host", "date"]
    if (hasBody) {
      headers.set("content-digest", await createContentDigest(bodyBytes))
      components.push("content-digest")
    }
    const created = Math.floor(now.getTime() / 1000)
    const params = `(${components.map((component) => `"${component}"`).join(" ")});alg="rsa-v1_5-sha256";keyid="${key.keyId}";created=${created}`
    const base = rfc9421SignatureBase(request.method, url, headers, components, params)
    if (base === null) {
      throw new Error("Failed to build RFC 9421 signature base.")
    }
    const signature = await signBytes(key.privateKey, base)
    headers.set("signature-input", `sig1=${params}`)
    headers.set("signature", `sig1=:${signature}:`)
  }

  return new Request(request.url, {
    method: request.method,
    headers,
    body: hasBody ? bodyBytes.slice().buffer as ArrayBuffer : undefined,
    redirect: "manual",
  })
}

// ---------------------------------------------------------------------------
// draft-cavage-http-signatures-12
// ---------------------------------------------------------------------------

type CavageParams = {
  keyId?: string
  algorithm?: string
  headers?: string
  signature?: string
  created?: string
  expires?: string
}

export function parseCavageSignature(value: string): CavageParams | null {
  const params: Record<string, string> = {}
  const pattern = /([a-zA-Z]+)\s*=\s*(?:"([^"]*)"|([^,\s]*))/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    if (match[1]) {
      params[match[1]] = match[2] ?? match[3] ?? ""
    }
  }
  if (!params.keyId || !params.signature) {
    return null
  }
  return params
}

function headerValue(headers: Headers, name: string, url: URL): string | null {
  const value = headers.get(name)
  if (value !== null) {
    return value.trim()
  }
  return name === "host" ? url.host : null
}

function cavageSigningString(
  method: string,
  url: URL,
  headers: Headers,
  names: string[],
  params: CavageParams,
): string {
  return names.map((name) => {
    if (name === "(request-target)") {
      return `(request-target): ${method.toLowerCase()} ${url.pathname}${url.search}`
    }
    if (name === "(created)") {
      return `(created): ${params.created ?? ""}`
    }
    if (name === "(expires)") {
      return `(expires): ${params.expires ?? ""}`
    }
    return `${name}: ${headerValue(headers, name, url) ?? ""}`
  }).join("\n")
}

function withinWindow(timestampMs: number, now: Date, windowSeconds: number | false): boolean {
  if (windowSeconds === false) {
    return true
  }
  if (Number.isNaN(timestampMs)) {
    return false
  }
  return Math.abs(now.getTime() - timestampMs) <= windowSeconds * 1000
}

type SignatureCandidate = {
  keyId: string
  verify: (key: CryptoKey) => Promise<boolean>
}

async function cavageCandidate(request: Request, bodyBytes: Uint8Array, options: VerifyOptions): Promise<SignatureCandidate | VerifyResult> {
  const authorization = request.headers.get("authorization")
  const raw = request.headers.get("signature")
    ?? (authorization?.toLowerCase().startsWith("signature ") ? authorization.slice("signature ".length) : null)
  const params = raw ? parseCavageSignature(raw) : null
  if (!params?.keyId || !params.signature) {
    return { ok: false, reason: "malformed" }
  }
  const algorithm = params.algorithm?.toLowerCase()
  if (algorithm && algorithm !== "rsa-sha256" && algorithm !== "hs2019") {
    return { ok: false, reason: "algorithm", keyId: params.keyId }
  }
  const names = (params.headers ?? "date").toLowerCase().split(/\s+/).filter(Boolean)
  const url = new URL(request.url)
  const now = options.now ?? new Date()
  const windowSeconds = options.timeWindowSeconds ?? 3600

  if (!names.includes("(request-target)")) {
    return { ok: false, reason: "headers", keyId: params.keyId }
  }
  if (names.includes("date")) {
    if (!withinWindow(Date.parse(request.headers.get("date") ?? ""), now, windowSeconds)) {
      return { ok: false, reason: "expired", keyId: params.keyId }
    }
  } else if (names.includes("(created)")) {
    if (!withinWindow(Number(params.created) * 1000, now, windowSeconds)) {
      return { ok: false, reason: "expired", keyId: params.keyId }
    }
  } else {
    return { ok: false, reason: "headers", keyId: params.keyId }
  }
  if (params.expires && windowSeconds !== false && Number(params.expires) * 1000 < now.getTime()) {
    return { ok: false, reason: "expired", keyId: params.keyId }
  }
  if (bodyBytes.length > 0 || request.headers.has("digest")) {
    if (!names.includes("digest") || !(await verifyDigest(request.headers.get("digest"), bodyBytes))) {
      return { ok: false, reason: "digest", keyId: params.keyId }
    }
  }
  for (const name of names) {
    if (!name.startsWith("(") && headerValue(request.headers, name, url) === null) {
      return { ok: false, reason: "headers", keyId: params.keyId }
    }
  }

  const signingString = cavageSigningString(request.method, url, request.headers, names, params)
  return {
    keyId: params.keyId,
    verify: (key) => verifyBytes(key, signingString, params.signature!),
  }
}

// ---------------------------------------------------------------------------
// RFC 9421
// ---------------------------------------------------------------------------

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let current = ""
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quoted) {
      current += char
      if (char === "\\") {
        current += value[index + 1] ?? ""
        index += 1
      } else if (char === "\"") {
        quoted = false
      }
      continue
    }
    if (char === "\"") {
      quoted = true
    } else if (char === "(") {
      depth += 1
    } else if (char === ")") {
      depth -= 1
    } else if (char === separator && depth === 0) {
      parts.push(current)
      current = ""
      continue
    }
    current += char
  }
  if (current.trim()) {
    parts.push(current)
  }
  return parts
}

type Rfc9421Input = {
  label: string
  raw: string
  components: string[]
  params: Record<string, string | number | boolean>
}

function parseParams(text: string): Record<string, string | number | boolean> | null {
  const params: Record<string, string | number | boolean> = {}
  for (const part of splitTopLevel(text, ";")) {
    const trimmed = part.trim()
    if (!trimmed) {
      continue
    }
    const separator = trimmed.indexOf("=")
    if (separator < 0) {
      params[trimmed] = true
      continue
    }
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (value.startsWith("\"")) {
      if (!value.endsWith("\"") || value.length < 2) {
        return null
      }
      params[key] = value.slice(1, -1).replace(/\\(.)/g, "$1")
    } else if (/^-?\d+$/.test(value)) {
      params[key] = Number(value)
    } else {
      params[key] = value
    }
  }
  return params
}

export function parseSignatureInput(value: string): Rfc9421Input[] {
  const inputs: Rfc9421Input[] = []
  for (const member of splitTopLevel(value, ",")) {
    const match = /^\s*([a-z*][a-z0-9_.*-]*)\s*=\s*(\(([^)]*)\)(.*))$/i.exec(member)
    if (!match?.[1] || match[2] === undefined || match[3] === undefined || match[4] === undefined) {
      continue
    }
    const components: string[] = []
    let valid = true
    for (const item of match[3].trim().split(/\s+/).filter(Boolean)) {
      const component = /^"([^"]+)"$/.exec(item)
      if (!component?.[1]) {
        valid = false
        break
      }
      components.push(component[1].toLowerCase())
    }
    const params = parseParams(match[4])
    if (!valid || !params) {
      continue
    }
    inputs.push({ label: match[1], raw: match[2].trim(), components, params })
  }
  return inputs
}

function parseSignatureDictionary(value: string): Map<string, string> {
  const signatures = new Map<string, string>()
  for (const member of splitTopLevel(value, ",")) {
    const match = /^\s*([a-z*][a-z0-9_.*-]*)\s*=\s*:([^:]*):/i.exec(member)
    if (match?.[1] && match[2] !== undefined) {
      signatures.set(match[1], match[2])
    }
  }
  return signatures
}

function componentValue(component: string, method: string, url: URL, headers: Headers): string | null {
  switch (component) {
    case "@method":
      return method.toUpperCase()
    case "@target-uri":
      return url.href
    case "@authority":
      return url.host.toLowerCase()
    case "@scheme":
      return url.protocol.slice(0, -1).toLowerCase()
    case "@request-target":
      return `${url.pathname}${url.search}`
    case "@path":
      return url.pathname
    case "@query":
      return url.search || "?"
    default:
      if (component.startsWith("@")) {
        return null
      }
      return headerValue(headers, component, url)
  }
}

function rfc9421SignatureBase(method: string, url: URL, headers: Headers, components: string[], rawParams: string): string | null {
  const lines: string[] = []
  for (const component of components) {
    const value = componentValue(component, method, url, headers)
    if (value === null) {
      return null
    }
    lines.push(`"${component}": ${value}`)
  }
  lines.push(`"@signature-params": ${rawParams}`)
  return lines.join("\n")
}

async function rfc9421Candidates(request: Request, bodyBytes: Uint8Array, options: VerifyOptions): Promise<SignatureCandidate[] | VerifyResult> {
  const inputs = parseSignatureInput(request.headers.get("signature-input") ?? "")
  const signatures = parseSignatureDictionary(request.headers.get("signature") ?? "")
  const now = options.now ?? new Date()
  const windowSeconds = options.timeWindowSeconds ?? 3600
  const url = new URL(request.url)
  const candidates: SignatureCandidate[] = []
  let failure: VerifyResult = { ok: false, reason: "malformed" }

  for (const input of inputs) {
    const signature = signatures.get(input.label)
    const keyId = typeof input.params.keyid === "string" ? input.params.keyid : null
    if (!signature || !keyId) {
      continue
    }
    const alg = input.params.alg
    if (alg !== undefined && alg !== "rsa-v1_5-sha256") {
      failure = { ok: false, reason: "algorithm", keyId }
      continue
    }
    if (!input.components.includes("@method")
      || !(input.components.includes("@target-uri") || input.components.includes("@path") || input.components.includes("@request-target"))) {
      failure = { ok: false, reason: "headers", keyId }
      continue
    }
    const created = typeof input.params.created === "number"
      ? input.params.created * 1000
      : Date.parse(request.headers.get("date") ?? "")
    if (!withinWindow(created, now, windowSeconds)) {
      failure = { ok: false, reason: "expired", keyId }
      continue
    }
    if (typeof input.params.expires === "number" && windowSeconds !== false && input.params.expires * 1000 < now.getTime()) {
      failure = { ok: false, reason: "expired", keyId }
      continue
    }
    if (bodyBytes.length > 0 || request.headers.has("content-digest")) {
      if (!input.components.includes("content-digest")
        || !(await verifyContentDigest(request.headers.get("content-digest"), bodyBytes))) {
        failure = { ok: false, reason: "digest", keyId }
        continue
      }
    }
    const base = rfc9421SignatureBase(request.method, url, request.headers, input.components, input.raw)
    if (base === null) {
      failure = { ok: false, reason: "headers", keyId }
      continue
    }
    candidates.push({ keyId, verify: (key) => verifyBytes(key, base, signature) })
  }

  return candidates.length > 0 ? candidates : failure
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export function detectSignatureSpec(request: Request): SignatureSpec | null {
  if (request.headers.has("signature-input")) {
    return RFC9421
  }
  if (request.headers.has("signature") || request.headers.get("authorization")?.toLowerCase().startsWith("signature ")) {
    return CAVAGE
  }
  return null
}

async function verifyCandidate(candidate: SignatureCandidate, resolveKey: KeyResolver): Promise<VerifyResult> {
  let key: PublicKeyInfo | null
  try {
    key = await resolveKey(candidate.keyId, { refresh: false })
  } catch (error) {
    const status = error instanceof KeyFetchError ? error.status : null
    return { ok: false, reason: status === 404 || status === 410 ? "keyGone" : "keyUnavailable", keyId: candidate.keyId, status }
  }
  if (key && await candidate.verify(key.publicKey)) {
    return { ok: true, spec: CAVAGE, key }
  }
  // The key may have been rotated since it was cached: re-fetch once.
  try {
    key = await resolveKey(candidate.keyId, { refresh: true })
  } catch (error) {
    const status = error instanceof KeyFetchError ? error.status : null
    return { ok: false, reason: status === 404 || status === 410 ? "keyGone" : "keyUnavailable", keyId: candidate.keyId, status }
  }
  if (key && await candidate.verify(key.publicKey)) {
    return { ok: true, spec: CAVAGE, key }
  }
  return { ok: false, reason: key ? "invalid" : "keyUnavailable", keyId: candidate.keyId }
}

/** Verifies the HTTP signature of an incoming request (either spec). */
export async function verifyRequest(request: Request, options: VerifyOptions): Promise<VerifyResult> {
  const spec = detectSignatureSpec(request)
  if (!spec) {
    return { ok: false, reason: "missing" }
  }
  const bodyBytes = await readBody(request, options.body)
  if (spec === CAVAGE) {
    const candidate = await cavageCandidate(request, bodyBytes, options)
    if ("ok" in candidate) {
      return candidate
    }
    return await verifyCandidate(candidate, options.resolveKey)
  }

  const candidates = await rfc9421Candidates(request, bodyBytes, options)
  if (!Array.isArray(candidates)) {
    return candidates
  }
  let last: VerifyResult = { ok: false, reason: "invalid" }
  for (const candidate of candidates) {
    const result = await verifyCandidate(candidate, options.resolveKey)
    if (result.ok) {
      return { ...result, spec: RFC9421 }
    }
    last = result
  }
  return last
}
