import { getActivityPubNodeInfo } from "../../utils/fedify"

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Access-Control-Allow-Origin", "*")
  setResponseHeader(event, "Content-Type", "application/json; profile=\"http://nodeinfo.diaspora.software/ns/schema/2.1#\"; charset=utf-8")

  return await getActivityPubNodeInfo()
})
