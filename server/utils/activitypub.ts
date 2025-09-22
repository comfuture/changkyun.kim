export function resolveActorId(input: unknown): string | null {
  if (!input) {
    return null
  }

  if (typeof input === 'string') {
    return input
  }

  if (Array.isArray(input)) {
    for (const entry of input) {
      const candidate = resolveActorId(entry)
      if (candidate) {
        return candidate
      }
    }
    return null
  }

  if (typeof input === 'object') {
    const identifier = (input as { id?: unknown }).id
    if (typeof identifier === 'string' && identifier) {
      return identifier
    }
  }

  return null
}

export function resolveObjectId(input: unknown): string | null {
  if (!input) {
    return null
  }

  if (typeof input === 'string') {
    return input
  }

  if (Array.isArray(input)) {
    for (const entry of input) {
      const candidate = resolveObjectId(entry)
      if (candidate) {
        return candidate
      }
    }
    return null
  }

  if (typeof input === 'object') {
    const identifier = (input as { id?: unknown }).id
    if (typeof identifier === 'string' && identifier) {
      return identifier
    }
  }

  return null
}
