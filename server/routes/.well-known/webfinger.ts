import { me } from '../../utils/federation'

const DOMAIN = 'changkyun.kim'
const ACTOR_HANDLE = 'me'
const CANONICAL_SUBJECT = `acct:${ACTOR_HANDLE}@${DOMAIN}`
const LEGACY_RESOURCES = [`acct:changkyun.kim@${DOMAIN}`]

const VALID_RESOURCES = new Set(
  [
    CANONICAL_SUBJECT,
    `acct:${me.preferredUsername.toLowerCase()}@${DOMAIN}`,
    ...LEGACY_RESOURCES,
  ].map((value) => value.toLowerCase()),
)

export default defineEventHandler((event) => {
  const { resource } = getQuery<{ resource?: string }>(event)

  if (!resource) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing resource parameter',
    })
  }

  const normalizedResource = resource.toLowerCase()

  if (!VALID_RESOURCES.has(normalizedResource)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Resource not found',
    })
  }

  setResponseHeader(event, 'Content-Type', 'application/jrd+json')
  return {
    subject: CANONICAL_SUBJECT,
    aliases: [
      'https://changkyun.kim/@me',
      ...LEGACY_RESOURCES,
    ],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: me.id,
      },
      {
        rel: 'https://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: 'https://changkyun.kim/about',
      },
    ],
  }
})