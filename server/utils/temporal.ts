import { normalizeInstant, nowInstant, tryNormalizeInstant } from "@changkyun/activitypub"

/**
 * Instants are stored and emitted as `Temporal.Instant#toString()` strings
 * (UTC, `Z`, trailing fractional zeros trimmed), as the Fedify-based
 * implementation did.
 */
export function instantFrom(value: string): string {
  return normalizeInstant(value)
}

export function instantFromOrNull(value: unknown): string | null {
  return tryNormalizeInstant(value)
}

export function currentInstant(): string {
  return nowInstant()
}
