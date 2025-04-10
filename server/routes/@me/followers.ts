export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const { rows } = await db.sql`SELECT count(*) FROM activity WHERE actor_id = ${me.id} AND type = 'Follow'`
  const totalItems = rows?.[0]?.count ?? 0 as number
  const { rows: followers } = await db.sql`SELECT * FROM activity WHERE actor_id = ${me.id} AND type = 'Follow' LIMIT 10`
  // const orderedItems = followers?.map((follower) => follower.object.id) ?? []
  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://changkyun.kim/@me/followers',
    type: 'OrderedCollection',
    totalItems: 0, // Should be total count in DB
    orderedItems: [], // Needs pagination in a real implementation
  }
})
