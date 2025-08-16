export default defineTask({
  meta: {
    name: 'ap:follow',
    description: 'Send a test follow request',
  },
  async run(event) {
    const db = useDatabase()

    // 내 Actor 정보 가져오기
    const { rows: myActorRows } = await db.sql`SELECT * FROM actor WHERE actor_id = ${'https://changkyun.kim/@me'}`
    if (!myActorRows?.length) {
      throw new Error('로컬 액터를 찾을 수 없습니다.')
    }
    const myActor = myActorRows[0]
    const key = await importPemKey(myActor.private_key as string)

    const targetActor = 'https://changkyun.kim/@me'

    const activity: FollowActivity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `https://changkyun.kim/@me/follow/${Date.now()}`,
      type: 'Follow',
      actor: 'https://changkyun.kim/@me',
      object: targetActor,
    }

    const activityBody = JSON.stringify(activity)

    // 메시지 다이제스트 생성 (SHA-256)
    const digest = await createDigest(activityBody)

    // 대상 서버 정보 (실제 targetActor의 도메인에서 추출해야 함)
    const host = 'changkyun.kim'
    const date = new Date().toUTCString()

    const signatureHeaders = await createSignedRequestHeaders({
      headers: {
        host,
        date,
        digest,
      },
      method: 'POST',
      path: '/@me/inbox',
    }, key)

    // 실제 요청
    await $fetch(`https://changkyun.kim/@me/inbox`, {
      method: 'POST',
      body: activityBody,
      headers: {
        'Content-Type': 'application/activity+json',
        host,
        ...signatureHeaders,
      },
    })

    return {
      result: true
    }
  }
})