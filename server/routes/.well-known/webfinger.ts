export default defineEventHandler(async (event) => {
  const { resource } = getQuery<{ resource: string }>(event)

  if (!resource) {
    return createError({
      statusCode: 400,
      statusMessage: 'Missing resource parameter',
    })
  }

  if (resource !== 'acct:me@changkyun.kim') {
    return createError({
      statusCode: 404,
      statusMessage: 'Resource not found',
    })
  }

  setResponseHeader(event, 'Content-Type', 'application/jrd+json')
  return {
    subject: resource,
    aliases: ['https://changkyun.kim/@me'],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: 'https://changkyun.kim/@me',
      },
      {
        rel: 'https://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: 'https://changkyun.kim/about',
      },
    ],
  }
})