// send test follow request
export default defineTask({
  meta: {
    name: 'ap:follow',
    description: 'Send a test follow request',
  },
  async run(event) {
    const db = useDatabase()
    const { rows } = await db.sql`SELECT * FROM actor WHERE actor_id = ${'https://changkyun.kim/@me'}`
    console.info('Rows:', rows)
    const key = await importPemKey(rows?.[0].private_key as string)
    const activity: FollowActivity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://changkyun.kim/@me/follow/1',
      type: 'Follow',
      actor: 'https://changkyun.kim/@me',
      object: 'https://changkyun.kim/@me',
    }

    const digest = await createDigest(JSON.stringify(activity), key)

    await $fetch('http://localhost:3000/@me/inbox', {
      method: 'POST',
      body: JSON.stringify(activity),
      headers: {
        'Content-Type': 'application/activity+json',
        'Signature': `keyId="https://changkyun.kim/@me#main-key",headers="(request-target) host date digest",signature="${digest}"`,
        'Date': new Date().toUTCString(),
        'Digest': `SHA-256=${digest}`,
        'Host': 'localhost:3000',
      },
    })
    return { result: true }
  }
})