import type { Accept, Create } from "@csjewell-activitypub/types"
type Payload = {
  activity: Accept | Create
  target: string
}
export default defineTask({
  meta: {
    name: 'ap:sendActivity',
    description: 'Send an activity to the target actor',
  },
  async run(event) {
    const db = useDatabase()
    const { activity, target } = event.payload as Payload
    const { rows: receipants } = await db.sql`SELECT * FROM activity WHERE object = ${activity.actor} AND type = 'Follow'`

    for (const receipant of receipants ?? []) {
      const actor = receipant.actor_id as string
      // TODO: Implement the sendActivity function to send the activity to the target actor
    }
    return { result: true }
  }
})
