export default defineEventHandler(async (event) => {
  // TODO: check accept header

  setResponseHeader(event, 'Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: 'https://changkyun.kim/api/@me',
    type: 'Person',
    preferredUsername: 'me',
    inbox: 'https://changkyun.kim/api/@me/inbox',
    outbox: 'https://changkyun.kim/api/@me/outbox',
    followers: 'https://changkyun.kim/api/@me/followers',
    following: 'https://changkyun.kim/api/@me/following',
  }
})
