import { processQueueMessage } from "../utils/fedify"

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:queue", async ({ batch, env }) => {
    for (const message of batch.messages ?? []) {
      try {
        const outcome = await processQueueMessage(env, message.body, { attempts: message.attempts })
        if (outcome.action === "retry") {
          message.retry({ delaySeconds: outcome.delaySeconds })
        } else {
          message.ack()
        }
      } catch (error) {
        console.error("Failed processing ActivityPub queue message", error)
        message.retry()
      }
    }
  })

  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    const taskOptions = {
      context: {
        cloudflare: { env },
      },
    }
    try {
      await runTask("ap:publishNewContent", taskOptions)
    } catch (error) {
      console.error("Failed publishing ActivityPub content on schedule", error)
    }
    try {
      await runTask("ap:crawlFeed", taskOptions)
    } catch (error) {
      console.error("Failed crawling ActivityPub feed on schedule", error)
    }
  })
})
