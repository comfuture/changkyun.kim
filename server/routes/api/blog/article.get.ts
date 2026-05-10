import { getQuery } from "h3"

import { getBlogArticle } from "../../../utils/blogContent"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = typeof query.path === "string" ? query.path : ""

  return await getBlogArticle(event, path)
})
