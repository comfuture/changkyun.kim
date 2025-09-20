import { sendActivity } from "../../utils/federation"

type DeliverPayload = {
  activity: Activity
  target?: string | string[]
}

export default defineTask({
  meta: {
    name: 'ap:deliver',
    description: 'Deliver activities to target actors',
  },
  async run(event) {
    const db = useDatabase()
    const { activity, target } = event.payload as DeliverPayload

    const recipients = new Set<string>()
    if (Array.isArray(target)) {
      for (const actor of target) {
        if (actor) {
          recipients.add(actor)
        }
      }
    } else if (target) {
      recipients.add(target)
    }

    const actorId = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    if (!recipients.size && actorId) {
      const { rows } = await db.sql`SELECT actor_id FROM activity WHERE object = ${actorId} AND type = 'Follow'`
      for (const row of rows ?? []) {
        const follower = row.actor_id as string | null
        if (follower) {
          recipients.add(follower)
        }
      }
    }

    let delivered = 0
    const failures: { actor: string; message: string }[] = []

    for (const actor of recipients) {
      try {
        await sendActivity(activity, actor)
        delivered += 1
      } catch (error) {
        console.error('Failed to deliver ActivityPub activity', error)
        failures.push({ actor, message: (error as Error).message })
      }
    }

    return { result: true, delivered, failed: failures }
  }
})
