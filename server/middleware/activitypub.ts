import { getHeader, getRequestURL } from 'h3'

import { setJsonLdHeader } from '../utils/federation'
import {
  buildArticleObjectFromEntry,
  buildCreateActivityFromEntry,
  CONTENT_CONTEXT,
} from '../utils/outboxHelpers'

const ACTIVITY_SUFFIX = '/activity'

const FEDERATED_PATHS: Array<{ prefix: string; collection: string }> = [
  { prefix: '/blog', collection: 'blog' },
  { prefix: '/app', collection: 'app' },
]

function acceptsActivityPub(acceptHeader?: string | null): boolean {
  if (!acceptHeader) {
    return false
  }

  const normalized = acceptHeader.toLowerCase()
  if (normalized.includes('application/activity+json')) {
    return true
  }

  if (normalized.includes('activity+json')) {
    return true
  }

  if (normalized.includes('ld+json') && normalized.includes('activitystreams')) {
    return true
  }

  if (normalized.includes('json') && normalized.includes('profile=') && normalized.includes('activitystreams')) {
    return true
  }

  return false
}

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return '/'
  }

  let normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.replace(/\/+$/, '')
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`
    }
    if (normalized.length === 0) {
      normalized = '/'
    }
  }
  return normalized || '/'
}

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') {
    return
  }

  const accept = getHeader(event, 'accept')
  if (!acceptsActivityPub(accept)) {
    return
  }

  const url = getRequestURL(event)
  if (!url) {
    return
  }

  let pathname = normalizePathname(url.pathname)
  let wantsActivityResource = false

  if (pathname !== '/' && pathname.endsWith(ACTIVITY_SUFFIX)) {
    wantsActivityResource = true
    pathname = normalizePathname(pathname.slice(0, -ACTIVITY_SUFFIX.length))
  }

  let attempted = false

  for (const { prefix, collection } of FEDERATED_PATHS) {
    if (pathname === prefix || !pathname.startsWith(`${prefix}/`)) {
      continue
    }

    attempted = true

    const entry = await queryCollection(event, collection).path(pathname).first()
    if (!entry) {
      continue
    }

    if (wantsActivityResource) {
      const activity = await buildCreateActivityFromEntry(entry)
      if (!activity) {
        continue
      }

      setJsonLdHeader(event)
      return activity
    }

    const article = await buildArticleObjectFromEntry(entry)
    if (!article) {
      continue
    }

    setJsonLdHeader(event)
    return {
      '@context': CONTENT_CONTEXT,
      ...article,
    }
  }

  if (!attempted) {
    return
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'ActivityPub resource not found',
  })
})
