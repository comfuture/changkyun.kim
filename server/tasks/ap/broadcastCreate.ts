import { ensureActivitySchema, me } from "../../utils/federation"

type BroadcastPayload = {
  activity: CreateActivity
}

export default defineTask({
  meta: {
    name: 'ap:broadcastCreate',
    description: 'Broadcast new Create activities to all followers',
  },
  async run(event) {
    const db = useDatabase()
    const { activity } = event.payload as BroadcastPayload

    if (!activity || activity.type !== 'Create') {
      return { result: false, reason: 'invalid-activity' }
    }

    const activityId = activity.id
    const actorId = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id || me.id
    const objectId = typeof activity.object === 'string'
      ? activity.object
      : Array.isArray(activity.object)
        ? JSON.stringify(activity.object)
        : (activity.object as Record<string, any> | undefined)?.id || null

    if (!activityId || !objectId) {
      return { result: false, reason: 'missing-identifiers' }
    }

    const payload = JSON.stringify(activity)
    const insertActivity = () => db.sql`INSERT INTO activity (
      activity_id, actor_id, type, object, payload
    ) VALUES (
      ${activityId}, ${actorId}, ${activity.type}, ${objectId}, ${payload}
    )`

    try {
      await insertActivity()
    } catch (error) {
      const message = (error as Error)?.message ?? ''
      if (/no such table: activity/i.test(message)) {
        await ensureActivitySchema(db)
        await insertActivity()
      } else if (/no column named (activity_id|payload)/i.test(message)) {
        await ensureActivitySchema(db)
        await insertActivity()
      } else if (/unique constraint failed|duplicate/i.test(message)) {
        return { result: false, reason: 'duplicate' }
      } else {
        console.error('Failed storing Create activity before broadcast', error)
        throw error
      }
    }

    await runTask('ap:sendActivity', {
      payload: {
        activity,
      },
    })

    return { result: true }
  },
})
