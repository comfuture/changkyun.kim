import { getQuery } from "h3"

import { listBlogArticles } from "../../../utils/blogContent"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = typeof query.limit === "string" ? Number(query.limit) : undefined

  return await listBlogArticles(event, Number.isFinite(limit) ? limit : undefined)
})
