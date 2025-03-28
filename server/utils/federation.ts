import { createFederation, Person } from "@fedify/fedify";
import { MemoryKvStore, InProcessMessageQueue } from "@fedify/fedify";

const federation = createFederation({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
});

federation.setActorDispatcher('/user/{identifier}', async (ctx, identifier) => {
  // there is only me in this server
  if (identifier !== 'me') {
    return null
  }
  return new Person({
    id: ctx.getActorUri('me'),
    url: new URL('https://changkyun.kim/about'),
    preferredUsername: 'changkyun.kim',
    // name: 'Changkyun Kim',
    names: ['Changkyun Kim', '김창균', '金昌均'],
    summary: `Principled person who values integrity. A slow but persistent learner with deep understanding. Problem solver using data, experience, and intuition.`,
  })
})

export default federation