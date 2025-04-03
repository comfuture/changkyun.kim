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

  const response = {
    subject: resource,
    aliases: ['https://changkyun.com/ap/user/me'],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: event.node.req.url,
      },
    ],
  }

  return send(event, JSON.stringify(response), 'application/activity+json')
})