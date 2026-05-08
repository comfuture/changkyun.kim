import { listActivityPubFeedPosts } from "../../../utils/activityPubFeed"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number.parseInt(String(query.limit ?? "30"), 10)
  const offset = Number.parseInt(String(query.offset ?? "0"), 10)

  return {
    posts: await listActivityPubFeedPosts({ limit, offset }),
  }
})
