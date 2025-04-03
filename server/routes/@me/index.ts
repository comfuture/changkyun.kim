export default defineEventHandler(async (event) => {
  // TODO: check accept header

  setResponseHeader(event, 'Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: 'https://changkyun.kim/@me',
    type: 'Person',
    preferredUsername: 'me',
    names: ['Changkyun Kim', '김창균', '金昌均'],
    summary: `Principled person who values integrity. A slow but persistent learner with deep understanding. Problem solver using data, experience, and intuition.`,
    inbox: 'https://changkyun.kim/@me/inbox',
    outbox: 'https://changkyun.kim/@me/outbox',
    followers: 'https://changkyun.kim/@me/followers',
    following: 'https://changkyun.kim/@me/following',
  }
})
