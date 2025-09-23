import Negotiator from 'negotiator'
import { getHeader, sendRedirect } from 'h3'

import { buildActorDocument, setJsonLdHeader } from '../../utils/federation'

const HTML_MEDIA_TYPES = new Set(['text/html', 'application/xhtml+xml'])
const ACTIVITY_MEDIA_TYPES = new Set(['application/activity+json', 'application/ld+json', 'application/json'])

function isHtmlMediaType(mediaType: string): boolean {
  return HTML_MEDIA_TYPES.has(mediaType) || mediaType === 'text/*'
}

function isActivityMediaType(mediaType: string): boolean {
  if (ACTIVITY_MEDIA_TYPES.has(mediaType) || mediaType === 'application/*') {
    return true
  }

  const separatorIndex = mediaType.indexOf('/')
  if (separatorIndex === -1) {
    return false
  }

  const subtype = mediaType.slice(separatorIndex + 1)
  return subtype === 'json' || subtype.endsWith('+json')
}

function prefersHtml(accept?: string | null): boolean {
  if (!accept) {
    return false
  }

  const negotiator = new Negotiator({ headers: { accept } })
  const acceptedMediaTypes = negotiator.mediaTypes()

  if (!acceptedMediaTypes.length) {
    return false
  }

  let activitySeen = false

  for (const mediaType of acceptedMediaTypes) {
    const normalized = mediaType.toLowerCase()

    if (normalized === '*/*') {
      continue
    }

    if (isHtmlMediaType(normalized)) {
      return !activitySeen
    }

    if (isActivityMediaType(normalized)) {
      activitySeen = true
    }
  }

  return false
}

export default defineCachedEventHandler(async (event) => {
  const accept = getHeader(event, 'accept')
  if (prefersHtml(accept)) {
    return sendRedirect(event, '/about')
  }

  const actorDocument = await buildActorDocument()
  setJsonLdHeader(event)
  return actorDocument
}, {
  maxAge: 60 * 60,
  shouldBypassCache(event) {
    const accept = getHeader(event, 'accept')
    return prefersHtml(accept)
  },
})
