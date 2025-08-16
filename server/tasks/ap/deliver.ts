export default defineTask({
  meta: {
    name: 'ap:deliver',
    description: 'Deliver activities to target actors',
  },
  async run(event) {
    const db = useDatabase()
    const { activity } = event.payload
    const { rows: receipants } = await db.sql`SELECT * FROM activity WHERE object = ${activity.actor} AND type = 'Follow'`

    for (const receipant of receipants ?? []) {
      const actor = receipant.actor_id as string
      // await sendActivity(activity, actor)
    }
    return { result: true }
  }
})
