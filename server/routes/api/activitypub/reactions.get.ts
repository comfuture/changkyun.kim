import { getQuery } from "h3"

import { listActivityPubReactions } from "../../../utils/fedifyReactions"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = typeof query.path === "string" ? query.path : ""
  return {
    reactions: await listActivityPubReactions(path),
  }
})
