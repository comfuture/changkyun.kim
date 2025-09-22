import { me } from '../../utils/federation'

const DOMAIN = 'changkyun.kim'
const ACTOR_HANDLE = 'me'

const VALID_RESOURCES = new Set([
  `acct:${ACTOR_HANDLE}@${DOMAIN}`,
  `acct:${me.preferredUsername.toLowerCase()}@${DOMAIN}`,
])

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
    subject: normalizedResource,
    aliases: ['https://changkyun.kim/@me'],
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