// Outgoing delivery: recipient → inbox resolution, queue message shapes,
// signed POST with retry classification and backoff.

import { FetchError, ACTIVITY_ACCEPT, type DocumentLoader } from "./loader.ts"
import { idOf, isObject, type JsonObject } from "./vocab.ts"

export const QUEUE_MESSAGE_VERSION = 1

export type DeliveryMessage = {
  v: typeof QUEUE_MESSAGE_VERSION
  type: "deliver"
  inbox: string
  activity: JsonObject
  attempt?: number
}

export type InboxQueueMessage = {
  v: typeof QUEUE_MESSAGE_VERSION
  type: "inbox"
  activity: JsonObject
  keyId?: string
  receivedAt?: string
}

export type QueueMessage = DeliveryMessage | InboxQueueMessage

export function isQueueMessage(value: unknown): value is QueueMessage {
  if (!isObject(value) || value.v !== QUEUE_MESSAGE_VERSION || !isObject(value.activity)) {
    return false
  }
  return (value.type === "deliver" && typeof value.inbox === "string") || value.type === "inbox"
}

export function deliveryMessages(activity: JsonObject, inboxes: string[]): DeliveryMessage[] {
  return inboxes.map((inbox) => ({ v: QUEUE_MESSAGE_VERSION, type: "deliver", inbox, activity, attempt: 0 }))
}

function inboxOf(actor: JsonObject, preferSharedInbox: boolean): string | null {
  if (preferSharedInbox && isObject(actor.endpoints)) {
    const shared = idOf(actor.endpoints.sharedInbox)
    if (shared) {
      return shared
    }
  }
  return idOf(actor.inbox)
}

/**
 * Resolves actors to inbox URLs: shared inbox first (when preferred), one
 * entry per distinct inbox, own-origin inboxes excluded.
 */
export function resolveInboxes(
  recipients: JsonObject[],
  options: { preferSharedInbox?: boolean; excludeOrigins?: string[] } = {},
): string[] {
  const preferShared = options.preferSharedInbox ?? true
  const excluded = new Set(options.excludeOrigins ?? [])
  const inboxes = new Set<string>()
  for (const recipient of recipients) {
    const inbox = inboxOf(recipient, preferShared)
    if (!inbox) {
      continue
    }
    try {
      const url = new URL(inbox)
      if (excluded.has(url.origin)) {
        continue
      }
      inboxes.add(url.href)
    } catch {
      continue
    }
  }
  return Array.from(inboxes)
}

export type DeliveryResult = {
  ok: boolean
  status: number | null
  /** No point retrying (gone inbox or disallowed target). */
  permanent: boolean
  error?: string
}

const PERMANENT_STATUSES = new Set([404, 410])

/** Signs and POSTs an activity to one inbox. Never throws. */
export async function deliverActivity(loader: DocumentLoader, inbox: string, activity: JsonObject): Promise<DeliveryResult> {
  let response: Response
  try {
    response = await loader.request(inbox, {
      method: "POST",
      headers: {
        "content-type": "application/activity+json",
        accept: ACTIVITY_ACCEPT,
      },
      body: JSON.stringify(activity),
    })
  } catch (error) {
    const disallowed = error instanceof FetchError && error.status === null && /not allowed|Unsupported|Invalid URL/.test(error.message)
    return { ok: false, status: null, permanent: disallowed, error: error instanceof Error ? error.message : String(error) }
  }
  await response.body?.cancel().catch(() => undefined)
  if (response.ok) {
    return { ok: true, status: response.status, permanent: false }
  }
  return {
    ok: false,
    status: response.status,
    permanent: PERMANENT_STATUSES.has(response.status),
    error: `${response.status} ${response.statusText}`.trim(),
  }
}

/** Exponential backoff for queue retries: 1m, 4m, 16m, 64m, 256m, capped at 12h. */
export function retryDelaySeconds(attempts: number): number {
  const exponent = Math.max(0, attempts - 1)
  return Math.min(60 * 4 ** exponent, 12 * 60 * 60)
}
