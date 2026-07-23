export default defineEventHandler(async (event) => {
  const env = event.context?.cloudflare?.env
    ?? event.context?._platform?.cloudflare?.env
    ?? (globalThis as any).__env__
  const token = env?.ACTIVITYPUB_PUBLISH_TOKEN

  if (!token || getHeader(event, "authorization") !== `Bearer ${token}`) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
    })
  }

  return await runTask("ap:publishNewContent", {
    context: {
      cloudflare: { env },
    },
  })
})
