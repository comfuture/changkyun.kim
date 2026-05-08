import {
  ActivityPubFollowError,
  followRemoteActor,
  getCloudflareEnv,
  type ActivityPubFollowInput,
} from "../../utils/fedify"

export default defineEventHandler(async (event) => {
  const env = getCloudflareEnv(event)
  const token = env?.ACTIVITYPUB_PUBLISH_TOKEN

  if (!token || getHeader(event, "authorization") !== `Bearer ${token}`) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
    })
  }

  const body = await readBody<ActivityPubFollowInput>(event)
  try {
    return await followRemoteActor(body ?? {}, env)
  } catch (error) {
    if (error instanceof ActivityPubFollowError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
      })
    }
    throw error
  }
})
