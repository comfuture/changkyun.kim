export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: 'https://changkyun.com/ap/user/me',
    type: 'Person',
    preferredUsername: 'me',
    inbox: 'https://changkyun.com/ap/user/me/inbox',
    outbox: 'https://changkyun.com/ap/user/me/outbox',
    followers: 'https://changkyun.com/ap/user/me/followers',
    following: 'https://changkyun.com/ap/user/me/following',
  }
})
