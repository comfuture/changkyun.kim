import { Temporal as TemporalPolyfill } from "@js-temporal/polyfill"

export type TemporalInstant = Temporal.Instant

export function temporalInstantFrom(value: string): TemporalInstant {
  return TemporalPolyfill.Instant.from(value) as unknown as TemporalInstant
}

export function temporalNowInstant(): TemporalInstant {
  return TemporalPolyfill.Now.instant() as unknown as TemporalInstant
}
