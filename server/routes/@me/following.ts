export default defineEventHandler(async (event) => {
  setJsonLdHeader(event)
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://changkyun.kim/@me/following',
    type: 'OrderedCollection',
    totalItems: 0, // Should be total count in DB
    orderedItems: [], // Needs pagination in a real implementation
  }
})