// Instant normalization compatible with `Temporal.Instant#toString()`:
// UTC, `Z` suffix, seconds always present, fractional seconds trimmed of
// trailing zeros (up to nanosecond precision). An explicit offset is required.

const INSTANT_PATTERN = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?([Zz]|[+-]\d{2}(?::?\d{2})?)$/

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0")
}

/**
 * Normalizes an RFC 3339 date-time string. Throws `RangeError` for values
 * Temporal would reject (missing offset, date only, out of range fields).
 */
export function normalizeInstant(value: string): string {
  const match = INSTANT_PATTERN.exec(value.trim())
  if (!match) {
    throw new RangeError(`Invalid instant: ${value}`)
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, offsetText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Math.min(Number(secondText ?? "0"), 59)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new RangeError(`Invalid instant: ${value}`)
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) {
    throw new RangeError(`Invalid instant: ${value}`)
  }

  let offsetMinutes = 0
  if (offsetText && offsetText.toUpperCase() !== "Z") {
    const sign = offsetText.startsWith("-") ? -1 : 1
    const digits = offsetText.slice(1).replace(":", "")
    const offsetHours = Number(digits.slice(0, 2))
    const offsetMins = Number(digits.slice(2, 4) || "0")
    if (offsetHours > 23 || offsetMins > 59) {
      throw new RangeError(`Invalid instant: ${value}`)
    }
    offsetMinutes = sign * (offsetHours * 60 + offsetMins)
  }

  const utc = new Date(0)
  utc.setUTCFullYear(year, month - 1, day)
  utc.setUTCHours(hour, minute, second, 0)
  const epoch = utc.getTime() - offsetMinutes * 60_000
  if (Number.isNaN(epoch)) {
    throw new RangeError(`Invalid instant: ${value}`)
  }
  const date = new Date(epoch)
  const resultYear = date.getUTCFullYear()
  const yearPart = resultYear >= 0 && resultYear <= 9999
    ? pad(resultYear, 4)
    : `${resultYear < 0 ? "-" : "+"}${pad(Math.abs(resultYear), 6)}`
  const trimmedFraction = (fraction ?? "").replace(/0+$/, "")
  return `${yearPart}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}${trimmedFraction ? `.${trimmedFraction}` : ""}Z`
}

/** Like {@link normalizeInstant} but returns `null` instead of throwing. */
export function tryNormalizeInstant(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  try {
    return normalizeInstant(value)
  } catch {
    return null
  }
}

/** The current instant in normalized form. */
export function nowInstant(now: Date = new Date()): string {
  return normalizeInstant(now.toISOString())
}
