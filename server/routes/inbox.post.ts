import { handleInboxPost } from "../utils/inbox"

export default defineEventHandler(async (event) => {
  return await handleInboxPost(event)
})
