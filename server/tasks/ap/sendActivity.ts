import { randomUUID } from "node:crypto"

import { me, sendActivity } from "../../utils/federation"

type Payload = {
  activity: Activity
  target?: string | string[]
}

function resolveActorId(actor: unknown): string | null {
  if (!actor) {
    return null
  }
  if (typeof actor === 'string') {
    return actor
  }
  if (typeof actor === 'object' && typeof (actor as Actor | null)?.id === 'string') {
    return (actor as Actor).id
  }
  return null
}

function resolveObjectId(object: unknown): string | null {
  if (!object) {
    return null
  }
  if (typeof object === 'string') {
    return object
  }
  if (typeof object === 'object' && typeof (object as { id?: string | null })?.id === 'string') {
    return (object as { id: string }).id
  }
  return null
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
