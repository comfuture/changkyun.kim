import {
  attachBlueskyCardThumbnail,
  BlueskyRecordConflictError,
  buildBlueskyShareDraft,
  createBlueskySession,
  createOrReconcileBlueskyPost,
  nextBlueskyAttemptAt,
  sanitizeBlueskyError,
  type BlueskyConfig,
  type BlueskyPostRecord,
} from "./bluesky"
import {
  resolvePublicArticleUrl,
  SITE_ORIGIN,
  type FedifyContentEntry,
} from "./fedifyContent"

const BLUESKY_SHARE_BATCH_SIZE = 20

type BlueskyShareRow = {
  sourceActivityId: string
  recordKey: string
  recordJson: string
  coverImageUrl: string | null
  attemptCount: number
}

export type BlueskyShareRunResult = {
  configuration: BlueskyConfig["status"]
  attempted: number
  shared: number
  pending: number
  failed: number
  conflicts: number
  thumbnailFallbacks: number
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function changesValue(result: unknown): number {
  return numberValue((result as { changes?: unknown } | null)?.changes)
}

function parseBlueskyPostRecord(value: string): BlueskyPostRecord {
  const record = JSON.parse(value) as Partial<BlueskyPostRecord>
  if (
    record.$type !== "app.bsky.feed.post"
    || typeof record.text !== "string"
    || typeof record.createdAt !== "string"
    || record.embed?.$type !== "app.bsky.embed.external"
    || typeof record.embed.external?.uri !== "string"
    || typeof record.embed.external?.title !== "string"
    || typeof record.embed.external?.description !== "string"
  ) {
    throw new Error("Persisted Bluesky post payload is invalid.")
  }
  return record as BlueskyPostRecord
}

function toShareRow(row: Record<string, any>): BlueskyShareRow {
  return {
    sourceActivityId: String(row.source_activity_id ?? ""),
    recordKey: String(row.record_key ?? ""),
    recordJson: String(row.record_json ?? ""),
    coverImageUrl: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    attemptCount: numberValue(row.attempt_count),
  }
}

async function pendingShareCount(): Promise<number> {
  const db = useDatabase()
  const { rows } = await db.sql`
    SELECT COUNT(*) AS count
    FROM bluesky_shares
    WHERE status = 'pending'
  `
  return numberValue((rows?.[0] as Record<string, unknown> | undefined)?.count)
}

async function listDueShares(now: Date): Promise<BlueskyShareRow[]> {
  const db = useDatabase()
  const { rows } = await db.sql`
    SELECT
      source_activity_id,
      record_key,
      record_json,
      cover_image_url,
      attempt_count
    FROM bluesky_shares
    WHERE status = 'pending'
      AND datetime(next_attempt_at) <= datetime(${now.toISOString()})
    ORDER BY datetime(next_attempt_at) ASC, created_at ASC
    LIMIT ${BLUESKY_SHARE_BATCH_SIZE}
  `
  return ((rows ?? []) as Record<string, any>[]).map(toShareRow)
}

async function markShareForRetry(
  row: BlueskyShareRow,
  error: unknown,
  now: Date,
): Promise<void> {
  const db = useDatabase()
  const attemptCount = row.attemptCount + 1
  const nextAttemptAt = nextBlueskyAttemptAt(attemptCount, now)
  const lastError = sanitizeBlueskyError(error).slice(0, 240)
  await db.sql`
    UPDATE bluesky_shares
    SET status = 'pending',
        attempt_count = ${attemptCount},
        next_attempt_at = ${nextAttemptAt},
        last_error = ${lastError},
        updated_at = CURRENT_TIMESTAMP
    WHERE source_activity_id = ${row.sourceActivityId}
  `
}

async function markShareConflict(row: BlueskyShareRow, error: unknown): Promise<void> {
  const db = useDatabase()
  const lastError = sanitizeBlueskyError(error).slice(0, 240)
  await db.sql`
    UPDATE bluesky_shares
    SET status = 'conflict',
        attempt_count = ${row.attemptCount + 1},
        next_attempt_at = NULL,
        last_error = ${lastError},
        updated_at = CURRENT_TIMESTAMP
    WHERE source_activity_id = ${row.sourceActivityId}
  `
}

async function persistPreparedRecord(
  row: BlueskyShareRow,
  record: BlueskyPostRecord,
): Promise<void> {
  const db = useDatabase()
  const recordJson = JSON.stringify(record)
  await db.sql`
    UPDATE bluesky_shares
    SET record_json = ${recordJson},
        cover_image_url = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE source_activity_id = ${row.sourceActivityId}
  `
  row.recordJson = recordJson
  row.coverImageUrl = null
}

async function markSharePosted(
  row: BlueskyShareRow,
  result: { uri: string; cid: string | null },
): Promise<void> {
  const db = useDatabase()
  await db.sql`
    UPDATE bluesky_shares
    SET status = 'posted',
        at_uri = ${result.uri},
        cid = ${result.cid},
        attempt_count = ${row.attemptCount + 1},
        next_attempt_at = NULL,
        last_error = NULL,
        posted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE source_activity_id = ${row.sourceActivityId}
  `
}

export async function queueBlueskyShare(
  sourceActivityId: string,
  entry: FedifyContentEntry,
  now = new Date(),
): Promise<boolean> {
  const publicUrl = resolvePublicArticleUrl(entry)
  if (!publicUrl) {
    return false
  }
  const db = useDatabase()
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const draft = buildBlueskyShareDraft(entry, publicUrl, {
      now,
      siteOrigin: SITE_ORIGIN,
    })
    const result = await db.sql`
      INSERT OR IGNORE INTO bluesky_shares (
        source_activity_id,
        source_url,
        record_key,
        record_json,
        cover_image_url,
        status,
        attempt_count,
        next_attempt_at
      ) VALUES (
        ${sourceActivityId},
        ${publicUrl.href},
        ${draft.recordKey},
        ${JSON.stringify(draft.record)},
        ${draft.coverImageUrl},
        'pending',
        0,
        ${now.toISOString()}
      )
    `
    if (changesValue(result) > 0) {
      return true
    }

    const { rows } = await db.sql`
      SELECT 1
      FROM bluesky_shares
      WHERE source_activity_id = ${sourceActivityId}
      LIMIT 1
    `
    if (rows?.length) {
      return false
    }
  }
  throw new Error("Unable to reserve a unique Bluesky record key.")
}

function emptyResult(configuration: BlueskyConfig["status"], pending: number): BlueskyShareRunResult {
  return {
    configuration,
    attempted: 0,
    shared: 0,
    pending,
    failed: 0,
    conflicts: 0,
    thumbnailFallbacks: 0,
  }
}

export async function processPendingBlueskyShares(
  config: BlueskyConfig,
  options: {
    fetcher?: typeof fetch
    now?: Date
  } = {},
): Promise<BlueskyShareRunResult> {
  const now = options.now ?? new Date()
  const fetcher = options.fetcher ?? fetch
  const pendingBefore = await pendingShareCount()

  if (config.status === "disabled") {
    return emptyResult(config.status, pendingBefore)
  }
  if (config.status === "incomplete") {
    console.error("Bluesky sharing is not configured: both BSKY_USER and BSKY_PASSWORD are required.")
    return {
      ...emptyResult(config.status, pendingBefore),
      failed: pendingBefore > 0 ? 1 : 0,
    }
  }

  const dueShares = await listDueShares(now)
  const result = emptyResult(config.status, pendingBefore)
  if (!dueShares.length) {
    return result
  }

  let session
  try {
    session = await createBlueskySession(config, fetcher)
  } catch (error) {
    console.error(sanitizeBlueskyError(error))
    for (const row of dueShares) {
      try {
        await markShareForRetry(row, error, now)
      } catch {
        console.error("Failed to persist a Bluesky share retry.")
      }
    }
    result.attempted = dueShares.length
    result.failed = dueShares.length
    result.pending = await pendingShareCount()
    return result
  }

  for (const row of dueShares) {
    result.attempted += 1
    try {
      let record = parseBlueskyPostRecord(row.recordJson)
      if (row.coverImageUrl) {
        const thumbnail = await attachBlueskyCardThumbnail(
          session,
          record,
          row.coverImageUrl,
          fetcher,
        )
        record = thumbnail.record
        if (thumbnail.outcome === "skipped") {
          result.thumbnailFallbacks += 1
        }
        await persistPreparedRecord(row, record)
      }

      const posted = await createOrReconcileBlueskyPost(
        session,
        row.recordKey,
        record,
        fetcher,
      )
      await markSharePosted(row, posted)
      result.shared += 1
    } catch (error) {
      result.failed += 1
      console.error(sanitizeBlueskyError(error))
      try {
        if (error instanceof BlueskyRecordConflictError) {
          await markShareConflict(row, error)
          result.conflicts += 1
        } else {
          await markShareForRetry(row, error, now)
        }
      } catch {
        console.error("Failed to persist a Bluesky share failure.")
      }
    }
  }

  result.pending = await pendingShareCount()
  return result
}
