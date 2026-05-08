import { getQuery } from "h3"

import { listActivityPubComments } from "../../../utils/fedifyComments"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = typeof query.path === "string" ? query.path : ""
  return {
    comments: await listActivityPubComments(path),
  }
})
