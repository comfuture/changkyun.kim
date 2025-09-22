import { randomUUID } from "node:crypto"

import { resolveActorId, resolveObjectId } from "../../utils/activitypub"
import { me, sendActivity } from "../../utils/federation"

type Payload = {
  activity: Activity
  target?: string | string[]
}
export default defineTask({
  meta: {
    name: 'ap:sendActivity',
    description: 'Send an activity to the target actor',
  },
  async run(event) {
    const db = useDatabase()
    const { activity, target } = event.payload as Payload

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

    const actorId = resolveActorId(activity?.actor)

    if (activity?.type === 'Follow' && actorId === me.id) {
      const followTarget = resolveObjectId(activity.object)
      if (followTarget) {
        const followId = typeof activity.id === 'string' && activity.id ? activity.id : randomUUID()
        const payload = JSON.stringify({
          '@context': activity['@context'] ?? 'https://www.w3.org/ns/activitystreams',
          id: followId,
          type: 'Follow',
          actor: me.id,
          object: followTarget,
        })
        await db.sql`INSERT INTO following (actor_id, activity_id, activity_payload, status)
          VALUES (${followTarget}, ${followId}, ${payload}, 'requested')
          ON CONFLICT(actor_id) DO UPDATE SET
            activity_id = excluded.activity_id,
            activity_payload = excluded.activity_payload,
            status = 'requested',
            updated_at = CURRENT_TIMESTAMP`
      }
    }

    if (!recipients.size && actorId === me.id) {
      const { rows } = await db.sql`SELECT actor_id FROM followers WHERE status = 'accepted'`
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
        console.error('Failed to send ActivityPub activity', error)
        failures.push({ actor, message: (error as Error).message })
      }
    }

    return { result: true, delivered, failed: failures }
  }
})
