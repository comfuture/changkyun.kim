export function normalizeRoutePath(path?: string | null) {
  if (!path) {
    return '/'
  }

  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized.length === 1) {
    return normalized
  }

  return normalized.replace(/\/+$/, '') || '/'
}
