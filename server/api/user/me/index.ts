export default defineEventHandler(async (event) => {
  // TODO: check accept header

  setResponseHeader(event, 'Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: 'https://changkyun.com/api/user/me',
    type: 'Person',
    preferredUsername: 'me',
    inbox: 'https://changkyun.com/api/user/me/inbox',
    outbox: 'https://changkyun.com/api/user/me/outbox',
    followers: 'https://changkyun.com/api/user/me/followers',
    following: 'https://changkyun.com/api/user/me/following',
  }
})
