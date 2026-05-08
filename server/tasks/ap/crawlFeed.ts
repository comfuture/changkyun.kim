import { crawlActivityPubFeed } from "../../utils/activityPubFeed"
import { ensureActivityPubSchema } from "../../utils/activityPubSchema"
import { createFedifyContext, getCloudflareEnv } from "../../utils/fedify"

export default defineTask({
  meta: {
    name: "ap:crawlFeed",
    description: "Crawl public ActivityPub posts from connected remote actors",
  },
  async run(event) {
    await ensureActivityPubSchema()
    const ctx = await createFedifyContext(getCloudflareEnv(event))
    const result = await crawlActivityPubFeed(ctx)
    return { result: true, ...result }
  },
})
