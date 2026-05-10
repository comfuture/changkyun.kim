import { getQuery } from "h3"
import { getAppContent } from "../../../utils/appContent"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = typeof query.path === "string" ? query.path : ""

  return await getAppContent(event, path)
})
