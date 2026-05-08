import { getActivityPubFeedPost } from "../../../../utils/activityPubFeed"

export default defineEventHandler(async (event) => {
  const id = Number.parseInt(getRouterParam(event, "id") ?? "", 10)
  const post = await getActivityPubFeedPost(id)
  if (!post) {
    throw createError({
      statusCode: 404,
      statusMessage: "ActivityPub feed post not found.",
    })
  }

  return { post }
})
