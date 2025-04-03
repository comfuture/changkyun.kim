// routes/users/[username]/outbox.get.ts
export default defineEventHandler((event) => {
  // TODO: Fetch actual activities from a data store
  // Returning an empty collection for this minimal example.
  const activities: any[] = [
    // Example structure if you had data:
    // {
    //     "@context": "https://www.w3.org/ns/activitystreams",
    //     "id": `${baseUrl}/activities/some-unique-id-1`, // Note: Use baseUrl from data.ts
    //     "type": "Create",
    //     "actor": user.actorUrl,
    //     "published": new Date().toISOString(),
    //     "to": ["https://www.w3.org/ns/activitystreams#Public"],
    //     "object": {
    //         "id": `${baseUrl}/notes/some-unique-note-id-1`,
    //         "type": "Note",
    //         "attributedTo": user.actorUrl,
    //         "content": "This is my first note!",
    //         "published": new Date().toISOString(),
    //          "to": ["https://www.w3.org/ns/activitystreams#Public"],
    //     }
    // }
  ];

  setResponseHeader(event, 'Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  return { // sendJson returns the body
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://changkyun.com/api/user/me/outbox',
    type: 'OrderedCollection',
    totalItems: activities.length, // Should be total count in DB
    orderedItems: activities // Needs pagination in a real implementation
    // first: `${user.outbox}?page=1`, // Example pagination link
  }
});