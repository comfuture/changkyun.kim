import { listBlogTags } from "../../../utils/blogContent"

export default defineEventHandler(async (event) => {
  return await listBlogTags(event)
})
