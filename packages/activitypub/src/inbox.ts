// Inbox pipeline: parse → HTTP signature verification → signer-owns-actor →
// idempotency → dispatch.

import type { KvStore } from "./kv.ts"
import { sha256Hex } from "./keys.ts"
import type { DocumentLoader } from "./loader.ts"
import { verifyRequest, type PublicKeyInfo, type VerifyFailureReason } from "./signatures.ts"
import { asArray, firstId, hasType, idOf, isObject, type JsonObject } from "./vocab.ts"

const IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024

export type InboxDispatchMeta = {
  keyId: string
  signerId: string
}

export type HandleInboxOptions = {
  loader: DocumentLoader
  kv: KvStore
  /** Called with every verified, not-yet-processed activity (enqueue or process). */
  dispatch: (activity: JsonObject, meta: InboxDispatchMeta) => Promise<void>
  /** Return false for unknown personal-inbox recipients (→ 404). */
  recipientExists?: () => boolean | Promise<boolean>
  timeWindowSeconds?: number | false
  now?: Date
  maxBodyBytes?: number
  onRejected?: (reason: string, detail: Record<string, unknown>) => void
  onError?: (error: unknown, activity: JsonObject) => void
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } })
}

function idempotencyKey(hash: string): string {
  return `inbox:${hash}`
}

export async function isActivityProcessed(kv: KvStore, activityId: string | null): Promise<boolean> {
  if (!activityId) {
    return false
  }
  return (await kv.get(idempotencyKey(await sha256Hex(activityId))).catch(() => null)) !== null
}

export async function markActivityProcessed(kv: KvStore, activityId: string | null): Promise<void> {
  if (!activityId) {
    return
  }
  await kv.put(idempotencyKey(await sha256Hex(activityId)), "1", { expirationTtl: IDEMPOTENCY_TTL_SECONDS }).catch(() => undefined)
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}

/**
 * Does the key belong to the actor? A key's own `owner` claim is only trusted
 * when the key lives on the actor's origin; otherwise the actor document must
 * list the key itself, so a key hosted elsewhere cannot claim another actor.
 */
export async function doesActorOwnKey(loader: DocumentLoader, actorId: string, key: PublicKeyInfo): Promise<boolean> {
  if (key.ownerId === actorId && sameOrigin(key.keyId, actorId)) {
    return true
  }
  try {
    const actor = await loader.loadActor(actorId)
    return Boolean(actor && asArray(actor.publicKey).some((entry) => idOf(entry) === key.keyId))
  } catch {
    return false
  }
}

const REJECTION_STATUS: Record<VerifyFailureReason, number> = {
  missing: 401,
  malformed: 401,
  algorithm: 401,
  headers: 401,
  digest: 401,
  expired: 401,
  keyUnavailable: 401,
  keyGone: 401,
  invalid: 401,
}

/**
 * Handles a POST to an inbox. Status codes: 202 accepted (also for already
 * processed activities and for `Delete`s whose key is gone), 400 malformed,
 * 401 unverifiable, 404 unknown recipient, 413 body too large, 500 dispatch
 * failure.
 */
export async function handleInbox(request: Request, options: HandleInboxOptions): Promise<Response> {
  if (options.recipientExists && !(await options.recipientExists())) {
    return textResponse(404, "Not found.")
  }

  const raw = new Uint8Array(await request.arrayBuffer())
  if (raw.byteLength > (options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES)) {
    return textResponse(413, "Payload too large.")
  }
  let activity: unknown
  try {
    activity = JSON.parse(new TextDecoder().decode(raw))
  } catch {
    return textResponse(400, "Invalid JSON.")
  }
  if (!isObject(activity) || !(typeof activity.type === "string" || Array.isArray(activity.type))) {
    return textResponse(400, "Invalid activity.")
  }
  const actorId = firstId(activity.actor)
  if (!actorId) {
    return textResponse(400, "Missing actor.")
  }

  const verification = await verifyRequest(request, {
    body: raw,
    resolveKey: (keyId, keyOptions) => options.loader.resolveKey(keyId, keyOptions),
    now: options.now,
    timeWindowSeconds: options.timeWindowSeconds,
  })
  if (!verification.ok) {
    if (verification.reason === "keyGone" && hasType(activity, "Delete")) {
      // The actor (and its key) is gone, typically an account deletion.
      return textResponse(202, "")
    }
    options.onRejected?.(verification.reason, { keyId: verification.keyId, actorId })
    return textResponse(REJECTION_STATUS[verification.reason], "Failed to verify the request signature.")
  }

  if (!(await doesActorOwnKey(options.loader, actorId, verification.key))) {
    options.onRejected?.("actorKeyMismatch", { keyId: verification.key.keyId, actorId })
    return textResponse(401, "The signer and the actor do not match.")
  }

  const activityId = idOf(activity)
  if (await isActivityProcessed(options.kv, activityId)) {
    return textResponse(202, `Activity <${activityId}> has already been processed.`)
  }

  try {
    await options.dispatch(activity, { keyId: verification.key.keyId, signerId: actorId })
  } catch (error) {
    options.onError?.(error, activity)
    return textResponse(500, "Internal server error.")
  }
  return textResponse(202, "")
}
