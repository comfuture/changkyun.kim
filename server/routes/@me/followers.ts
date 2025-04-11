export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows: followers } = await db.sql`SELECT * FROM activity WHERE actor_id = ${me.id} AND type = 'Follow'`
  const items = followers?.map((follower) => follower.object as string) ?? []
  const totalItems = items.length
  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://changkyun.kim/@me/followers',
    type: 'Collection',
    totalItems,
    items,
  }
})
