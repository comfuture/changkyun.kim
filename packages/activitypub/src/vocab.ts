// Tolerant readers for ActivityStreams 2.0 documents as plain JSON.
//
// This is deliberately not a JSON-LD processor: it understands the compact
// forms real servers emit (single value vs. array, embedded object vs. IRI,
// `@id` / `@value` / `@language` objects, `*Map` language maps, `as:`-prefixed
// and full-IRI type names, and the aliases of the public collection).

export type JsonObject = Record<string, unknown>

export const AS_NAMESPACE = "https://www.w3.org/ns/activitystreams#"
export const PUBLIC_COLLECTION = `${AS_NAMESPACE}Public`
const PUBLIC_ALIASES = new Set([PUBLIC_COLLECTION, "as:Public", "Public"])

const TYPE_PREFIXES = [
  AS_NAMESPACE,
  "as:",
  "http://litepub.social/ns#",
  "litepub:",
  "http://joinmastodon.org/ns#",
  "toot:",
]

export const ACTOR_TYPES = ["Person", "Service", "Application", "Group", "Organization"] as const

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Flattens a property value into an array (`undefined`/`null` become `[]`). */
export function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => asArray(item))
  }
  if (isObject(value) && Array.isArray(value["@list"])) {
    return asArray(value["@list"])
  }
  return [value]
}

/** Returns the IRI of a reference: a string or an object with `id` / `@id`. */
export function idOf(value: unknown): string | null {
  if (typeof value === "string") {
    return value || null
  }
  if (isObject(value)) {
    const id = value.id ?? value["@id"]
    return typeof id === "string" && id ? id : null
  }
  return null
}

export function ids(value: unknown): string[] {
  return asArray(value).map(idOf).filter((id): id is string => id !== null)
}

export function firstId(value: unknown): string | null {
  return ids(value)[0] ?? null
}

/** Normalizes a type name by removing well-known namespace prefixes. */
export function normalizeType(type: string): string {
  for (const prefix of TYPE_PREFIXES) {
    if (type.startsWith(prefix)) {
      return type.slice(prefix.length)
    }
  }
  return type
}

export function typesOf(value: unknown): string[] {
  if (!isObject(value)) {
    return []
  }
  return asArray(value.type ?? value["@type"])
    .filter((type): type is string => typeof type === "string")
    .map(normalizeType)
}

export function hasType(value: unknown, ...types: string[]): boolean {
  const actual = typesOf(value)
  return types.some((type) => actual.includes(type))
}

export function isActor(value: unknown): value is JsonObject {
  return isObject(value) && hasType(value, ...ACTOR_TYPES) && idOf(value) !== null
}

export function isPublicCollection(value: unknown): boolean {
  const id = idOf(value)
  return id !== null && PUBLIC_ALIASES.has(id)
}

/** `to` + `cc` recipients (as Fedify's `toIds` / `ccIds`). */
export function audienceOf(value: unknown): string[] {
  if (!isObject(value)) {
    return []
  }
  return [...ids(value.to), ...ids(value.cc)]
}

/** True when any of the given objects addresses the public collection. */
export function isPubliclyAddressed(...values: unknown[]): boolean {
  return values.some((value) => audienceOf(value).some((id) => PUBLIC_ALIASES.has(id)))
}

function literal(value: unknown): string | null {
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (isObject(value) && typeof value["@value"] === "string") {
    return value["@value"]
  }
  return null
}

/**
 * Reads a natural-language property (`content`, `name`, `summary`, ...),
 * falling back to its language map (`contentMap`, ...).
 */
export function languageValue(value: unknown, property: string): string | null {
  if (!isObject(value)) {
    return null
  }
  for (const item of asArray(value[property])) {
    const text = literal(item)
    if (text !== null) {
      return text
    }
  }
  const map = value[`${property}Map`]
  if (isObject(map)) {
    for (const item of Object.values(map)) {
      const text = asArray(item).map(literal).find((entry) => entry !== null)
      if (text != null) {
        return text
      }
    }
  }
  return null
}

/** First URL of a `url`-like property (string, Link with `href`, or object id). */
export function firstUrl(value: unknown): string | null {
  for (const item of asArray(value)) {
    if (typeof item === "string" && item) {
      return item
    }
    if (isObject(item)) {
      const href = item.href ?? item.id ?? item["@id"]
      if (typeof href === "string" && href) {
        return href
      }
    }
  }
  return null
}

/** URL of an `icon` / `image` property (IRI or Image object with `url`). */
export function imageUrl(value: unknown): string | null {
  for (const item of asArray(value)) {
    if (typeof item === "string" && item) {
      return item
    }
    if (isObject(item)) {
      const url = firstUrl(item.url)
      if (url) {
        return url
      }
    }
  }
  return null
}

/** Returns a string property value if present. */
export function stringValue(value: unknown, property: string): string | null {
  if (!isObject(value)) {
    return null
  }
  for (const item of asArray(value[property])) {
    const text = literal(item)
    if (text !== null) {
      return text
    }
  }
  return null
}

/** Removes `@context` and LD `signature` from a received document. */
export function stripEnvelope<T extends JsonObject>(value: T): JsonObject {
  const { "@context": _context, signature: _signature, ...rest } = value
  return rest
}

/** Replaces the compact public collection aliases with the full IRI. */
export function expandPublicCollection<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => expandPublicCollection(item)) as T
  }
  if (isObject(value)) {
    const result: JsonObject = {}
    for (const [key, item] of Object.entries(value)) {
      if ((key === "to" || key === "cc" || key === "bto" || key === "bcc" || key === "audience") && item !== undefined) {
        result[key] = Array.isArray(item)
          ? item.map((entry) => (typeof entry === "string" && PUBLIC_ALIASES.has(entry) ? PUBLIC_COLLECTION : expandPublicCollection(entry)))
          : typeof item === "string" && PUBLIC_ALIASES.has(item)
            ? PUBLIC_COLLECTION
            : expandPublicCollection(item)
      } else if (key === "@context") {
        result[key] = item
      } else {
        result[key] = expandPublicCollection(item)
      }
    }
    return result as T
  }
  return value
}

/** Same-origin check for two absolute URLs. */
export function sameOrigin(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false
  }
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}
