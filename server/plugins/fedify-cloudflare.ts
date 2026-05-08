import { processFedifyQueueMessage } from "../utils/fedify"

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:queue", async ({ batch, env }) => {
    for (const message of batch.messages ?? []) {
      try {
        await processFedifyQueueMessage(env, message.body)
        message.ack()
      } catch (error) {
        console.error("Failed processing Fedify queue message", error)
        message.retry()
      }
    }
  })

  nitroApp.hooks.hook("cloudflare:scheduled", async () => {
    try {
      await runTask("ap:publishNewContent")
    } catch (error) {
      console.error("Failed publishing ActivityPub content on schedule", error)
    }
    try {
      await runTask("ap:crawlFeed")
    } catch (error) {
      console.error("Failed crawling ActivityPub feed on schedule", error)
    }
  })
})
