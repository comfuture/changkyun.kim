import { getHeader, sendRedirect } from 'h3'

import { me, setJsonLdHeader } from '../../utils/federation'

const HTML_MEDIA_TYPES = new Set(['text/html', 'application/xhtml+xml'])

type ParsedMediaType = {
  value: string
  q: number
  params: Record<string, string>
}

function parseAcceptHeader(accept?: string | null): ParsedMediaType[] {
  if (!accept) {
    return []
  }

  return accept
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [valuePart, ...paramParts] = entry.split(';')
      const value = valuePart.trim().toLowerCase()
      const params: Record<string, string> = {}
      let q = 1

      for (const part of paramParts) {
        const [rawKey, ...rawValueParts] = part.split('=')
        if (!rawKey) {
          continue
        }

        const key = rawKey.trim().toLowerCase()
        let paramValue = rawValueParts.join('=').trim()
        if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
          paramValue = paramValue.slice(1, -1)
        }

        if (key === 'q') {
          const parsed = Number.parseFloat(paramValue)
          if (!Number.isNaN(parsed)) {
            q = parsed
          }
        }

        if (paramValue.length > 0) {
          params[key] = paramValue.toLowerCase()
        }
      }

      return { value, q, params }
    })
}

function getMaxWeight(entries: ParsedMediaType[], predicate: (entry: ParsedMediaType) => boolean): number {
  let weight = 0
  for (const entry of entries) {
    if (entry.q <= 0) {
      continue
    }
    if (!predicate(entry)) {
      continue
    }
    if (entry.q > weight) {
      weight = entry.q
    }
  }
  return weight
}

function isHtmlMediaType(entry: ParsedMediaType): boolean {
  return HTML_MEDIA_TYPES.has(entry.value)
}

function isActivityMediaType(entry: ParsedMediaType): boolean {
  if (!entry.value.includes('json')) {
    return false
  }

  if (entry.value === 'application/activity+json') {
    return true
  }

  if (entry.value.endsWith('activity+json')) {
    return true
  }

  const profile = entry.params.profile
  return typeof profile === 'string' && profile.includes('activitystreams')
}

function prefersHtml(accept?: string | null): boolean {
  const entries = parseAcceptHeader(accept)
  if (!entries.length) {
    return false
  }

  const htmlWeight = getMaxWeight(entries, isHtmlMediaType)
  if (htmlWeight <= 0) {
    return false
  }

  const activityWeight = getMaxWeight(entries, isActivityMediaType)
  if (activityWeight <= 0) {
    return true
  }

  return htmlWeight > activityWeight
}

export default defineEventHandler(async (event) => {
  const accept = getHeader(event, 'accept')
  if (prefersHtml(accept)) {
    return sendRedirect(event, '/about')
  }

  const db = useDatabase()
  const { rows } = await db.sql`SELECT * FROM actor WHERE actor_id = ${me.id}`
  let publicKey: PublicKey | undefined = undefined;
  if (rows?.length === 1) {
    const { actor_id, public_key } = rows[0]

    publicKey = {
      id: `${actor_id}#main-key`,
      owner: `${actor_id}`,
      publicKeyPem: `${public_key}`
    }
  }
  setJsonLdHeader(event)
  return {
    ...me,
    publicKey
  }
})
